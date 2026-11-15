export type CareRole = 'Elderly Self' | 'Family Member' | 'Primary Caretaker' | 'Son' | 'Daughter' | 'Spouse' | 'Nurse';
export type DosePeriod = 'Morning' | 'Afternoon' | 'Evening' | 'Night';
export type MealTiming = 'Before Food' | 'After Food' | 'With Food' | 'With Water';
export type DoseStatus = 'pending' | 'taken' | 'missed' | 'snoozed';
export type ReminderType = 'missed_medication' | 'upcoming_dose' | 'appointment_reminder' | 'refill_alert';
export type FontScale = 'normal' | 'large' | 'xlarge';

export interface CareCircleMember {
  id: string;
  name: string;
  relation: CareRole;
  email: string;
  phone: string;
  canEditMedications: boolean;
  receiveEmailAlerts: boolean;
}

export interface MedicationScheduleItem {
  id: string;
  medicineName: string;
  dosage: string;
  purpose: string;
  timeSlot: string; // e.g. "08:00 AM"
  period: DosePeriod;
  mealTiming: MealTiming;
  prescribedBy: string;
  pillsRemaining: number;
  todayStatus: DoseStatus;
  lastTakenAt?: string;
  notes?: string;
}

export interface MedicalAppointment {
  id: string;
  doctorName: string;
  speciality: string;
  clinicOrHospital: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // e.g. "10:30 AM"
  purpose: string;
  status: 'upcoming' | 'completed' | 'rescheduled' | 'cancelled';
  preparationNotes: string;
  accompaniedBy: string;
  reminderEmailSent: boolean;
}

export interface DailyRoutineTask {
  id: string;
  title: string;
  time: string;
  category: 'Vitals' | 'Exercise' | 'Hydration' | 'Nutrition' | 'Wellness';
  completed: boolean;
  completedBy?: string;
}

export interface EmailReminderLog {
  id: string;
  elderlyId: string;
  type: ReminderType;
  subject: string;
  recipients: string[];
  bodyPreview: string;
  sentAt: string;
  status: 'delivered' | 'queued';
  triggeredBy: string;
}

export interface ElderlyAutonomyPreferences {
  gracePeriodMinutes: number; // Minutes before family is emailed for a missed dose
  voiceReadoutEnabled: boolean;
  preferredLanguage: 'en-IN' | 'hi-IN' | 'mr-IN';
  allowCaretakerScheduleEdits: boolean;
  dailyCheckInMood: 'Energetic' | 'Comfortable' | 'Tired' | 'Needs Assistance';
  personalCareNote: string;
}

export interface VitalsSummary {
  bp: string; // e.g. "126/80 mmHg"
  bloodSugar: string; // e.g. "112 mg/dL"
  heartRate: number; // e.g. 74
  spo2: number; // e.g. 98
  lastUpdated: string;
}

export interface ClinicalInsight {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'Adherence' | 'Vitals' | 'Refill' | 'Appointment' | 'Interaction';
  title: string;
  recommendation: string;
  actionLabel?: string;
  actionType?: 'send_missed_email' | 'send_refill_email' | 'send_appointment_email' | 'review_vitals';
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  contextTags?: string[];
  suggestedActions?: {
    label: string;
    action: 'send_missed_email' | 'send_upcoming_email' | 'send_appointment_email' | 'mark_next_taken';
  }[];
}

export interface ElderlyProfile {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  city: string;
  passcodeHint: string; // Display hint for demo evaluation while passcode verification runs server-side
  chronicConditions: string[];
  allergies: string[];
  primaryDoctorName: string;
  emergencyContact: string;
  adherenceRate7d: number;
  weeklyHistory: { day: string; taken: number; total: number }[];
  vitalsSummary: VitalsSummary;
  autonomyPreferences: ElderlyAutonomyPreferences;
  careCircle: CareCircleMember[];
  medications: MedicationScheduleItem[];
  appointments: MedicalAppointment[];
  routines: DailyRoutineTask[];
  emailReminders: EmailReminderLog[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}
