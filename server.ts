import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  ElderlyProfile,
  MedicationScheduleItem,
  MedicalAppointment,
  DailyRoutineTask,
  CareCircleMember,
  EmailReminderLog,
  AuditEntry,
  ReminderType,
} from './src/types/index.js';
import {
  calculateAdherenceScore,
  evaluateElderlyContext,
  generateContextualAssistantReply,
  buildProactiveEmailReminder,
} from './src/utils/clinicalDecisionEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Security & JSON Middleware
app.use(express.json({ limit: '256kb' }));
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rate limiter for passcode verification to prevent brute-force attempts
const passcodeAttempts = new Map<string, { count: number; resetAt: number }>();

export function hashPasscode(passcode: string): string {
  return crypto.createHash('sha256').update(String(passcode).trim()).digest('hex');
}

export function verifyPasscodeTimingSafe(storedHash: string, candidatePasscode: string): boolean {
  const candidateHash = hashPasscode(candidatePasscode);
  const bufA = Buffer.from(storedHash, 'hex');
  const bufB = Buffer.from(candidateHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function issueCareSessionToken(profileId: string, passcodeHash: string): string {
  return crypto
    .createHash('sha256')
    .update(`silvercare-session:${profileId}:${passcodeHash}`)
    .digest('hex');
}

export function verifyCareCircleRequestAuth(
  profile: { id: string; passcodeHash: string },
  req: { headers?: Record<string, string | string[] | undefined>; body?: Record<string, unknown> }
): boolean {
  const headerSession = String(req.headers?.['x-care-session'] || '').trim();
  if (headerSession) {
    const expectedToken = issueCareSessionToken(profile.id, profile.passcodeHash);
    const bufA = Buffer.from(expectedToken, 'hex');
    const bufB = Buffer.from(headerSession, 'hex');
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      return true;
    }
  }

  const candidatePasscode = String(
    req.headers?.['x-care-passcode'] || req.body?.passcode || ''
  ).trim();
  if (candidatePasscode) {
    return verifyPasscodeTimingSafe(profile.passcodeHash, candidatePasscode);
  }

  return false;
}

export function verifyCareCircleRolePermission(
  profile: ElderlyProfile,
  actorName: string
): { allowed: boolean; message?: string } {
  const cleanActor = String(actorName || '').trim();
  const matchedMember = profile.careCircle.find(
    (m) =>
      `${m.name} (${m.relation})`.toLowerCase() === cleanActor.toLowerCase() ||
      m.name.toLowerCase() === cleanActor.toLowerCase()
  );

  const isElderlySelf =
    matchedMember?.relation === 'Elderly Self' ||
    cleanActor.toLowerCase().includes('elderly self') ||
    cleanActor.toLowerCase() === profile.name.toLowerCase();

  if (isElderlySelf) {
    return { allowed: true };
  }

  if (profile.autonomyPreferences && profile.autonomyPreferences.allowCaretakerScheduleEdits === false) {
    return {
      allowed: false,
      message: `${profile.name} has restricted caretaker medication schedule edits in Senior Autonomy Preferences.`,
    };
  }

  if (matchedMember && matchedMember.canEditMedications === false) {
    return {
      allowed: false,
      message: `${matchedMember.name} (${matchedMember.relation}) has View-Only permission and cannot modify medication schedules.`,
    };
  }

  return { allowed: true };
}

export function getLiveISTTimestamp(): { timeShort: string; dateStr: string; fullDisplay: string } {
  const now = new Date();
  const timeShort = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
    .format(now)
    .toUpperCase();

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '11';
  const d = parts.find((p) => p.type === 'day')?.value || '15';
  const dateStr = `${y}-${m}-${d}`;

  return {
    timeShort,
    dateStr,
    fullDisplay: `${dateStr}, ${timeShort} IST`,
  };
}

interface StoredElderlyProfile extends ElderlyProfile {
  passcodeHash: string;
}

interface DatabaseSchema {
  elderlyProfiles: StoredElderlyProfile[];
  auditLogs: AuditEntry[];
}

function getInitialSeedProfiles(): StoredElderlyProfile[] {
  return [
    {
      id: 'elder-1',
      name: 'Rameshwar Patil',
      age: 72,
      gender: 'Male',
      bloodGroup: 'B+',
      city: 'Pune',
      passcodeHint: '1954',
      passcodeHash: hashPasscode('1954'),
      chronicConditions: ['Hypertension (Stage 1)', 'Type 2 Diabetes', 'Knee Osteoarthritis'],
      allergies: ['Sulfa Drugs', 'Penicillin'],
      primaryDoctorName: 'Dr. Rajeshwari Deshmukh (Cardiology & Geriatrics)',
      emergencyContact: '+91 98230 44551',
      adherenceRate7d: 91,
      weeklyHistory: [
        { day: 'Mon', taken: 4, total: 4 },
        { day: 'Tue', taken: 4, total: 4 },
        { day: 'Wed', taken: 3, total: 4 },
        { day: 'Thu', taken: 4, total: 4 },
        { day: 'Fri', taken: 4, total: 4 },
        { day: 'Sat', taken: 4, total: 4 },
        { day: 'Sun', taken: 3, total: 4 },
      ],
      vitalsSummary: {
        bp: '128/82 mmHg',
        bloodSugar: '114 mg/dL (Fasting)',
        heartRate: 74,
        spo2: 98,
        lastUpdated: 'Today, 07:30 AM IST',
      },
      autonomyPreferences: {
        gracePeriodMinutes: 30,
        voiceReadoutEnabled: true,
        preferredLanguage: 'en-IN',
        allowCaretakerScheduleEdits: true,
        dailyCheckInMood: 'Comfortable',
        personalCareNote: 'Prefer taking morning blood pressure tablet after warm water and light walk.',
      },
      careCircle: [
        {
          id: 'cc-1',
          name: 'Rameshwar Patil',
          relation: 'Elderly Self',
          email: 'rameshwar.patil@silvercare.org',
          phone: '+91 98230 11220',
          canEditMedications: true,
          receiveEmailAlerts: true,
        },
        {
          id: 'cc-2',
          name: 'Siddhesh Hote',
          relation: 'Son',
          email: 'siddheshhote@gmail.com',
          phone: '+91 98230 44551',
          canEditMedications: true,
          receiveEmailAlerts: true,
        },
        {
          id: 'cc-3',
          name: 'Sunita Patil',
          relation: 'Daughter',
          email: 'sunita.familycare@gmail.com',
          phone: '+91 98230 77882',
          canEditMedications: true,
          receiveEmailAlerts: true,
        },
        {
          id: 'cc-4',
          name: 'Sister Kavita More',
          relation: 'Primary Caretaker',
          email: 'kavita.caretaker@silvercare.org',
          phone: '+91 98230 99003',
          canEditMedications: true,
          receiveEmailAlerts: true,
        },
      ],
      medications: [
        {
          id: 'med-101',
          medicineName: 'Telmisartan 40mg',
          dosage: '1 Tablet (40mg)',
          purpose: 'Blood Pressure Regulation',
          timeSlot: '08:00 AM',
          period: 'Morning',
          mealTiming: 'After Food',
          prescribedBy: 'Dr. Rajeshwari Deshmukh',
          pillsRemaining: 18,
          todayStatus: 'taken',
          lastTakenAt: '08:05 AM IST',
          notes: 'Take with a full glass of water after morning breakfast.',
        },
        {
          id: 'med-102',
          medicineName: 'Metformin SR 500mg',
          dosage: '1 Tablet (500mg)',
          purpose: 'Type 2 Diabetes Glycemic Control',
          timeSlot: '01:30 PM',
          period: 'Afternoon',
          mealTiming: 'After Food',
          prescribedBy: 'Dr. Sameer Joshi',
          pillsRemaining: 14,
          todayStatus: 'pending',
          notes: 'Take immediately after lunch to prevent post-meal glucose spike.',
        },
        {
          id: 'med-103',
          medicineName: 'Calcium + Vitamin D3 (Shelcal 500)',
          dosage: '1 Tablet',
          purpose: 'Bone Density & Knee Osteoarthritis',
          timeSlot: '05:00 PM',
          period: 'Evening',
          mealTiming: 'After Food',
          prescribedBy: 'Dr. Nilesh Kulkarni',
          pillsRemaining: 22,
          todayStatus: 'missed',
          notes: 'Supports joint strength and mobility.',
        },
        {
          id: 'med-104',
          medicineName: 'Atorvastatin 10mg',
          dosage: '1 Tablet (10mg)',
          purpose: 'Cholesterol & Cardiovascular Protection',
          timeSlot: '09:00 PM',
          period: 'Night',
          mealTiming: 'After Food',
          prescribedBy: 'Dr. Rajeshwari Deshmukh',
          pillsRemaining: 4,
          todayStatus: 'pending',
          notes: 'Low stock alert: Only 4 tablets remaining.',
        },
      ],
      appointments: [
        {
          id: 'apt-101',
          doctorName: 'Dr. Rajeshwari Deshmukh',
          speciality: 'Cardiology & Geriatric Medicine',
          clinicOrHospital: ' Sahyadri Senior Heart Clinic, Pune',
          appointmentDate: '2026-11-18',
          appointmentTime: '10:30 AM',
          purpose: 'Monthly BP, ECG & Lipid Profile Review',
          status: 'upcoming',
          preparationNotes: 'Carry 7-day fasting blood sugar log and current prescription strips.',
          accompaniedBy: 'Siddhesh Hote (Son)',
          reminderEmailSent: true,
        },
        {
          id: 'apt-102',
          doctorName: 'Dr. Nilesh Kulkarni',
          speciality: 'Orthopedics & Physiotherapy',
          clinicOrHospital: 'Deccan Bone & Joint Center, Pune',
          appointmentDate: '2026-11-24',
          appointmentTime: '04:00 PM',
          purpose: 'Knee Osteoarthritis Mobility Assessment',
          status: 'upcoming',
          preparationNotes: 'Wear comfortable walking footwear for gait check.',
          accompaniedBy: 'Sister Kavita More (Primary Caretaker)',
          reminderEmailSent: false,
        },
      ],
      routines: [
        {
          id: 'rt-1',
          title: 'Fasting Blood Sugar & Blood Pressure Check',
          time: '07:15 AM',
          category: 'Vitals',
          completed: true,
          completedBy: 'Sister Kavita More (Primary Caretaker)',
        },
        {
          id: 'rt-2',
          title: '20-Minute Gentle Morning Courtyard Walk',
          time: '07:45 AM',
          category: 'Exercise',
          completed: true,
          completedBy: 'Rameshwar Patil (Elderly Self)',
        },
        {
          id: 'rt-3',
          title: 'Mid-Morning Warm Water & Fruit Intake',
          time: '11:00 AM',
          category: 'Hydration',
          completed: true,
          completedBy: 'Rameshwar Patil (Elderly Self)',
        },
        {
          id: 'rt-4',
          title: 'Evening Knee Mobility & Breathing Stretches',
          time: '06:00 PM',
          category: 'Exercise',
          completed: false,
        },
      ],
      emailReminders: [
        {
          id: 'em-101',
          elderlyId: 'elder-1',
          type: 'missed_medication',
          subject: '[URGENT CARE ALERT] Missed Medication for Rameshwar Patil: Calcium + Vitamin D3 (05:00 PM)',
          recipients: ['siddheshhote@gmail.com', 'sunita.familycare@gmail.com', 'kavita.caretaker@silvercare.org'],
          bodyPreview:
            'Proactive Care Circle Alert: Rameshwar Patil (72 yrs) missed the 05:00 PM dose of Calcium + Vitamin D3. Sent after the 30-minute self-check-in grace window.',
          sentAt: 'Today, 05:30 PM IST',
          status: 'delivered',
          triggeredBy: 'Automated Adherence Watchdog',
        },
        {
          id: 'em-102',
          elderlyId: 'elder-1',
          type: 'upcoming_dose',
          subject: '[UPCOMING DOSE REMINDER] Atorvastatin 10mg at 09:00 PM — Rameshwar Patil',
          recipients: ['rameshwar.patil@silvercare.org', 'kavita.caretaker@silvercare.org'],
          bodyPreview:
            'Upcoming Medication Reminder: Rameshwar Patil is scheduled to take Atorvastatin 10mg (1 Tablet, After Food) at 09:00 PM. Note: Only 4 tablets remaining.',
          sentAt: 'Today, 08:30 PM IST',
          status: 'delivered',
          triggeredBy: 'Proactive Dose Scheduler',
        },
        {
          id: 'em-103',
          elderlyId: 'elder-1',
          type: 'appointment_reminder',
          subject: '[APPOINTMENT REMINDER] Rameshwar Patil — Dr. Rajeshwari Deshmukh on 2026-11-18 at 10:30 AM',
          recipients: ['siddheshhote@gmail.com', 'rameshwar.patil@silvercare.org', 'kavita.caretaker@silvercare.org'],
          bodyPreview:
            'Medical Appointment Reminder: Rameshwar Patil has an upcoming visit with Dr. Rajeshwari Deshmukh (Cardiology) on 2026-11-18 at 10:30 AM. Accompanied by Siddhesh Hote (Son).',
          sentAt: 'Today, 09:00 AM IST',
          status: 'delivered',
          triggeredBy: 'Appointment Sync Engine',
        },
      ],
    },
    {
      id: 'elder-2',
      name: 'Kamalabai Deshmukh',
      age: 68,
      gender: 'Female',
      bloodGroup: 'O+',
      city: 'Nashik',
      passcodeHint: '2026',
      passcodeHash: hashPasscode('2026'),
      chronicConditions: ['Hypothyroidism', 'Seasonal Bronchial Asthma'],
      allergies: ['NSAID Painkillers'],
      primaryDoctorName: 'Dr. Tushar Shinde (Pulmonology)',
      emergencyContact: '+91 98231 55660',
      adherenceRate7d: 96,
      weeklyHistory: [
        { day: 'Mon', taken: 3, total: 3 },
        { day: 'Tue', taken: 3, total: 3 },
        { day: 'Wed', taken: 3, total: 3 },
        { day: 'Thu', taken: 3, total: 3 },
        { day: 'Fri', taken: 3, total: 3 },
        { day: 'Sat', taken: 3, total: 3 },
        { day: 'Sun', taken: 2, total: 3 },
      ],
      vitalsSummary: {
        bp: '122/78 mmHg',
        bloodSugar: '98 mg/dL',
        heartRate: 72,
        spo2: 99,
        lastUpdated: 'Today, 08:00 AM IST',
      },
      autonomyPreferences: {
        gracePeriodMinutes: 45,
        voiceReadoutEnabled: true,
        preferredLanguage: 'mr-IN',
        allowCaretakerScheduleEdits: true,
        dailyCheckInMood: 'Energetic',
        personalCareNote: 'Prefers Marathi voice reminders 30 minutes before morning thyroid dose.',
      },
      careCircle: [
        {
          id: 'cc-201',
          name: 'Kamalabai Deshmukh',
          relation: 'Elderly Self',
          email: 'kamalabai.d@silvercare.org',
          phone: '+91 98231 10020',
          canEditMedications: true,
          receiveEmailAlerts: true,
        },
        {
          id: 'cc-202',
          name: 'Rohit Deshmukh',
          relation: 'Son',
          email: 'rohit.deshmukh@gmail.com',
          phone: '+91 98231 55660',
          canEditMedications: true,
          receiveEmailAlerts: true,
        },
      ],
      medications: [
        {
          id: 'med-201',
          medicineName: 'Levothyroxine (Thyronorm 50mcg)',
          dosage: '1 Tablet (50mcg)',
          purpose: 'Thyroid Hormone Replacement',
          timeSlot: '06:30 AM',
          period: 'Morning',
          mealTiming: 'Before Food',
          prescribedBy: 'Dr. Sameer Joshi',
          pillsRemaining: 24,
          todayStatus: 'taken',
          lastTakenAt: '06:35 AM IST',
          notes: 'Take on an empty stomach 45 minutes before morning tea.',
        },
        {
          id: 'med-202',
          medicineName: 'Montelukast + Levocetirizine',
          dosage: '1 Tablet',
          purpose: 'Nighttime Airway & Asthma Prevention',
          timeSlot: '08:30 PM',
          period: 'Night',
          mealTiming: 'After Food',
          prescribedBy: 'Dr. Tushar Shinde',
          pillsRemaining: 12,
          todayStatus: 'pending',
          notes: 'Take after dinner.',
        },
      ],
      appointments: [
        {
          id: 'apt-201',
          doctorName: 'Dr. Tushar Shinde',
          speciality: 'Pulmonology',
          clinicOrHospital: 'Chest & Allergy Care Clinic, Nashik',
          appointmentDate: '2026-11-21',
          appointmentTime: '11:15 AM',
          purpose: 'Spirometry & Winter Inhaler Review',
          status: 'upcoming',
          preparationNotes: 'Bring current inhaler and thyroid blood test report.',
          accompaniedBy: 'Rohit Deshmukh (Son)',
          reminderEmailSent: true,
        },
      ],
      routines: [
        {
          id: 'rt-201',
          title: 'Warm Steam Inhalation & Breathing Exercise',
          time: '08:00 AM',
          category: 'Wellness',
          completed: true,
          completedBy: 'Kamalabai Deshmukh (Elderly Self)',
        },
        {
          id: 'rt-202',
          title: 'Evening Pulse Oximeter & SpO2 Check',
          time: '07:00 PM',
          category: 'Vitals',
          completed: false,
        },
      ],
      emailReminders: [
        {
          id: 'em-201',
          elderlyId: 'elder-2',
          type: 'upcoming_dose',
          subject: '[UPCOMING DOSE REMINDER] Montelukast + Levocetirizine at 08:30 PM — Kamalabai Deshmukh',
          recipients: ['kamalabai.d@silvercare.org', 'rohit.deshmukh@gmail.com'],
          bodyPreview:
            'Scheduled Night Medication: Please take 1 Tablet of Montelukast + Levocetirizine after dinner at 08:30 PM.',
          sentAt: 'Today, 08:00 PM IST',
          status: 'delivered',
          triggeredBy: 'Proactive Dose Scheduler',
        },
      ],
    },
  ];
}

let cachedDB: DatabaseSchema | null = null;

export function loadDB(): DatabaseSchema {
  if (cachedDB) return cachedDB;

  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.elderlyProfiles) &&
        parsed.elderlyProfiles.length > 0 &&
        parsed.elderlyProfiles[0].passcodeHash
      ) {
        cachedDB = {
          elderlyProfiles: parsed.elderlyProfiles,
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        };
        return cachedDB;
      }
    }
  } catch (err) {
    console.warn('Initializing fresh Elderly Care database:', err);
  }

  cachedDB = {
    elderlyProfiles: getInitialSeedProfiles(),
    auditLogs: [
      {
        id: `audit-${Date.now()}`,
        timestamp: getLiveISTTimestamp().fullDisplay,
        actor: 'System',
        action: 'PLATFORM_INITIALIZED',
        details: 'Initialized Elderly Care & Medication Management Platform with passcode-protected Care Circles.',
      },
    ],
  };
  saveDB(cachedDB);
  return cachedDB;
}

export function saveDB(db: DatabaseSchema): void {
  cachedDB = db;
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write db.json:', err);
  }
}

function addAudit(actor: string, action: string, details: string): void {
  const db = loadDB();
  db.auditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: getLiveISTTimestamp().fullDisplay,
    actor,
    action,
    details,
  });
  if (db.auditLogs.length > 60) {
    db.auditLogs = db.auditLogs.slice(0, 60);
  }
  saveDB(db);
}

function sanitizePublicProfile(profile: StoredElderlyProfile): ElderlyProfile {
  const { passcodeHash: _omitted, ...rest } = profile;
  return rest;
}

function syncProfileAdherence(profile: StoredElderlyProfile): void {
  profile.adherenceRate7d = calculateAdherenceScore(profile.medications, profile.weeklyHistory);
  if (profile.weeklyHistory.length > 0) {
    const lastIdx = profile.weeklyHistory.length - 1;
    const takenToday = profile.medications.filter((m) => m.todayStatus === 'taken').length;
    profile.weeklyHistory[lastIdx] = {
      ...profile.weeklyHistory[lastIdx],
      taken: takenToday,
      total: profile.medications.length,
    };
  }
}

// -------------------------------------------------------------
// REST API ENDPOINTS — ELDERLY CARE & MEDICATION MANAGEMENT
// -------------------------------------------------------------

// 1. Live IST Clock & System Health
app.get('/api/time', (_req: Request, res: Response) => {
  res.json({
    success: true,
    ...getLiveISTTimestamp(),
  });
});

// 2. Get All Elderly Care Profiles & Audit Logs
app.get('/api/elderly-care/profiles', (_req: Request, res: Response) => {
  const db = loadDB();
  res.json({
    success: true,
    profiles: db.elderlyProfiles.map(sanitizePublicProfile),
    auditLogs: db.auditLogs,
  });
});

// 3. Create New Elderly Care Profile
app.post('/api/elderly-care/profiles', (req: Request, res: Response) => {
  const {
    name,
    age = 70,
    gender = 'Male',
    bloodGroup = 'O+',
    city = 'Pune',
    passcode = '1234',
    chronicConditions = [],
    allergies = [],
    primaryDoctorName = 'Dr. Rajeshwari Deshmukh',
    emergencyContact = '+91 98230 44551',
    caretakerName = 'Siddhesh Hote',
    caretakerEmail = 'siddheshhote@gmail.com',
    caretakerRelation = 'Son',
  } = req.body;

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Valid senior full name is required.' });
  }

  const cleanPasscode = String(passcode || '1234').trim();
  if (!/^\d{4,6}$/.test(cleanPasscode)) {
    return res.status(400).json({ success: false, message: 'Passcode must be 4 to 6 digits.' });
  }

  const db = loadDB();
  const ist = getLiveISTTimestamp();
  const newProfile: StoredElderlyProfile = {
    id: `elder-${Date.now()}`,
    name: String(name).trim(),
    age: Math.max(50, Math.min(115, Number(age) || 70)),
    gender,
    bloodGroup: String(bloodGroup).trim() || 'O+',
    city: String(city).trim() || 'Pune',
    passcodeHint: cleanPasscode,
    passcodeHash: hashPasscode(cleanPasscode),
    chronicConditions: Array.isArray(chronicConditions)
      ? chronicConditions
      : String(chronicConditions)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    allergies: Array.isArray(allergies)
      ? allergies
      : String(allergies)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    primaryDoctorName: String(primaryDoctorName).trim(),
    emergencyContact: String(emergencyContact).trim(),
    adherenceRate7d: 95,
    weeklyHistory: [
      { day: 'Mon', taken: 2, total: 2 },
      { day: 'Tue', taken: 2, total: 2 },
      { day: 'Wed', taken: 2, total: 2 },
      { day: 'Thu', taken: 2, total: 2 },
      { day: 'Fri', taken: 2, total: 2 },
      { day: 'Sat', taken: 2, total: 2 },
      { day: 'Sun', taken: 1, total: 2 },
    ],
    vitalsSummary: {
      bp: '124/80 mmHg',
      bloodSugar: '108 mg/dL',
      heartRate: 73,
      spo2: 98,
      lastUpdated: `Today, ${ist.timeShort} IST`,
    },
    autonomyPreferences: {
      gracePeriodMinutes: 30,
      voiceReadoutEnabled: true,
      preferredLanguage: 'en-IN',
      allowCaretakerScheduleEdits: true,
      dailyCheckInMood: 'Comfortable',
      personalCareNote: 'Prefers independent morning routine with gentle voice reminders.',
    },
    careCircle: [
      {
        id: `cc-${Date.now()}-1`,
        name: String(name).trim(),
        relation: 'Elderly Self',
        email: `${String(name).toLowerCase().replace(/[^a-z0-9]/g, '.')}@silvercare.org`,
        phone: String(emergencyContact).trim(),
        canEditMedications: true,
        receiveEmailAlerts: true,
      },
      {
        id: `cc-${Date.now()}-2`,
        name: String(caretakerName).trim(),
        relation: caretakerRelation,
        email: String(caretakerEmail).trim(),
        phone: String(emergencyContact).trim(),
        canEditMedications: true,
        receiveEmailAlerts: true,
      },
    ],
    medications: [
      {
        id: `med-${Date.now()}-1`,
        medicineName: 'Amlodipine 5mg',
        dosage: '1 Tablet (5mg)',
        purpose: 'Daily Blood Pressure Control',
        timeSlot: '08:30 AM',
        period: 'Morning',
        mealTiming: 'After Food',
        prescribedBy: String(primaryDoctorName).trim(),
        pillsRemaining: 20,
        todayStatus: 'taken',
        lastTakenAt: '08:35 AM IST',
        notes: 'Take after breakfast.',
      },
      {
        id: `med-${Date.now()}-2`,
        medicineName: 'Calcium & Vitamin D3',
        dosage: '1 Tablet',
        purpose: 'Bone & Joint Support',
        timeSlot: '08:30 PM',
        period: 'Night',
        mealTiming: 'After Food',
        prescribedBy: String(primaryDoctorName).trim(),
        pillsRemaining: 15,
        todayStatus: 'pending',
        notes: 'Take after dinner.',
      },
    ],
    appointments: [
      {
        id: `apt-${Date.now()}-1`,
        doctorName: String(primaryDoctorName).trim(),
        speciality: 'Geriatric Medicine',
        clinicOrHospital: `${city} Senior Care Clinic`,
        appointmentDate: '2026-11-20',
        appointmentTime: '10:30 AM',
        purpose: 'Comprehensive Senior Wellness Checkup',
        status: 'upcoming',
        preparationNotes: 'Bring medication chart and fasting blood sugar readings.',
        accompaniedBy: String(caretakerName).trim(),
        reminderEmailSent: false,
      },
    ],
    routines: [
      {
        id: `rt-${Date.now()}-1`,
        title: 'Morning Blood Pressure & Pulse Check',
        time: '08:00 AM',
        category: 'Vitals',
        completed: true,
        completedBy: String(caretakerName).trim(),
      },
      {
        id: `rt-${Date.now()}-2`,
        title: '20-Minute Evening Walk',
        time: '05:30 PM',
        category: 'Exercise',
        completed: false,
      },
    ],
    emailReminders: [],
  };

  db.elderlyProfiles.unshift(newProfile);
  saveDB(db);
  addAudit(caretakerName, 'PROFILE_CREATED', `Created elderly care profile for ${newProfile.name}`);

  return res.status(201).json({
    success: true,
    profile: sanitizePublicProfile(newProfile),
    sessionToken: issueCareSessionToken(newProfile.id, newProfile.passcodeHash),
  });
});

// 4. Verify Passcode (Timing-Safe SHA-256 + Rate Limiting)
app.post('/api/elderly-care/profiles/:id/verify-passcode', (req: Request, res: Response) => {
  const { id } = req.params;
  const { passcode } = req.body;
  const clientKey = `${req.ip || 'local'}:${id}`;

  const now = Date.now();
  const attemptRecord = passcodeAttempts.get(clientKey);
  if (attemptRecord && attemptRecord.resetAt > now && attemptRecord.count >= 10) {
    return res.status(429).json({
      success: false,
      verified: false,
      message: 'Too many failed passcode attempts. Please wait a few minutes before retrying.',
    });
  }

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, verified: false, message: 'Profile not found.' });
  }

  const isMatch = verifyPasscodeTimingSafe(profile.passcodeHash, String(passcode || ''));
  if (!isMatch) {
    const prevCount = attemptRecord && attemptRecord.resetAt > now ? attemptRecord.count : 0;
    passcodeAttempts.set(clientKey, { count: prevCount + 1, resetAt: now + 5 * 60 * 1000 });
    return res.status(401).json({
      success: false,
      verified: false,
      message: `Invalid Care Circle passcode. (Demo passcode for ${profile.name} is ${profile.passcodeHint})`,
    });
  }

  passcodeAttempts.delete(clientKey);
  addAudit('Care Circle Member', 'PASSCODE_VERIFIED', `Unlocked Care Circle access for ${profile.name}`);
  return res.json({
    success: true,
    verified: true,
    sessionToken: issueCareSessionToken(profile.id, profile.passcodeHash),
    message: `Care Circle access unlocked for ${profile.name}.`,
  });
});

// 5. Change Care Circle Passcode
app.patch('/api/elderly-care/profiles/:id/passcode', (req: Request, res: Response) => {
  const { id } = req.params;
  const { currentPasscode, newPasscode, actorName = 'Elderly Self' } = req.body;

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  if (!verifyPasscodeTimingSafe(profile.passcodeHash, String(currentPasscode || ''))) {
    return res.status(401).json({ success: false, message: 'Current passcode is incorrect.' });
  }

  const cleanNew = String(newPasscode || '').trim();
  if (!/^\d{4,6}$/.test(cleanNew)) {
    return res.status(400).json({ success: false, message: 'New passcode must be 4 to 6 digits.' });
  }

  profile.passcodeHint = cleanNew;
  profile.passcodeHash = hashPasscode(cleanNew);
  saveDB(db);
  addAudit(actorName, 'PASSCODE_UPDATED', `Updated Care Circle passcode for ${profile.name}`);

  return res.json({
    success: true,
    profile: sanitizePublicProfile(profile),
    sessionToken: issueCareSessionToken(profile.id, profile.passcodeHash),
  });
});

// 6. Add Medication Schedule
app.post('/api/elderly-care/profiles/:id/medications', (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    medicineName,
    dosage,
    purpose = 'Daily Care',
    timeSlot = '08:00 AM',
    period = 'Morning',
    mealTiming = 'After Food',
    prescribedBy = 'Primary Physician',
    pillsRemaining = 15,
    notes = '',
    actorName = 'Care Circle Member',
  } = req.body;

  if (!medicineName || !dosage) {
    return res.status(400).json({ success: false, message: 'Medicine name and dosage are required.' });
  }

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  if (!verifyCareCircleRequestAuth(profile, req)) {
    return res.status(401).json({
      success: false,
      message: 'Care Circle passcode verification required to modify medication schedules.',
    });
  }

  const roleCheck = verifyCareCircleRolePermission(profile, actorName);
  if (!roleCheck.allowed) {
    return res.status(403).json({
      success: false,
      message: roleCheck.message || 'Insufficient Care Circle role permissions to edit medications.',
    });
  }

  const newMed: MedicationScheduleItem = {
    id: `med-${Date.now()}`,
    medicineName: String(medicineName).trim(),
    dosage: String(dosage).trim(),
    purpose: String(purpose).trim(),
    timeSlot: String(timeSlot).trim(),
    period,
    mealTiming,
    prescribedBy: String(prescribedBy).trim(),
    pillsRemaining: Math.max(0, Number(pillsRemaining) || 15),
    todayStatus: 'pending',
    notes: String(notes).trim(),
  };

  profile.medications.push(newMed);
  syncProfileAdherence(profile);
  saveDB(db);
  addAudit(actorName, 'MEDICATION_ADDED', `Added ${newMed.medicineName} (${newMed.timeSlot}) for ${profile.name}`);

  return res.status(201).json({
    success: true,
    profile: sanitizePublicProfile(profile),
  });
});

// 7. Edit Medication Schedule
app.put('/api/elderly-care/profiles/:id/medications/:medId', (req: Request, res: Response) => {
  const { id, medId } = req.params;
  const { actorName = 'Care Circle Member', ...updates } = req.body;

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  if (!verifyCareCircleRequestAuth(profile, req)) {
    return res.status(401).json({
      success: false,
      message: 'Care Circle passcode verification required to modify medication schedules.',
    });
  }

  const roleCheck = verifyCareCircleRolePermission(profile, actorName);
  if (!roleCheck.allowed) {
    return res.status(403).json({
      success: false,
      message: roleCheck.message || 'Insufficient Care Circle role permissions to edit medications.',
    });
  }

  const idx = profile.medications.findIndex((m) => m.id === medId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Medication item not found.' });
  }

  profile.medications[idx] = {
    ...profile.medications[idx],
    medicineName: updates.medicineName ? String(updates.medicineName).trim() : profile.medications[idx].medicineName,
    dosage: updates.dosage ? String(updates.dosage).trim() : profile.medications[idx].dosage,
    purpose: updates.purpose ? String(updates.purpose).trim() : profile.medications[idx].purpose,
    timeSlot: updates.timeSlot ? String(updates.timeSlot).trim() : profile.medications[idx].timeSlot,
    period: updates.period || profile.medications[idx].period,
    mealTiming: updates.mealTiming || profile.medications[idx].mealTiming,
    prescribedBy: updates.prescribedBy ? String(updates.prescribedBy).trim() : profile.medications[idx].prescribedBy,
    pillsRemaining:
      updates.pillsRemaining !== undefined
        ? Math.max(0, Number(updates.pillsRemaining))
        : profile.medications[idx].pillsRemaining,
    notes: updates.notes !== undefined ? String(updates.notes).trim() : profile.medications[idx].notes,
  };

  syncProfileAdherence(profile);
  saveDB(db);
  addAudit(
    actorName,
    'MEDICATION_EDITED',
    `Edited medication ${profile.medications[idx].medicineName} for ${profile.name}`
  );

  return res.json({
    success: true,
    profile: sanitizePublicProfile(profile),
  });
});

// 8. Delete Medication Schedule
app.delete('/api/elderly-care/profiles/:id/medications/:medId', (req: Request, res: Response) => {
  const { id, medId } = req.params;
  const actorName = req.body?.actorName || 'Care Circle Member';

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  if (!verifyCareCircleRequestAuth(profile, req)) {
    return res.status(401).json({
      success: false,
      message: 'Care Circle passcode verification required to delete medication schedules.',
    });
  }

  const roleCheck = verifyCareCircleRolePermission(profile, actorName);
  if (!roleCheck.allowed) {
    return res.status(403).json({
      success: false,
      message: roleCheck.message || 'Insufficient Care Circle role permissions to delete medications.',
    });
  }

  const target = profile.medications.find((m) => m.id === medId);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Medication not found.' });
  }

  profile.medications = profile.medications.filter((m) => m.id !== medId);
  syncProfileAdherence(profile);
  saveDB(db);
  addAudit(actorName, 'MEDICATION_DELETED', `Deleted ${target.medicineName} from ${profile.name}'s schedule`);

  return res.json({
    success: true,
    profile: sanitizePublicProfile(profile),
  });
});

// 9. Mark Medication Dose Status (Taken / Missed / Snoozed) + Auto Missed-Dose Email Dispatch
app.patch('/api/elderly-care/profiles/:id/medications/:medId/status', (req: Request, res: Response) => {
  const { id, medId } = req.params;
  const { status, actorName = 'Elderly Self' } = req.body;

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  const med = profile.medications.find((m) => m.id === medId);
  if (!med) {
    return res.status(404).json({ success: false, message: 'Medication not found.' });
  }

  const ist = getLiveISTTimestamp();
  const prevStatus = med.todayStatus;
  med.todayStatus = status;

  if (status === 'taken') {
    med.lastTakenAt = `${ist.timeShort} IST`;
    if (prevStatus !== 'taken' && med.pillsRemaining > 0) {
      med.pillsRemaining = Math.max(0, med.pillsRemaining - 1);
    }
  }

  let autoEmailLog: EmailReminderLog | undefined;
  if (status === 'missed') {
    autoEmailLog = buildProactiveEmailReminder(
      sanitizePublicProfile(profile),
      'missed_medication',
      `Auto-Escalation (${actorName})`,
      `Today, ${ist.timeShort} IST`,
      `[URGENT CARE ALERT] Missed Dose: ${med.medicineName} (${med.timeSlot}) — ${profile.name}`,
      `Automated Care Circle Alert: ${profile.name} (${profile.age} yrs) missed the scheduled ${med.timeSlot} dose of ${med.medicineName} (${med.dosage} · ${med.purpose}). Logged by ${actorName} after ${profile.autonomyPreferences.gracePeriodMinutes}-min grace window.`
    );
    profile.emailReminders.unshift(autoEmailLog);
  }

  syncProfileAdherence(profile);
  saveDB(db);
  addAudit(
    actorName,
    'DOSE_STATUS_UPDATED',
    `Marked ${med.medicineName} (${med.timeSlot}) as ${String(status).toUpperCase()} for ${profile.name}`
  );

  return res.json({
    success: true,
    profile: sanitizePublicProfile(profile),
    autoEmailLog,
  });
});

// 10. Add or Update Medical Appointment for Elderly Person
app.post('/api/elderly-care/profiles/:id/appointments', (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    doctorName,
    speciality = 'General Medicine',
    clinicOrHospital,
    appointmentDate,
    appointmentTime,
    purpose = 'Routine Senior Checkup',
    preparationNotes = 'Carry medication chart and vitals log.',
    accompaniedBy = 'Family Member',
    actorName = 'Care Circle Member',
  } = req.body;

  if (!doctorName || !appointmentDate || !appointmentTime) {
    return res.status(400).json({
      success: false,
      message: 'Doctor name, appointment date, and time are required.',
    });
  }

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  if (!verifyCareCircleRequestAuth(profile, req)) {
    return res.status(401).json({
      success: false,
      message: 'Care Circle passcode verification required to schedule medical appointments.',
    });
  }

  const ist = getLiveISTTimestamp();
  const newApt: MedicalAppointment = {
    id: `apt-${Date.now()}`,
    doctorName: String(doctorName).trim(),
    speciality: String(speciality).trim(),
    clinicOrHospital: String(clinicOrHospital || `${profile.city} Care Clinic`).trim(),
    appointmentDate: String(appointmentDate).trim(),
    appointmentTime: String(appointmentTime).trim(),
    purpose: String(purpose).trim(),
    status: 'upcoming',
    preparationNotes: String(preparationNotes).trim(),
    accompaniedBy: String(accompaniedBy).trim(),
    reminderEmailSent: true,
  };

  profile.appointments.unshift(newApt);

  // Proactively dispatch an appointment confirmation & reminder email to the Care Circle
  const emailLog = buildProactiveEmailReminder(
    sanitizePublicProfile(profile),
    'appointment_reminder',
    actorName,
    `Today, ${ist.timeShort} IST`,
    `[APPOINTMENT SCHEDULED] ${profile.name} — ${newApt.doctorName} on ${newApt.appointmentDate} at ${newApt.appointmentTime}`,
    `Scheduled Medical Visit: ${profile.name} has an appointment with ${newApt.doctorName} (${newApt.speciality}) at ${newApt.clinicOrHospital} on ${newApt.appointmentDate} at ${newApt.appointmentTime}. Accompanied by: ${newApt.accompaniedBy}. Preparation: ${newApt.preparationNotes}.`
  );
  profile.emailReminders.unshift(emailLog);

  saveDB(db);
  addAudit(
    actorName,
    'APPOINTMENT_SCHEDULED',
    `Scheduled appointment with ${newApt.doctorName} on ${newApt.appointmentDate} at ${newApt.appointmentTime} for ${profile.name}`
  );

  return res.status(201).json({
    success: true,
    profile: sanitizePublicProfile(profile),
    emailLog,
  });
});

app.patch('/api/elderly-care/profiles/:id/appointments/:aptId', (req: Request, res: Response) => {
  const { id, aptId } = req.params;
  const { status, actorName = 'Care Circle Member' } = req.body;

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  const apt = profile.appointments.find((a) => a.id === aptId);
  if (!apt) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  if (status) apt.status = status;
  saveDB(db);
  addAudit(actorName, 'APPOINTMENT_UPDATED', `Updated appointment with ${apt.doctorName} to ${apt.status}`);

  return res.json({
    success: true,
    profile: sanitizePublicProfile(profile),
  });
});

// 11. Daily Healthcare Routines (Toggle & Add)
app.patch('/api/elderly-care/profiles/:id/routines/:routineId/toggle', (req: Request, res: Response) => {
  const { id, routineId } = req.params;
  const { actorName = 'Elderly Self' } = req.body;

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  const routine = profile.routines.find((r) => r.id === routineId);
  if (!routine) {
    return res.status(404).json({ success: false, message: 'Routine task not found.' });
  }

  routine.completed = !routine.completed;
  routine.completedBy = routine.completed ? actorName : undefined;
  saveDB(db);
  addAudit(
    actorName,
    'ROUTINE_TOGGLED',
    `${routine.completed ? 'Completed' : 'Reopened'} daily routine "${routine.title}" for ${profile.name}`
  );

  return res.json({
    success: true,
    profile: sanitizePublicProfile(profile),
  });
});

app.post('/api/elderly-care/profiles/:id/routines', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, time = '09:00 AM', category = 'Wellness', actorName = 'Care Circle Member' } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ success: false, message: 'Routine title is required.' });
  }

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  const newTask: DailyRoutineTask = {
    id: `rt-${Date.now()}`,
    title: String(title).trim(),
    time: String(time).trim(),
    category,
    completed: false,
  };

  profile.routines.push(newTask);
  saveDB(db);
  addAudit(actorName, 'ROUTINE_ADDED', `Added daily routine "${newTask.title}" for ${profile.name}`);

  return res.status(201).json({
    success: true,
    profile: sanitizePublicProfile(profile),
  });
});

// 12. Care Circle Members Management
app.post('/api/elderly-care/profiles/:id/care-circle', (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    relation = 'Family Member',
    email,
    phone = '+91 98230 00000',
    canEditMedications = true,
    receiveEmailAlerts = true,
    actorName = 'Care Circle Admin',
  } = req.body;

  if (!name || !email || !String(email).includes('@')) {
    return res.status(400).json({
      success: false,
      message: 'Valid member name and email address are required.',
    });
  }

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  if (!verifyCareCircleRequestAuth(profile, req)) {
    return res.status(401).json({
      success: false,
      message: 'Care Circle passcode verification required to authorize new Care Circle members.',
    });
  }

  const newMember: CareCircleMember = {
    id: `cc-${Date.now()}`,
    name: String(name).trim(),
    relation,
    email: String(email).trim(),
    phone: String(phone).trim(),
    canEditMedications: Boolean(canEditMedications),
    receiveEmailAlerts: Boolean(receiveEmailAlerts),
  };

  profile.careCircle.push(newMember);
  saveDB(db);
  addAudit(actorName, 'CARE_CIRCLE_MEMBER_ADDED', `Added ${newMember.name} (${newMember.relation}) to ${profile.name}'s Care Circle`);

  return res.status(201).json({
    success: true,
    profile: sanitizePublicProfile(profile),
  });
});

// 13. Update Senior Vitals & Elderly Autonomy Preferences
app.patch('/api/elderly-care/profiles/:id/vitals', (req: Request, res: Response) => {
  const { id } = req.params;
  const { bp, bloodSugar, heartRate, spo2, actorName = 'Elderly Self' } = req.body;

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  const ist = getLiveISTTimestamp();
  profile.vitalsSummary = {
    bp: bp ? String(bp).trim() : profile.vitalsSummary.bp,
    bloodSugar: bloodSugar ? String(bloodSugar).trim() : profile.vitalsSummary.bloodSugar,
    heartRate: Number(heartRate) || profile.vitalsSummary.heartRate,
    spo2: Number(spo2) || profile.vitalsSummary.spo2,
    lastUpdated: `Today, ${ist.timeShort} IST`,
  };

  saveDB(db);
  addAudit(
    actorName,
    'VITALS_UPDATED',
    `Logged vitals for ${profile.name}: BP ${profile.vitalsSummary.bp}, Sugar ${profile.vitalsSummary.bloodSugar}`
  );

  return res.json({
    success: true,
    profile: sanitizePublicProfile(profile),
  });
});

app.patch('/api/elderly-care/profiles/:id/autonomy', (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    gracePeriodMinutes,
    voiceReadoutEnabled,
    preferredLanguage,
    allowCaretakerScheduleEdits,
    dailyCheckInMood,
    personalCareNote,
    actorName = 'Elderly Self',
  } = req.body;

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  profile.autonomyPreferences = {
    gracePeriodMinutes:
      gracePeriodMinutes !== undefined
        ? Math.max(5, Math.min(120, Number(gracePeriodMinutes)))
        : profile.autonomyPreferences.gracePeriodMinutes,
    voiceReadoutEnabled:
      voiceReadoutEnabled !== undefined
        ? Boolean(voiceReadoutEnabled)
        : profile.autonomyPreferences.voiceReadoutEnabled,
    preferredLanguage: preferredLanguage || profile.autonomyPreferences.preferredLanguage,
    allowCaretakerScheduleEdits:
      allowCaretakerScheduleEdits !== undefined
        ? Boolean(allowCaretakerScheduleEdits)
        : profile.autonomyPreferences.allowCaretakerScheduleEdits,
    dailyCheckInMood: dailyCheckInMood || profile.autonomyPreferences.dailyCheckInMood,
    personalCareNote:
      personalCareNote !== undefined
        ? String(personalCareNote).trim()
        : profile.autonomyPreferences.personalCareNote,
  };

  saveDB(db);
  addAudit(
    actorName,
    'AUTONOMY_PREFERENCES_UPDATED',
    `${profile.name} updated personal care autonomy preferences (Mood: ${profile.autonomyPreferences.dailyCheckInMood}, Grace Window: ${profile.autonomyPreferences.gracePeriodMinutes}m)`
  );

  return res.json({
    success: true,
    profile: sanitizePublicProfile(profile),
  });
});

// 14. Proactive Email Reminder Dispatcher
app.post('/api/elderly-care/profiles/:id/send-reminder', (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    type = 'upcoming_dose',
    subject,
    customMessage,
    triggeredBy = 'Care Circle Coordinator',
  }: {
    type?: ReminderType;
    subject?: string;
    customMessage?: string;
    triggeredBy?: string;
  } = req.body;

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  const ist = getLiveISTTimestamp();
  const emailLog = buildProactiveEmailReminder(
    sanitizePublicProfile(profile),
    type,
    triggeredBy,
    `Today, ${ist.timeShort} IST`,
    subject,
    customMessage
  );

  profile.emailReminders.unshift(emailLog);
  saveDB(db);
  addAudit(
    triggeredBy,
    'EMAIL_REMINDER_DISPATCHED',
    `Sent ${type} email reminder "${emailLog.subject}" to ${emailLog.recipients.join(', ')}`
  );

  return res.json({
    success: true,
    profile: sanitizePublicProfile(profile),
    emailLog,
  });
});

// 15. Smart, Dynamic Elderly Care AI Assistant (Context-Aware Decision Engine + Gemini AI)
app.post('/api/elderly-care/profiles/:id/assistant', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { prompt = 'Provide a daily care and medication summary' } = req.body;

  const db = loadDB();
  const profile = db.elderlyProfiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Profile not found.' });
  }

  const publicProfile = sanitizePublicProfile(profile);
  const deterministicResult = generateContextualAssistantReply(publicProfile, String(prompt));
  const insights = evaluateElderlyContext(publicProfile);

  // Enhance with Gemini AI if GEMINI_API_KEY is configured and valid
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemContext = `You are SilverCare AI, a compassionate, clinical-grade Elderly Care & Medication Management Assistant.
Elderly Person: ${publicProfile.name} (${publicProfile.age} yrs, ${publicProfile.gender}, Blood Group ${publicProfile.bloodGroup})
Chronic Conditions: ${publicProfile.chronicConditions.join(', ')}
Allergies: ${publicProfile.allergies.join(', ')}
Latest Vitals: BP ${publicProfile.vitalsSummary.bp}, Sugar ${publicProfile.vitalsSummary.bloodSugar}, HR ${publicProfile.vitalsSummary.heartRate} bpm, SpO2 ${publicProfile.vitalsSummary.spo2}%
7-Day Adherence: ${publicProfile.adherenceRate7d}%
Senior Mood & Preference: ${publicProfile.autonomyPreferences.dailyCheckInMood} — "${publicProfile.autonomyPreferences.personalCareNote}"
Medications Today: ${publicProfile.medications
        .map(
          (m) =>
            `${m.medicineName} (${m.dosage} at ${m.timeSlot} ${m.mealTiming}, status: ${m.todayStatus}, ${m.pillsRemaining} pills left)`
        )
        .join('; ')}
Upcoming Appointments: ${publicProfile.appointments
        .map((a) => `${a.doctorName} (${a.speciality}) on ${a.appointmentDate} at ${a.appointmentTime}`)
        .join('; ')}
Respond in 2 to 4 clear, warm, practical sentences tailored to the user's question: "${prompt}".`;

      const aiResponse = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: systemContext,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
      ]);

      if (aiResponse && aiResponse.text) {
        return res.json({
          success: true,
          reply: aiResponse.text.trim(),
          contextTags: deterministicResult.contextTags,
          suggestedActions: deterministicResult.suggestedActions,
          insights,
          source: 'gemini-ai',
        });
      }
    } catch {
      // Fall back gracefully to deterministic clinical context engine
    }
  }

  return res.json({
    success: true,
    reply: deterministicResult.reply,
    contextTags: deterministicResult.contextTags,
    suggestedActions: deterministicResult.suggestedActions,
    insights,
    source: 'contextual-clinical-engine',
  });
});

// 16. Secure Backend-Only Adaption API Connection Verification
export function resolveAdaptionConfig(env: NodeJS.ProcessEnv = process.env): {
  apiKeyConfigured: boolean;
  baseUrl: string;
  baseUrlIsValidValue: boolean;
} {
  const rawKey = (env.ADAPTION_API_KEY || '').trim();
  const apiKeyConfigured =
    Boolean(rawKey) &&
    rawKey !== 'YOUR_ADAPTION_API_KEY' &&
    rawKey !== 'ADAPTION_API_KEY';

  const rawBaseUrl = (env.ADAPTION_API_BASE_URL || '').trim();
  const isValidUrlValue = /^https?:\/\//i.test(rawBaseUrl);
  const resolvedBaseUrl = (
    isValidUrlValue ? rawBaseUrl : 'https://api.prod.adaptionlabs.ai'
  ).replace(/\/+$/, '');

  return {
    apiKeyConfigured,
    baseUrl: resolvedBaseUrl,
    baseUrlIsValidValue: rawBaseUrl === '' ? true : isValidUrlValue,
  };
}

app.get('/api/adaption/test', async (_req: Request, res: Response) => {
  const adaptionKey = (process.env.ADAPTION_API_KEY || '').trim();
  const config = resolveAdaptionConfig(process.env);

  if (!config.apiKeyConfigured) {
    return res.status(503).json({
      success: false,
      configured: false,
      expectedVariables: ['ADAPTION_API_KEY', 'ADAPTION_API_BASE_URL'],
      apiKeyConfigured: false,
      baseUrl: config.baseUrl,
      baseUrlIsValidValue: config.baseUrlIsValidValue,
      message:
        'ADAPTION_API_KEY is not set yet. Please add ADAPTION_API_KEY and ADAPTION_API_BASE_URL in the Google AI Studio Secrets panel.',
    });
  }

  try {
    const response = await fetch(`${config.baseUrl}/health`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adaptionKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    return res.json({
      success: response.ok,
      configured: true,
      apiKeyConfigured: true,
      baseUrl: config.baseUrl,
      baseUrlIsValidValue: config.baseUrlIsValidValue,
      status: response.status,
      message: response.ok
        ? 'Adaption Labs environment variables verified and API connection succeeded.'
        : `Adaption Labs environment variables are loaded (HTTP ${response.status} from ${config.baseUrl}).`,
    });
  } catch {
    return res.status(502).json({
      success: false,
      configured: true,
      apiKeyConfigured: true,
      baseUrl: config.baseUrl,
      baseUrlIsValidValue: config.baseUrlIsValidValue,
      message: `Environment variables ADAPTION_API_KEY and ADAPTION_API_BASE_URL (${config.baseUrl}) are loaded in the backend, but the remote endpoint could not be reached.`,
    });
  }
});

// -------------------------------------------------------------
// VITE DEV SERVER OR PRODUCTION STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SilverCare] Elderly Care & Medication Management Platform running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}
