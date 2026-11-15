import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAdherenceScore,
  parseBloodPressure,
  parseBloodSugar,
  evaluateElderlyContext,
  generateContextualAssistantReply,
  buildProactiveEmailReminder,
} from '../src/utils/clinicalDecisionEngine.js';
import {
  hashPasscode,
  verifyPasscodeTimingSafe,
  issueCareSessionToken,
  verifyCareCircleRequestAuth,
  verifyCareCircleRolePermission,
  resolveAdaptionConfig,
} from '../server.js';
import { ElderlyProfile } from '../src/types/index.js';

const mockProfile: ElderlyProfile = {
  id: 'elder-test-1',
  name: 'Rameshwar Patil',
  age: 72,
  gender: 'Male',
  bloodGroup: 'B+',
  city: 'Pune',
  passcodeHint: '1954',
  chronicConditions: ['Hypertension', 'Type 2 Diabetes'],
  allergies: ['Sulfa Drugs'],
  primaryDoctorName: 'Dr. Rajeshwari Deshmukh',
  emergencyContact: '+91 98230 44551',
  adherenceRate7d: 90,
  weeklyHistory: [
    { day: 'Mon', taken: 4, total: 4 },
    { day: 'Tue', taken: 4, total: 4 },
    { day: 'Sun', taken: 2, total: 4 },
  ],
  vitalsSummary: {
    bp: '150/95 mmHg',
    bloodSugar: '114 mg/dL',
    heartRate: 74,
    spo2: 98,
    lastUpdated: 'Today, 08:00 AM IST',
  },
  autonomyPreferences: {
    gracePeriodMinutes: 30,
    voiceReadoutEnabled: true,
    preferredLanguage: 'en-IN',
    allowCaretakerScheduleEdits: true,
    dailyCheckInMood: 'Comfortable',
    personalCareNote: 'Prefers morning medication after warm water.',
  },
  careCircle: [
    {
      id: 'cc-1',
      name: 'Rameshwar Patil',
      relation: 'Elderly Self',
      email: 'rameshwar@silvercare.org',
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
      name: 'Meera Joshi',
      relation: 'Family Member',
      email: 'meera@silvercare.org',
      phone: '+91 98230 99887',
      canEditMedications: false,
      receiveEmailAlerts: true,
    },
  ],
  medications: [
    {
      id: 'med-1',
      medicineName: 'Telmisartan 40mg',
      dosage: '1 Tablet',
      purpose: 'Blood Pressure',
      timeSlot: '08:00 AM',
      period: 'Morning',
      mealTiming: 'After Food',
      prescribedBy: 'Dr. Rajeshwari Deshmukh',
      pillsRemaining: 18,
      todayStatus: 'taken',
    },
    {
      id: 'med-2',
      medicineName: 'Atorvastatin 10mg',
      dosage: '1 Tablet',
      purpose: 'Cholesterol',
      timeSlot: '09:00 PM',
      period: 'Night',
      mealTiming: 'After Food',
      prescribedBy: 'Dr. Rajeshwari Deshmukh',
      pillsRemaining: 3,
      todayStatus: 'missed',
    },
  ],
  appointments: [
    {
      id: 'apt-1',
      doctorName: 'Dr. Rajeshwari Deshmukh',
      speciality: 'Cardiology',
      clinicOrHospital: 'Sahyadri Senior Heart Clinic',
      appointmentDate: '2026-11-18',
      appointmentTime: '10:30 AM',
      purpose: 'Monthly BP Checkup',
      status: 'upcoming',
      preparationNotes: 'Bring BP diary.',
      accompaniedBy: 'Siddhesh Hote',
      reminderEmailSent: true,
    },
  ],
  routines: [
    {
      id: 'rt-1',
      title: 'Morning Walk',
      time: '07:30 AM',
      category: 'Exercise',
      completed: true,
    },
  ],
  emailReminders: [],
};

describe('Elderly Care & Medication Management Platform — Unit & Integration Tests', () => {
  it('1. Verifies Care Circle passcodes using timing-safe SHA-256 hashing', () => {
    const hash = hashPasscode('1954');
    assert.equal(verifyPasscodeTimingSafe(hash, '1954'), true);
    assert.equal(verifyPasscodeTimingSafe(hash, '0000'), false);
    assert.equal(verifyPasscodeTimingSafe(hash, '2026'), false);
  });

  it('2. Calculates 7-day medication adherence rate accurately', () => {
    const score = calculateAdherenceScore(mockProfile.medications, mockProfile.weeklyHistory);
    assert.ok(score >= 70 && score <= 100, `Expected valid adherence score, got ${score}`);
  });

  it('3. Parses blood pressure and blood sugar strings accurately', () => {
    const bp = parseBloodPressure('150/95 mmHg');
    assert.deepEqual(bp, { systolic: 150, diastolic: 95 });
    const sugar = parseBloodSugar('114 mg/dL (Fasting)');
    assert.equal(sugar, 114);
  });

  it('4. Detects missed medications, low pill stock, and elevated BP in clinical decision engine', () => {
    const insights = evaluateElderlyContext(mockProfile);
    const categories = insights.map((i) => i.category);
    assert.ok(categories.includes('Adherence'), 'Should detect missed medication dose');
    assert.ok(categories.includes('Refill'), 'Should detect low pill stock (<= 5 tablets)');
    assert.ok(categories.includes('Vitals'), 'Should detect elevated blood pressure');
    assert.ok(categories.includes('Appointment'), 'Should include upcoming doctor appointment insight');
  });

  it('5. Builds proactive email reminders for missed medications and doctor appointments', () => {
    const missedEmail = buildProactiveEmailReminder(
      mockProfile,
      'missed_medication',
      'Automated Watchdog',
      'Today, 09:30 PM IST'
    );
    assert.ok(missedEmail.subject.includes('Atorvastatin 10mg'));
    assert.ok(missedEmail.recipients.includes('siddheshhote@gmail.com'));
    assert.equal(missedEmail.status, 'delivered');

    const aptEmail = buildProactiveEmailReminder(
      mockProfile,
      'appointment_reminder',
      'Appointment Scheduler',
      'Today, 10:00 AM IST'
    );
    assert.ok(aptEmail.subject.includes('Dr. Rajeshwari Deshmukh'));
  });

  it('6. Generates context-aware Smart Care Assistant responses for missed doses and appointments', () => {
    const missedResponse = generateContextualAssistantReply(
      mockProfile,
      'Are any medications missed today?'
    );
    assert.ok(missedResponse.reply.includes('Atorvastatin 10mg'));
    assert.ok(missedResponse.suggestedActions.some((a) => a.action === 'send_missed_email'));

    const aptResponse = generateContextualAssistantReply(
      mockProfile,
      'When is the next doctor appointment?'
    );
    assert.ok(aptResponse.reply.includes('Dr. Rajeshwari Deshmukh'));
    assert.ok(aptResponse.reply.includes('2026-11-18'));
  });

  it('7. Enforces server-side passcode & session token authorization on protected Care Circle requests', () => {
    const passcodeHash = hashPasscode('1954');
    const storedProfile = { id: mockProfile.id, passcodeHash };
    const validToken = issueCareSessionToken(mockProfile.id, passcodeHash);

    // Rejects unauthenticated requests
    assert.equal(verifyCareCircleRequestAuth(storedProfile, { headers: {}, body: {} }), false);
    assert.equal(
      verifyCareCircleRequestAuth(storedProfile, { headers: { 'x-care-session': 'invalid-token' }, body: {} }),
      false
    );
    assert.equal(
      verifyCareCircleRequestAuth(storedProfile, { headers: { 'x-care-passcode': '0000' }, body: {} }),
      false
    );

    // Accepts valid session token or valid passcode header
    assert.equal(
      verifyCareCircleRequestAuth(storedProfile, { headers: { 'x-care-session': validToken }, body: {} }),
      true
    );
    assert.equal(
      verifyCareCircleRequestAuth(storedProfile, { headers: { 'x-care-passcode': '1954' }, body: {} }),
      true
    );
  });

  it('8. Enforces Care Circle role permissions and Senior Autonomy schedule edit locks', () => {
    // Authorized caretaker (canEditMedications: true) succeeds when allowCaretakerScheduleEdits is true
    const sonCheck = verifyCareCircleRolePermission(mockProfile, 'Siddhesh Hote (Son)');
    assert.equal(sonCheck.allowed, true);

    // View-only family member (canEditMedications: false) is blocked from modifying medication schedules
    const viewOnlyCheck = verifyCareCircleRolePermission(mockProfile, 'Meera Joshi (Family Member)');
    assert.equal(viewOnlyCheck.allowed, false);
    assert.ok(viewOnlyCheck.message?.includes('View-Only permission'));

    // When senior disables allowCaretakerScheduleEdits, caretakers are blocked while Elderly Self remains allowed
    const restrictedProfile: ElderlyProfile = {
      ...mockProfile,
      autonomyPreferences: {
        ...mockProfile.autonomyPreferences,
        allowCaretakerScheduleEdits: false,
      },
    };
    const blockedCaretaker = verifyCareCircleRolePermission(restrictedProfile, 'Siddhesh Hote (Son)');
    assert.equal(blockedCaretaker.allowed, false);

    const elderlySelfCheck = verifyCareCircleRolePermission(
      restrictedProfile,
      'Rameshwar Patil (Elderly Self)'
    );
    assert.equal(elderlySelfCheck.allowed, true);
  });

  it('9. Resolves ADAPTION_API_KEY and ADAPTION_API_BASE_URL environment variables accurately', () => {
    const validEnv = resolveAdaptionConfig({
      ADAPTION_API_KEY: 'test_adaption_secret_value',
      ADAPTION_API_BASE_URL: 'https://api.prod.adaptionlabs.ai/',
    });
    assert.equal(validEnv.apiKeyConfigured, true);
    assert.equal(validEnv.baseUrl, 'https://api.prod.adaptionlabs.ai');
    assert.equal(validEnv.baseUrlIsValidValue, true);

    // Guards against variable name accidentally pasted as value
    const mistakenEnv = resolveAdaptionConfig({
      ADAPTION_API_KEY: 'ADAPTION_API_KEY',
      ADAPTION_API_BASE_URL: 'ADAPTION_API_BASE_URL',
    });
    assert.equal(mistakenEnv.apiKeyConfigured, false);
    assert.equal(mistakenEnv.baseUrl, 'https://api.prod.adaptionlabs.ai');
    assert.equal(mistakenEnv.baseUrlIsValidValue, false);
  });
});
