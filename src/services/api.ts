import {
  ElderlyProfile,
  MedicationScheduleItem,
  MedicalAppointment,
  CareCircleMember,
  EmailReminderLog,
  AuditEntry,
  ReminderType,
  ClinicalInsight,
  ElderlyAutonomyPreferences,
} from '../types';

const BASE_URL = '/api';

// In-memory store for verified Care Circle session tokens per senior profile
const careSessionStore = new Map<string, string>();

function buildProtectedHeaders(elderlyId: string): Record<string, string> {
  const token = careSessionStore.get(elderlyId);
  return token
    ? { 'Content-Type': 'application/json', 'x-care-session': token }
    : { 'Content-Type': 'application/json' };
}

export const api = {
  clearCareSession(elderlyId: string): void {
    careSessionStore.delete(elderlyId);
  },

  async getProfiles(): Promise<{ profiles: ElderlyProfile[]; auditLogs: AuditEntry[] }> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles`);
    const data = await res.json();
    return {
      profiles: data.profiles || [],
      auditLogs: data.auditLogs || [],
    };
  },

  async createProfile(profileData: Record<string, unknown>): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to create senior profile');
    if (data.sessionToken && data.profile?.id) {
      careSessionStore.set(data.profile.id, data.sessionToken);
    }
    return data.profile;
  },

  async verifyPasscode(elderlyId: string, passcode: string): Promise<{ verified: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/verify-passcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = await res.json();
    if (data.verified && data.sessionToken) {
      careSessionStore.set(elderlyId, data.sessionToken);
    }
    return {
      verified: Boolean(data.verified),
      message: data.message || '',
    };
  },

  async updatePasscode(
    elderlyId: string,
    currentPasscode: string,
    newPasscode: string,
    actorName: string
  ): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/passcode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPasscode, newPasscode, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update passcode');
    if (data.sessionToken) {
      careSessionStore.set(elderlyId, data.sessionToken);
    }
    return data.profile;
  },

  async addMedication(
    elderlyId: string,
    med: Partial<MedicationScheduleItem>,
    actorName: string
  ): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/medications`, {
      method: 'POST',
      headers: buildProtectedHeaders(elderlyId),
      body: JSON.stringify({ ...med, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to add medication');
    return data.profile;
  },

  async updateMedication(
    elderlyId: string,
    medId: string,
    updates: Partial<MedicationScheduleItem>,
    actorName: string
  ): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/medications/${medId}`, {
      method: 'PUT',
      headers: buildProtectedHeaders(elderlyId),
      body: JSON.stringify({ ...updates, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update medication');
    return data.profile;
  },

  async deleteMedication(elderlyId: string, medId: string, actorName: string): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/medications/${medId}`, {
      method: 'DELETE',
      headers: buildProtectedHeaders(elderlyId),
      body: JSON.stringify({ actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to delete medication');
    return data.profile;
  },

  async markMedicationDose(
    elderlyId: string,
    medId: string,
    status: 'taken' | 'missed' | 'snoozed' | 'pending',
    actorName: string
  ): Promise<{ profile: ElderlyProfile; autoEmailLog?: EmailReminderLog }> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/medications/${medId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update dose status');
    return { profile: data.profile, autoEmailLog: data.autoEmailLog };
  },

  async addAppointment(
    elderlyId: string,
    appointment: Partial<MedicalAppointment>,
    actorName: string
  ): Promise<{ profile: ElderlyProfile; emailLog: EmailReminderLog }> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/appointments`, {
      method: 'POST',
      headers: buildProtectedHeaders(elderlyId),
      body: JSON.stringify({ ...appointment, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to schedule appointment');
    return { profile: data.profile, emailLog: data.emailLog };
  },

  async updateAppointmentStatus(
    elderlyId: string,
    aptId: string,
    status: 'upcoming' | 'completed' | 'rescheduled' | 'cancelled',
    actorName: string
  ): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/appointments/${aptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update appointment');
    return data.profile;
  },

  async updateAppointment(
    elderlyId: string,
    aptId: string,
    updates: Partial<MedicalAppointment>,
    actorName: string
  ): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/appointments/${aptId}`, {
      method: 'PUT',
      headers: buildProtectedHeaders(elderlyId),
      body: JSON.stringify({ ...updates, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to edit appointment');
    return data.profile;
  },

  async toggleRoutineTask(elderlyId: string, routineId: string, actorName: string): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/routines/${routineId}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to toggle routine');
    return data.profile;
  },

  async addRoutineTask(
    elderlyId: string,
    task: { title: string; time: string; category: string },
    actorName: string
  ): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/routines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to add routine');
    return data.profile;
  },

  async addCareCircleMember(
    elderlyId: string,
    member: Partial<CareCircleMember>,
    actorName: string
  ): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/care-circle`, {
      method: 'POST',
      headers: buildProtectedHeaders(elderlyId),
      body: JSON.stringify({ ...member, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to add Care Circle member');
    return data.profile;
  },

  async removeCareCircleMember(
    elderlyId: string,
    memberId: string,
    actorName: string
  ): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/care-circle/${memberId}`, {
      method: 'DELETE',
      headers: buildProtectedHeaders(elderlyId),
      body: JSON.stringify({ actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to remove Care Circle member');
    return data.profile;
  },

  async updateVitals(
    elderlyId: string,
    vitals: { bp: string; bloodSugar: string; heartRate: number; spo2: number },
    actorName: string
  ): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/vitals`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...vitals, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update vitals');
    return data.profile;
  },

  async updateAutonomyPreferences(
    elderlyId: string,
    prefs: Partial<ElderlyAutonomyPreferences>,
    actorName: string
  ): Promise<ElderlyProfile> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/autonomy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prefs, actorName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update preferences');
    return data.profile;
  },

  async sendEmailReminder(
    elderlyId: string,
    payload: {
      type: ReminderType;
      subject?: string;
      customMessage?: string;
      triggeredBy: string;
    }
  ): Promise<{ profile: ElderlyProfile; emailLog: EmailReminderLog }> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/send-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to send email reminder');
    return { profile: data.profile, emailLog: data.emailLog };
  },

  async askSmartCareAssistant(
    elderlyId: string,
    prompt: string
  ): Promise<{
    reply: string;
    contextTags: string[];
    suggestedActions: {
      label: string;
      action: 'send_missed_email' | 'send_upcoming_email' | 'send_appointment_email' | 'mark_next_taken';
    }[];
    insights: ClinicalInsight[];
    source: string;
  }> {
    const res = await fetch(`${BASE_URL}/elderly-care/profiles/${elderlyId}/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Assistant request failed');
    return data;
  },
};
