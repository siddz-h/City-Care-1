import {
  ElderlyProfile,
  MedicationScheduleItem,
  ClinicalInsight,
  EmailReminderLog,
  ReminderType,
} from '../types';

/**
 * Pure, deterministic clinical decision & adherence engine for the Elderly Care Platform.
 * Evaluates user context (medications, vitals, allergies, pill stock, upcoming appointments,
 * and senior autonomy preferences) to generate actionable recommendations and email alerts.
 */
export function calculateAdherenceScore(
  medications: MedicationScheduleItem[],
  weeklyHistory: { day: string; taken: number; total: number }[] = []
): number {
  if (!medications || medications.length === 0) return 100;

  const todayTaken = medications.filter((m) => m.todayStatus === 'taken').length;
  const todayMissed = medications.filter((m) => m.todayStatus === 'missed').length;
  const todayTotal = medications.length;

  const historicalTaken = weeklyHistory.slice(0, -1).reduce((sum, d) => sum + d.taken, 0);
  const historicalTotal = weeklyHistory.slice(0, -1).reduce((sum, d) => sum + d.total, 0);

  const totalTaken = historicalTaken + todayTaken;
  const totalScheduled = historicalTotal + todayTotal;

  if (totalScheduled === 0) return 100;
  const rawPercentage = (totalTaken / totalScheduled) * 100 - todayMissed * 3;
  return Math.max(0, Math.min(100, Math.round(rawPercentage)));
}

/**
 * Parses blood pressure string like "138/88 mmHg" into systolic and diastolic numbers.
 */
export function parseBloodPressure(bpStr: string): { systolic: number; diastolic: number } | null {
  const match = String(bpStr || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return null;
  return {
    systolic: Number(match[1]),
    diastolic: Number(match[2]),
  };
}

/**
 * Parses blood sugar string like "118 mg/dL" into a numeric value.
 */
export function parseBloodSugar(sugarStr: string): number | null {
  const match = String(sugarStr || '').match(/(\d{2,3})/);
  return match ? Number(match[1]) : null;
}

/**
 * Evaluates the elderly person's holistic context and returns prioritized clinical insights.
 */
export function evaluateElderlyContext(profile: ElderlyProfile): ClinicalInsight[] {
  const insights: ClinicalInsight[] = [];
  const meds = profile.medications || [];
  const appointments = profile.appointments || [];

  // 1. Check for missed medications
  const missedMeds = meds.filter((m) => m.todayStatus === 'missed');
  if (missedMeds.length > 0) {
    const names = missedMeds.map((m) => `${m.medicineName} (${m.timeSlot})`).join(', ');
    insights.push({
      id: 'insight-missed-dose',
      severity: 'critical',
      category: 'Adherence',
      title: `${missedMeds.length} Missed Medication Dose${missedMeds.length > 1 ? 's' : ''} Detected`,
      recommendation: `${profile.name} missed ${names}. Following the ${profile.autonomyPreferences.gracePeriodMinutes}-minute self-check-in window, family and caretakers should be notified via email.`,
      actionLabel: 'Send Missed Dose Email Alert',
      actionType: 'send_missed_email',
    });
  }

  // 2. Check for low medication stock (<= 5 pills)
  const lowStockMeds = meds.filter((m) => m.pillsRemaining <= 5);
  if (lowStockMeds.length > 0) {
    const stockList = lowStockMeds
      .map((m) => `${m.medicineName} (${m.pillsRemaining} left)`)
      .join(', ');
    insights.push({
      id: 'insight-low-stock',
      severity: 'warning',
      category: 'Refill',
      title: 'Pharmacy Refill Required Soon',
      recommendation: `Remaining supply is critically low for: ${stockList}. Notify family members to arrange a refill before doses run out.`,
      actionLabel: 'Dispatch Refill Reminder Email',
      actionType: 'send_refill_email',
    });
  }

  // 3. Context-aware Vitals vs Medication check
  const bp = parseBloodPressure(profile.vitalsSummary?.bp);
  if (bp) {
    if (bp.systolic >= 145 || bp.diastolic >= 92) {
      insights.push({
        id: 'insight-bp-elevated',
        severity: 'warning',
        category: 'Vitals',
        title: `Elevated Blood Pressure (${bp.systolic}/${bp.diastolic} mmHg)`,
        recommendation: `Ensure morning antihypertensive medication is taken on time, reduce dietary sodium today, and re-check BP after 30 minutes of rest.`,
        actionLabel: 'Log Updated Vitals',
        actionType: 'review_vitals',
      });
    } else if (bp.systolic < 95 || bp.diastolic < 60) {
      insights.push({
        id: 'insight-bp-low',
        severity: 'critical',
        category: 'Vitals',
        title: `Low Blood Pressure Alert (${bp.systolic}/${bp.diastolic} mmHg)`,
        recommendation: `Caution: Blood pressure is low. Advise ${profile.name} to sit or lie down and consult ${profile.primaryDoctorName} before taking additional BP-lowering tablets.`,
        actionLabel: 'Review Vitals',
        actionType: 'review_vitals',
      });
    }
  }

  const sugar = parseBloodSugar(profile.vitalsSummary?.bloodSugar);
  if (sugar !== null && (sugar > 160 || sugar < 75)) {
    insights.push({
      id: 'insight-sugar',
      severity: sugar < 75 ? 'critical' : 'warning',
      category: 'Vitals',
      title:
        sugar < 75
          ? `Low Blood Sugar Warning (${sugar} mg/dL)`
          : `Elevated Blood Sugar (${sugar} mg/dL)`,
      recommendation:
        sugar < 75
          ? `Provide 15g fast-acting carbohydrate (fruit juice or glucose water) immediately and delay diabetes tablets until sugar stabilizes.`
          : `Verify afternoon diabetes medication adherence and encourage light hydration and walking.`,
    });
  }

  // 4. Meal timing & Drug Interaction guidance
  const beforeFoodMeds = meds.filter(
    (m) => m.mealTiming === 'Before Food' && m.todayStatus === 'pending'
  );
  if (beforeFoodMeds.length > 0) {
    insights.push({
      id: 'insight-meal-timing',
      severity: 'info',
      category: 'Interaction',
      title: 'Empty-Stomach Absorption Reminder',
      recommendation: `${beforeFoodMeds.map((m) => m.medicineName).join(', ')} should be taken 30–45 minutes before meals for optimal absorption.`,
    });
  }

  // 5. Upcoming Doctor Appointments check
  const upcomingApts = appointments.filter((a) => a.status === 'upcoming');
  if (upcomingApts.length > 0) {
    const nextApt = upcomingApts[0];
    insights.push({
      id: 'insight-upcoming-apt',
      severity: 'info',
      category: 'Appointment',
      title: `Upcoming Visit: ${nextApt.doctorName} (${nextApt.appointmentDate} at ${nextApt.appointmentTime})`,
      recommendation: `Accompanied by ${nextApt.accompaniedBy}. Preparation: ${nextApt.preparationNotes}`,
      actionLabel: 'Email Appointment Reminder',
      actionType: 'send_appointment_email',
    });
  }

  return insights;
}

/**
 * Generates a context-aware Smart Care Assistant response when the user asks a question
 * or requests an analysis of the elderly person's daily care status.
 */
export function generateContextualAssistantReply(
  profile: ElderlyProfile,
  userPrompt: string
): {
  reply: string;
  contextTags: string[];
  suggestedActions: {
    label: string;
    action: 'send_missed_email' | 'send_upcoming_email' | 'send_appointment_email' | 'mark_next_taken';
  }[];
} {
  const q = String(userPrompt || '').toLowerCase();
  const meds = profile.medications || [];
  const taken = meds.filter((m) => m.todayStatus === 'taken');
  const pending = meds.filter((m) => m.todayStatus === 'pending');
  const missed = meds.filter((m) => m.todayStatus === 'missed');
  const lowStock = meds.filter((m) => m.pillsRemaining <= 5);
  const upcomingApts = (profile.appointments || []).filter((a) => a.status === 'upcoming');

  const contextTags = [
    `Patient: ${profile.name} (${profile.age}y)`,
    `Adherence: ${profile.adherenceRate7d}%`,
    `BP: ${profile.vitalsSummary.bp}`,
  ];

  const suggestedActions: {
    label: string;
    action: 'send_missed_email' | 'send_upcoming_email' | 'send_appointment_email' | 'mark_next_taken';
  }[] = [];

  if (missed.length > 0) {
    suggestedActions.push({
      label: `Email Family About Missed ${missed[0].medicineName}`,
      action: 'send_missed_email',
    });
  }
  if (pending.length > 0) {
    suggestedActions.push({
      label: `Mark ${pending[0].medicineName} Taken`,
      action: 'mark_next_taken',
    });
    suggestedActions.push({
      label: `Send Upcoming Dose Email`,
      action: 'send_upcoming_email',
    });
  }
  if (upcomingApts.length > 0) {
    suggestedActions.push({
      label: `Send Appointment Reminder Email`,
      action: 'send_appointment_email',
    });
  }

  if (q.includes('missed') || q.includes('forgot') || q.includes('skip') || q.includes('overdue')) {
    if (missed.length === 0) {
      return {
        reply: `Good news: ${profile.name} has zero missed medications today (${taken.length} of ${meds.length} taken). If a dose is ever missed, our system waits for ${profile.autonomyPreferences.gracePeriodMinutes} minutes (respecting ${profile.name}'s self-check-in preference) and then automatically emails ${profile.careCircle.filter((c) => c.receiveEmailAlerts).map((c) => c.name).join(', ')}.`,
        contextTags,
        suggestedActions,
      };
    }
    return {
      reply: `Attention needed: ${profile.name} missed ${missed.map((m) => `${m.medicineName} (${m.dosage}, scheduled for ${m.timeSlot} ${m.mealTiming})`).join(' and ')}. Do not double the next dose. Check if ${profile.name} has eaten recently, administer the single missed tablet if within the safe window, and notify the Care Circle.`,
      contextTags,
      suggestedActions,
    };
  }

  if (q.includes('appointment') || q.includes('doctor') || q.includes('visit') || q.includes('checkup')) {
    if (upcomingApts.length === 0) {
      return {
        reply: `${profile.name} currently has no pending doctor appointments scheduled. Primary physician on record is ${profile.primaryDoctorName}. You can add a new appointment in the Appointments & Routines section.`,
        contextTags,
        suggestedActions,
      };
    }
    const next = upcomingApts[0];
    return {
      reply: `${profile.name}'s next medical appointment is with ${next.doctorName} (${next.speciality}) at ${next.clinicOrHospital} on ${next.appointmentDate} at ${next.appointmentTime}. Purpose: ${next.purpose}. Accompanied by: ${next.accompaniedBy}. Preparation checklist: ${next.preparationNotes}.`,
      contextTags,
      suggestedActions,
    };
  }

  if (q.includes('food') || q.includes('meal') || q.includes('diet') || q.includes('interaction') || q.includes('allergy')) {
    const beforeFood = meds.filter((m) => m.mealTiming === 'Before Food');
    const afterFood = meds.filter((m) => m.mealTiming === 'After Food');
    return {
      reply: `Meal & Safety Guidance for ${profile.name} (Known Allergies: ${profile.allergies.join(', ') || 'None'}): ` +
        (beforeFood.length > 0
          ? `Take ${beforeFood.map((m) => `${m.medicineName} (${m.timeSlot})`).join(', ')} 30–45 minutes BEFORE meals. `
          : '') +
        (afterFood.length > 0
          ? `Take ${afterFood.map((m) => `${m.medicineName} (${m.timeSlot})`).join(', ')} AFTER food to prevent gastric irritation.`
          : ''),
      contextTags,
      suggestedActions,
    };
  }

  if (q.includes('vital') || q.includes('bp') || q.includes('pressure') || q.includes('sugar') || q.includes('glucose')) {
    return {
      reply: `Latest Vitals for ${profile.name} (${profile.vitalsSummary.lastUpdated}): Blood Pressure is ${profile.vitalsSummary.bp}, Blood Sugar is ${profile.vitalsSummary.bloodSugar}, Heart Rate is ${profile.vitalsSummary.heartRate} bpm, and SpO2 is ${profile.vitalsSummary.spo2}%. Chronic conditions managed: ${profile.chronicConditions.join(', ')}.`,
      contextTags,
      suggestedActions,
    };
  }

  // Default comprehensive daily care summary
  return {
    reply: `Daily Care Summary for ${profile.name} (${profile.age} yrs, Mood: ${profile.autonomyPreferences.dailyCheckInMood}): ` +
      `${taken.length}/${meds.length} medications taken today (${profile.adherenceRate7d}% 7-day adherence). ` +
      (pending.length > 0
        ? `Upcoming doses: ${pending.map((m) => `${m.medicineName} at ${m.timeSlot} (${m.mealTiming})`).join(', ')}. `
        : 'All doses for today are complete. ') +
      (missed.length > 0
        ? `Alert: ${missed.length} missed dose (${missed.map((m) => m.medicineName).join(', ')}). `
        : '') +
      (lowStock.length > 0
        ? `Refill notice: ${lowStock.map((m) => `${m.medicineName} has only ${m.pillsRemaining} pills left`).join(', ')}.`
        : ''),
    contextTags,
    suggestedActions,
  };
}

/**
 * Builds a structured proactive email reminder payload for the Care Circle.
 */
export function buildProactiveEmailReminder(
  profile: ElderlyProfile,
  type: ReminderType,
  triggeredBy: string,
  timestampStr: string,
  customSubject?: string,
  customMessage?: string
): EmailReminderLog {
  const recipients = (profile.careCircle || [])
    .filter((c) => c.receiveEmailAlerts && c.email)
    .map((c) => c.email);

  const missedMeds = (profile.medications || []).filter((m) => m.todayStatus === 'missed');
  const pendingMeds = (profile.medications || []).filter((m) => m.todayStatus === 'pending');
  const lowStockMeds = (profile.medications || []).filter((m) => m.pillsRemaining <= 5);
  const upcomingApts = (profile.appointments || []).filter((a) => a.status === 'upcoming');

  let subject = customSubject || '';
  let bodyPreview = customMessage || '';

  if (!subject || !bodyPreview) {
    if (type === 'missed_medication') {
      const medSummary =
        missedMeds.map((m) => `${m.medicineName} (${m.dosage} at ${m.timeSlot})`).join(', ') ||
        'Scheduled Daily Medication';
      subject = `[URGENT CARE ALERT] Missed Medication for ${profile.name}: ${medSummary}`;
      bodyPreview = `Proactive Care Circle Alert: ${profile.name} (${profile.age} yrs) has a missed dose of ${medSummary}. Following ${profile.name}'s ${profile.autonomyPreferences.gracePeriodMinutes}-minute self-check-in grace period, this email has been sent to family and caretakers. Emergency Contact: ${profile.emergencyContact}.`;
    } else if (type === 'appointment_reminder') {
      const nextApt = upcomingApts[0];
      subject = nextApt
        ? `[APPOINTMENT REMINDER] ${profile.name} — ${nextApt.doctorName} on ${nextApt.appointmentDate} at ${nextApt.appointmentTime}`
        : `[APPOINTMENT REMINDER] Upcoming Medical Checkup for ${profile.name}`;
      bodyPreview = nextApt
        ? `Medical Appointment Reminder: ${profile.name} is scheduled to visit ${nextApt.doctorName} (${nextApt.speciality}) at ${nextApt.clinicOrHospital} on ${nextApt.appointmentDate} at ${nextApt.appointmentTime}. Accompanied by: ${nextApt.accompaniedBy}. Preparation: ${nextApt.preparationNotes}.`
        : `Reminder: ${profile.name} has an upcoming routine checkup with ${profile.primaryDoctorName}.`;
    } else if (type === 'refill_alert') {
      const refillList =
        lowStockMeds.map((m) => `${m.medicineName} (${m.pillsRemaining} tablets left)`).join(', ') ||
        'Daily Prescription Medicines';
      subject = `[REFILL ALERT] Low Medication Supply for ${profile.name}`;
      bodyPreview = `Pharmacy Refill Reminder: ${refillList} for ${profile.name} is running low. Please arrange a refill so daily adherence is uninterrupted.`;
    } else {
      const nextMed = pendingMeds[0] || profile.medications[0];
      subject = `[UPCOMING DOSE REMINDER] ${
        nextMed ? `${nextMed.medicineName} at ${nextMed.timeSlot}` : 'Scheduled Medication'
      } — ${profile.name}`;
      bodyPreview = nextMed
        ? `Upcoming Medication Reminder: ${profile.name} is scheduled to take ${nextMed.medicineName} (${nextMed.dosage}, ${nextMed.mealTiming}) at ${nextMed.timeSlot} for ${nextMed.purpose}.`
        : `Scheduled medication reminder for ${profile.name}.`;
    }
  }

  return {
    id: `em-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    elderlyId: profile.id,
    type,
    subject,
    recipients: recipients.length > 0 ? recipients : ['siddheshhote@gmail.com'],
    bodyPreview,
    sentAt: timestampStr,
    status: 'delivered',
    triggeredBy,
  };
}

/**
 * Proactively evaluates a senior profile for missed medications, upcoming doses,
 * and upcoming medical appointments and returns newly generated email reminders
 * that have not yet been dispatched.
 */
export function runProactiveReminderSweep(
  profile: ElderlyProfile,
  timestampStr: string
): EmailReminderLog[] {
  const generated: EmailReminderLog[] = [];
  const existingSubjects = new Set((profile.emailReminders || []).map((e) => e.subject));

  // 1. Check missed medications
  const missedMeds = (profile.medications || []).filter((m) => m.todayStatus === 'missed');
  if (missedMeds.length > 0) {
    const missedLog = buildProactiveEmailReminder(
      profile,
      'missed_medication',
      'Automated Proactive Watchdog',
      timestampStr
    );
    if (!existingSubjects.has(missedLog.subject)) {
      generated.push(missedLog);
      existingSubjects.add(missedLog.subject);
    }
  }

  // 2. Check upcoming doses
  const pendingMeds = (profile.medications || []).filter((m) => m.todayStatus === 'pending');
  if (pendingMeds.length > 0) {
    const upcomingLog = buildProactiveEmailReminder(
      profile,
      'upcoming_dose',
      'Automated Proactive Dose Scheduler',
      timestampStr
    );
    if (!existingSubjects.has(upcomingLog.subject)) {
      generated.push(upcomingLog);
      existingSubjects.add(upcomingLog.subject);
    }
  }

  // 3. Check upcoming medical appointments
  const unremindedApts = (profile.appointments || []).filter(
    (a) => a.status === 'upcoming' && !a.reminderEmailSent
  );
  if (unremindedApts.length > 0) {
    const aptLog = buildProactiveEmailReminder(
      profile,
      'appointment_reminder',
      'Automated Appointment Notifier',
      timestampStr
    );
    if (!existingSubjects.has(aptLog.subject)) {
      generated.push(aptLog);
      existingSubjects.add(aptLog.subject);
    }
  }

  return generated;
}

