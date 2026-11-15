import React, { useState, useEffect } from 'react';
import {
  ElderlyProfile,
  MedicationScheduleItem,
  AuditEntry,
  ReminderType,
  DosePeriod,
  MealTiming,
  CareRole,
  FontScale,
} from '../types';
import { api } from '../services/api';
import { SmartCareAssistant } from './SmartCareAssistant';
import {
  HeartHandshake,
  Pill,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Lock,
  Unlock,
  Plus,
  Edit3,
  Trash2,
  Volume2,
  Users,
  CalendarCheck,
  Activity,
  ShieldCheck,
  Sparkles,
  Send,
  RefreshCw,
  UserPlus,
  Eye,
  Check,
  X,
  KeyRound,
  Stethoscope,
  Sliders,
} from 'lucide-react';

interface ElderlyCareHubProps {
  activeSection: 'overview' | 'medications' | 'appointments' | 'assistant' | 'care_circle';
  onSelectSection: (sec: 'overview' | 'medications' | 'appointments' | 'assistant' | 'care_circle') => void;
  fontScale: FontScale;
  onChangeFontScale: (scale: FontScale) => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  openAddMedModalTrigger: number;
}

export const ElderlyCareHub: React.FC<ElderlyCareHubProps> = ({
  activeSection,
  onSelectSection,
  fontScale,
  onChangeFontScale,
  highContrast,
  onToggleHighContrast,
  openAddMedModalTrigger,
}) => {
  const [profiles, setProfiles] = useState<ElderlyProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('elder-1');
  const [loading, setLoading] = useState<boolean>(true);
  const [bannerNotice, setBannerNotice] = useState<{
    text: string;
    tone: 'emerald' | 'amber' | 'blue';
  } | null>(null);

  // Passcode-Based Access State (starts locked by default until passcode is verified)
  const [unlockedProfiles, setUnlockedProfiles] = useState<Record<string, boolean>>({});
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [showPasscodeModal, setShowPasscodeModal] = useState<boolean>(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [activeCareActor, setActiveCareActor] = useState<string>('Rameshwar Patil (Elderly Self)');

  // Change Passcode Modal
  const [showChangePasscodeModal, setShowChangePasscodeModal] = useState<boolean>(false);
  const [passcodeChangeForm, setPasscodeChangeForm] = useState({
    currentPasscode: '',
    newPasscode: '',
  });

  // Medication Filter & Modal
  const [periodFilter, setPeriodFilter] = useState<'All' | DosePeriod>('All');
  const [showMedModal, setShowMedModal] = useState<boolean>(false);
  const [editingMed, setEditingMed] = useState<MedicationScheduleItem | null>(null);
  const [medForm, setMedForm] = useState({
    medicineName: '',
    dosage: '1 Tablet',
    purpose: 'Daily Care',
    timeSlot: '08:00 AM',
    period: 'Morning' as DosePeriod,
    mealTiming: 'After Food' as MealTiming,
    prescribedBy: 'Dr. Rajeshwari Deshmukh',
    pillsRemaining: 15,
    notes: '',
  });

  // Appointment Modal
  const [showAppointmentModal, setShowAppointmentModal] = useState<boolean>(false);
  const [appointmentForm, setAppointmentForm] = useState({
    doctorName: 'Dr. Rajeshwari Deshmukh',
    speciality: 'Cardiology & Geriatrics',
    clinicOrHospital: 'Sahyadri Senior Heart Clinic, Pune',
    appointmentDate: '2026-11-22',
    appointmentTime: '10:30 AM',
    purpose: 'Routine Blood Pressure & Medication Review',
    preparationNotes: 'Carry 7-day blood pressure and fasting sugar diary.',
    accompaniedBy: 'Siddhesh Hote (Son)',
  });

  // Care Circle Member Modal
  const [showMemberModal, setShowMemberModal] = useState<boolean>(false);
  const [memberForm, setMemberForm] = useState({
    name: '',
    relation: 'Family Member' as CareRole,
    email: '',
    phone: '+91 98230 00000',
    canEditMedications: true,
    receiveEmailAlerts: true,
  });

  // Vitals Modal
  const [showVitalsModal, setShowVitalsModal] = useState<boolean>(false);
  const [vitalsForm, setVitalsForm] = useState({
    bp: '126/80 mmHg',
    bloodSugar: '112 mg/dL',
    heartRate: 74,
    spo2: 98,
  });

  // New Senior Profile Modal
  const [showNewProfileModal, setShowNewProfileModal] = useState<boolean>(false);
  const [newProfileForm, setNewProfileForm] = useState({
    name: '',
    age: 70,
    gender: 'Male',
    bloodGroup: 'B+',
    city: 'Pune',
    passcode: '1234',
    chronicConditions: 'Hypertension, Diabetes',
    allergies: 'None',
    primaryDoctorName: 'Dr. Rajeshwari Deshmukh',
    emergencyContact: '+91 98230 44551',
    caretakerName: 'Siddhesh Hote',
    caretakerEmail: 'siddheshhote@gmail.com',
    caretakerRelation: 'Son',
  });

  // Routine Add Form & Action Loading States
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [newRoutineTime, setNewRoutineTime] = useState('06:30 PM');
  const [sendingReminderType, setSendingReminderType] = useState<string | null>(null);
  const [updatingMedId, setUpdatingMedId] = useState<string | null>(null);
  const [updatingAptId, setUpdatingAptId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const { profiles: list, auditLogs: logs } = await api.getProfiles();
      setProfiles(list);
      setAuditLogs(logs);
      if (list.length > 0 && !list.some((p) => p.id === selectedProfileId)) {
        setSelectedProfileId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load elderly care data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const activeProfile = profiles.find((p) => p.id === selectedProfileId) || profiles[0];
  const isUnlocked = activeProfile ? Boolean(unlockedProfiles[activeProfile.id]) : false;

  const activeCareMember = activeProfile?.careCircle.find(
    (c) => `${c.name} (${c.relation})` === activeCareActor || c.name === activeCareActor
  );
  const isElderlySelfActor =
    activeCareMember?.relation === 'Elderly Self' || activeCareActor.includes('Elderly Self');
  const canActorEditSchedule = Boolean(
    isElderlySelfActor ||
      (activeProfile?.autonomyPreferences.allowCaretakerScheduleEdits !== false &&
        activeCareMember?.canEditMedications !== false)
  );

  // Trigger from Header Primary CTA ("Add Medication")
  useEffect(() => {
    if (openAddMedModalTrigger > 0 && activeProfile) {
      if (!isUnlocked) {
        setShowPasscodeModal(true);
      } else if (!canActorEditSchedule) {
        showToast(
          `${activeCareActor} has View-Only permission or caretaker schedule edits are restricted by ${activeProfile.name}.`,
          'amber'
        );
      } else {
        setEditingMed(null);
        setMedForm({
          medicineName: '',
          dosage: '1 Tablet',
          purpose: 'Daily Care',
          timeSlot: '08:00 AM',
          period: 'Morning',
          mealTiming: 'After Food',
          prescribedBy: activeProfile.primaryDoctorName,
          pillsRemaining: 15,
          notes: '',
        });
        setShowMedModal(true);
      }
    }
  }, [openAddMedModalTrigger]);

  useEffect(() => {
    if (activeProfile && activeProfile.careCircle.length > 0) {
      const firstMember = activeProfile.careCircle[0];
      setActiveCareActor(`${firstMember.name} (${firstMember.relation})`);
      setVitalsForm({
        bp: activeProfile.vitalsSummary.bp,
        bloodSugar: activeProfile.vitalsSummary.bloodSugar,
        heartRate: activeProfile.vitalsSummary.heartRate,
        spo2: activeProfile.vitalsSummary.spo2 || 98,
      });
    }
  }, [activeProfile?.id]);

  // Escape key closes any open modal for keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPasscodeModal(false);
        setShowChangePasscodeModal(false);
        setShowMedModal(false);
        setShowAppointmentModal(false);
        setShowMemberModal(false);
        setShowVitalsModal(false);
        setShowNewProfileModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (text: string, tone: 'emerald' | 'amber' | 'blue' = 'emerald') => {
    setBannerNotice({ text, tone });
    setTimeout(() => {
      setBannerNotice((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  };

  const replaceProfileInState = (updated: ElderlyProfile) => {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  // Speech Synthesis Helper
  const handleSpeakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast('Speech synthesis is not available in this browser.', 'amber');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = activeProfile?.autonomyPreferences.preferredLanguage || 'en-IN';
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  };

  const handleSpeakDailySchedule = () => {
    if (!activeProfile) return;
    const pendingMeds = activeProfile.medications.filter((m) => m.todayStatus !== 'taken');
    const lang = activeProfile.autonomyPreferences.preferredLanguage;
    let speech = '';

    if (lang === 'hi-IN') {
      speech = `नमस्ते ${activeProfile.name}. आज आपकी कुल ${activeProfile.medications.length} दवाइयां निर्धारित हैं। `;
      if (pendingMeds.length > 0) {
        speech += `अगली दवाई ${pendingMeds[0].medicineName}, ${pendingMeds[0].timeSlot} बजे, ${
          pendingMeds[0].mealTiming === 'After Food' ? 'भोजन के बाद' : 'भोजन से पहले'
        } लेनी है।`;
      } else {
        speech += 'आज की सभी दवाइयां समय पर ली जा चुकी हैं।';
      }
    } else if (lang === 'mr-IN') {
      speech = `नमस्कार ${activeProfile.name}. आज तुमची एकूण ${activeProfile.medications.length} औषधे नियोजित आहेत. `;
      if (pendingMeds.length > 0) {
        speech += `पुढील औषध ${pendingMeds[0].medicineName}, ${pendingMeds[0].timeSlot} वाजता घ्यायचे आहे.`;
      } else {
        speech += 'आजची सर्व औषधे पूर्ण झाली आहेत.';
      }
    } else {
      speech = `Hello ${activeProfile.name}. You have ${activeProfile.medications.length} medications scheduled today. `;
      if (pendingMeds.length > 0) {
        speech += `Remaining doses today: ${pendingMeds
          .map((m) => `${m.medicineName}, ${m.dosage} at ${m.timeSlot} ${m.mealTiming}`)
          .join('. ')}.`;
      } else {
        speech += 'All medications for today have been marked as taken.';
      }
    }

    handleSpeakText(speech);
    showToast(`Reading ${activeProfile.name}'s daily medication schedule aloud.`, 'blue');
  };

  // Passcode Verification
  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || isSubmitting) return;
    setPasscodeError(null);
    setIsSubmitting(true);
    try {
      const res = await api.verifyPasscode(activeProfile.id, passcodeInput);
      if (res.verified) {
        setUnlockedProfiles((prev) => ({ ...prev, [activeProfile.id]: true }));
        setShowPasscodeModal(false);
        setPasscodeInput('');
        showToast(`Passcode verified! Shared Care Circle access unlocked for ${activeProfile.name}.`, 'emerald');
      } else {
        setPasscodeError(res.message || `Invalid passcode. Demo passcode is ${activeProfile.passcodeHint}`);
      }
    } catch (err: any) {
      setPasscodeError(err.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updated = await api.updatePasscode(
        activeProfile.id,
        passcodeChangeForm.currentPasscode,
        passcodeChangeForm.newPasscode,
        activeCareActor
      );
      replaceProfileInState(updated);
      setShowChangePasscodeModal(false);
      setPasscodeChangeForm({ currentPasscode: '', newPasscode: '' });
      showToast(`Updated Care Circle passcode for ${activeProfile.name}.`, 'emerald');
    } catch (err: any) {
      showToast(err.message || 'Could not update passcode', 'amber');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Medication Dose Actions
  const handleMarkDose = async (
    med: MedicationScheduleItem,
    status: 'taken' | 'missed' | 'snoozed' | 'pending'
  ) => {
    if (!activeProfile || updatingMedId === med.id) return;
    setUpdatingMedId(med.id);
    try {
      const { profile: updated, autoEmailLog } = await api.markMedicationDose(
        activeProfile.id,
        med.id,
        status,
        activeCareActor
      );
      replaceProfileInState(updated);
      if (status === 'taken') {
        showToast(`Marked ${med.medicineName} (${med.timeSlot}) as Taken by ${activeCareActor}.`, 'emerald');
      } else if (status === 'missed' && autoEmailLog) {
        showToast(
          `Missed dose logged! Proactive Email Alert dispatched to ${autoEmailLog.recipients.join(', ')}.`,
          'amber'
        );
      } else {
        showToast(`Updated ${med.medicineName} status to ${status}.`, 'blue');
      }
    } catch (err: any) {
      showToast(err.message || 'Could not update medication status', 'amber');
    } finally {
      setUpdatingMedId(null);
    }
  };

  const handleMarkNextPendingTaken = async () => {
    if (!activeProfile) return;
    const nextPending = activeProfile.medications.find((m) => m.todayStatus === 'pending');
    if (!nextPending) {
      showToast('All pending medications for today are already taken!', 'emerald');
      return;
    }
    await handleMarkDose(nextPending, 'taken');
  };

  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || isSubmitting) return;
    if (!isUnlocked) {
      setShowPasscodeModal(true);
      return;
    }
    if (!canActorEditSchedule) {
      showToast(
        `${activeCareActor} does not have permission to edit ${activeProfile.name}'s medication schedule.`,
        'amber'
      );
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingMed) {
        const updated = await api.updateMedication(activeProfile.id, editingMed.id, medForm, activeCareActor);
        replaceProfileInState(updated);
        showToast(`Updated schedule for ${medForm.medicineName}.`, 'emerald');
      } else {
        const updated = await api.addMedication(activeProfile.id, medForm, activeCareActor);
        replaceProfileInState(updated);
        showToast(`Added ${medForm.medicineName} (${medForm.timeSlot}) to ${activeProfile.name}'s schedule.`, 'emerald');
      }
      setShowMedModal(false);
      setEditingMed(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to save medication', 'amber');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMedication = async (med: MedicationScheduleItem) => {
    if (!activeProfile || updatingMedId === med.id) return;
    if (!isUnlocked) {
      setShowPasscodeModal(true);
      return;
    }
    if (!canActorEditSchedule) {
      showToast(
        `${activeCareActor} does not have permission to delete from ${activeProfile.name}'s medication schedule.`,
        'amber'
      );
      return;
    }
    setUpdatingMedId(med.id);
    try {
      const updated = await api.deleteMedication(activeProfile.id, med.id, activeCareActor);
      replaceProfileInState(updated);
      showToast(`Removed ${med.medicineName} from schedule.`, 'blue');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete medication', 'amber');
    } finally {
      setUpdatingMedId(null);
    }
  };

  // Schedule Medical Appointment
  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || isSubmitting) return;
    if (!isUnlocked) {
      setShowPasscodeModal(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const { profile: updated, emailLog } = await api.addAppointment(
        activeProfile.id,
        appointmentForm,
        activeCareActor
      );
      replaceProfileInState(updated);
      setShowAppointmentModal(false);
      showToast(
        `Appointment scheduled & confirmation email sent to ${emailLog.recipients.join(', ')}.`,
        'emerald'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to schedule appointment', 'amber');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAppointmentStatus = async (
    aptId: string,
    status: 'upcoming' | 'completed' | 'cancelled'
  ) => {
    if (!activeProfile || updatingAptId === aptId) return;
    setUpdatingAptId(aptId);
    try {
      const updated = await api.updateAppointmentStatus(activeProfile.id, aptId, status, activeCareActor);
      replaceProfileInState(updated);
      showToast(`Updated appointment status to ${status}.`, 'blue');
    } catch (err: any) {
      showToast(err.message || 'Failed to update appointment', 'amber');
    } finally {
      setUpdatingAptId(null);
    }
  };

  // Routines
  const handleToggleRoutine = async (routineId: string) => {
    if (!activeProfile) return;
    try {
      const updated = await api.toggleRoutineTask(activeProfile.id, routineId, activeCareActor);
      replaceProfileInState(updated);
    } catch (err: any) {
      showToast(err.message || 'Failed to update routine', 'amber');
    }
  };

  const handleAddRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || !newRoutineTitle.trim()) return;
    try {
      const updated = await api.addRoutineTask(
        activeProfile.id,
        { title: newRoutineTitle.trim(), time: newRoutineTime, category: 'Wellness' },
        activeCareActor
      );
      replaceProfileInState(updated);
      setNewRoutineTitle('');
      showToast('Added daily healthcare routine.', 'emerald');
    } catch (err: any) {
      showToast(err.message || 'Could not add routine', 'amber');
    }
  };

  // Care Circle Member Add
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || isSubmitting) return;
    if (!isUnlocked) {
      setShowPasscodeModal(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await api.addCareCircleMember(activeProfile.id, memberForm, activeCareActor);
      replaceProfileInState(updated);
      setShowMemberModal(false);
      setMemberForm({
        name: '',
        relation: 'Family Member',
        email: '',
        phone: '+91 98230 00000',
        canEditMedications: true,
        receiveEmailAlerts: true,
      });
      showToast(`Added ${memberForm.name} to ${activeProfile.name}'s Care Circle.`, 'emerald');
    } catch (err: any) {
      showToast(err.message || 'Could not add Care Circle member', 'amber');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Vitals Update
  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updated = await api.updateVitals(activeProfile.id, vitalsForm, activeCareActor);
      replaceProfileInState(updated);
      setShowVitalsModal(false);
      showToast(`Logged updated vitals for ${activeProfile.name}.`, 'emerald');
    } catch (err: any) {
      showToast(err.message || 'Could not update vitals', 'amber');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Autonomy Preferences Update
  const handleUpdateAutonomy = async (
    updates: Partial<ElderlyProfile['autonomyPreferences']>
  ) => {
    if (!activeProfile) return;
    try {
      const updated = await api.updateAutonomyPreferences(activeProfile.id, updates, activeCareActor);
      replaceProfileInState(updated);
      showToast(`Saved ${activeProfile.name}'s personal care preferences.`, 'emerald');
    } catch (err: any) {
      showToast(err.message || 'Could not save preferences', 'amber');
    }
  };

  // Create Senior Profile
  const handleCreateSeniorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const created = await api.createProfile({
        ...newProfileForm,
        chronicConditions: newProfileForm.chronicConditions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        allergies: newProfileForm.allergies
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setProfiles((prev) => [created, ...prev]);
      setUnlockedProfiles((prev) => ({ ...prev, [created.id]: true }));
      setSelectedProfileId(created.id);
      setShowNewProfileModal(false);
      showToast(`Created senior care profile for ${created.name} (Passcode: ${created.passcodeHint}).`, 'emerald');
    } catch (err: any) {
      showToast(err.message || 'Could not create profile', 'amber');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Proactive Email Reminder Dispatch
  const handleTriggerEmailReminder = async (type: ReminderType) => {
    if (!activeProfile || sendingReminderType !== null) return;
    setSendingReminderType(type);
    try {
      const { profile: updated, emailLog } = await api.sendEmailReminder(activeProfile.id, {
        type,
        triggeredBy: activeCareActor,
      });
      replaceProfileInState(updated);
      showToast(
        `Email Reminder Dispatched: "${emailLog.subject}" → ${emailLog.recipients.join(', ')}`,
        'emerald'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch email reminder', 'amber');
    } finally {
      setSendingReminderType(null);
    }
  };

  if (loading || !activeProfile) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="glass-card rounded-3xl p-12 text-center space-y-3"
      >
        <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-800">
          Loading Elderly Care &amp; Medication Management Ecosystem...
        </p>
      </div>
    );
  }

  const filteredMeds = activeProfile.medications.filter(
    (m) => periodFilter === 'All' || m.period === periodFilter
  );
  const takenCount = activeProfile.medications.filter((m) => m.todayStatus === 'taken').length;
  const missedCount = activeProfile.medications.filter((m) => m.todayStatus === 'missed').length;
  const pendingCount = activeProfile.medications.filter((m) => m.todayStatus === 'pending').length;
  const lowStockMeds = activeProfile.medications.filter((m) => m.pillsRemaining <= 5);
  const upcomingAppointments = activeProfile.appointments.filter((a) => a.status === 'upcoming');

  const fontSizeClass =
    fontScale === 'xlarge' ? 'text-lg' : fontScale === 'large' ? 'text-base' : 'text-sm';

  return (
    <div className={`space-y-8 ${fontSizeClass}`}>
      {/* Accessible Status Banner */}
      {bannerNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`px-5 py-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-3 ${
            bannerNotice.tone === 'emerald'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : bannerNotice.tone === 'amber'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-blue-50 border-blue-300 text-blue-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{bannerNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerNotice(null)}
            aria-label="Dismiss notification"
            className="text-slate-600 hover:text-slate-950 font-bold cursor-pointer px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Section: Shared Elderly Profile, Passcode Gate & Senior Accessibility Controls */}
      <section
        aria-labelledby="hero-elderly-heading"
        className={`rounded-3xl text-white p-5 sm:p-8 lg:p-9 shadow-xl ${
          highContrast ? 'bg-black border-2 border-yellow-400' : 'glass-wood-panel'
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Left 7 Columns */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#A3E635] font-semibold">
                <span>Elderly Care &amp; Medication Management</span>
                <span aria-hidden="true">·</span>
                <span>Passcode-Protected Care Circle</span>
              </div>

              <h1
                id="hero-elderly-heading"
                className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Daily Care &amp; Medication Schedule for{' '}
                <span className="text-[#A3E635]">{activeProfile.name}</span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-2xl">
                Shared care profile for {activeProfile.name}, family members, and caretakers to manage
                daily doses, track adherence, coordinate doctor visits, and send proactive email alerts.
              </p>
            </div>

            {/* Profile Switcher + Passcode Gate + Accessibility Toolbar */}
            <div className="space-y-3.5 pt-1">
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Select elderly profile"
              >
                {profiles.map((prof) => {
                  const isSelected = prof.id === activeProfile.id;
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedProfileId(prof.id)}
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-[#A3E635] text-slate-950 shadow-sm'
                          : 'bg-white/10 hover:bg-white/20 text-slate-100 border border-white/15'
                      }`}
                    >
                      <HeartHandshake className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        {prof.name} ({prof.age} yrs)
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowNewProfileModal(true)}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#A3E635] border border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Add Senior Profile</span>
                </button>
              </div>

              {/* Active Care Circle Member Selector & Passcode Controls */}
              <div className="p-3.5 rounded-2xl bg-white/[0.07] border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Users className="w-4 h-4 text-[#A3E635] shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="active-care-member-select"
                      className="text-[11px] text-slate-300 block"
                    >
                      Acting Care Circle Member:
                    </label>
                    <select
                      id="active-care-member-select"
                      value={activeCareActor}
                      onChange={(e) => setActiveCareActor(e.target.value)}
                      className="mt-0.5 w-full bg-transparent text-white font-bold text-xs sm:text-sm focus:outline-none cursor-pointer truncate"
                    >
                      {activeProfile.careCircle.map((c) => (
                        <option
                          key={c.id}
                          value={`${c.name} (${c.relation})`}
                          className="bg-slate-900 text-white"
                        >
                          {c.name} — {c.relation} ({c.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isUnlocked ? (
                    <button
                      type="button"
                      onClick={() => {
                        api.clearCareSession(activeProfile.id);
                        setUnlockedProfiles((prev) => ({ ...prev, [activeProfile.id]: false }));
                        showToast(`Locked schedule editing for ${activeProfile.name}.`, 'blue');
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      title="Click to lock Care Circle schedule editing"
                    >
                      <Unlock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Unlocked (Passcode: {activeProfile.passcodeHint})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPasscodeError(null);
                        setShowPasscodeModal(true);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Unlock Passcode</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSpeakDailySchedule}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#A3E635] shrink-0" aria-hidden="true" />
                    <span>Speak Schedule</span>
                  </button>
                </div>
              </div>

              {/* Senior Accessibility Bar: Font Size Scaler & High-Contrast Mode */}
              <div
                className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs"
                role="region"
                aria-label="Senior Accessibility Controls"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-300 font-semibold mr-1">Text Size:</span>
                  {(
                    [
                      { id: 'normal', label: '100%' },
                      { id: 'large', label: '115% Large' },
                      { id: 'xlarge', label: '130% Senior XL' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={fontScale === opt.id}
                      onClick={() => onChangeFontScale(opt.id)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors whitespace-nowrap ${
                        fontScale === opt.id
                          ? 'bg-[#A3E635] text-slate-950'
                          : 'bg-white/10 hover:bg-white/20 text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  aria-pressed={highContrast}
                  onClick={onToggleHighContrast}
                  className={`min-h-[34px] px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    highContrast
                      ? 'bg-yellow-400 text-black'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{highContrast ? 'High-Contrast: ON' : 'High-Contrast Mode'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Senior Clinical Vitals & Autonomy Summary */}
          <div className="lg:col-span-5 flex">
            <div className="w-full rounded-2xl bg-slate-900/90 border border-white/15 p-5 sm:p-6 flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3.5">
                <div className="min-w-0">
                  <div className="text-xs text-slate-300 truncate">
                    <span>Blood Group {activeProfile.bloodGroup}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{activeProfile.city}</span>
                    <span aria-hidden="true"> · </span>
                    <span>Mood: {activeProfile.autonomyPreferences.dailyCheckInMood}</span>
                  </div>
                  <h2 className="text-lg font-extrabold text-white mt-0.5 truncate">
                    {activeProfile.name}
                  </h2>
                  <p className="text-xs text-[#A3E635] font-medium mt-0.5 truncate">
                    {activeProfile.primaryDoctorName}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-2xl font-mono font-extrabold text-[#A3E635] tabular-nums block">
                    {activeProfile.adherenceRate7d}%
                  </span>
                  <span className="text-[11px] text-slate-300">7-Day Adherence</span>
                </div>
              </div>

              {/* Vitals Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10">
                  <span className="text-[11px] text-slate-300 block">BP</span>
                  <span className="text-xs font-mono font-bold text-white tabular-nums mt-0.5 block">
                    {activeProfile.vitalsSummary.bp}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10">
                  <span className="text-[11px] text-slate-300 block">Blood Sugar</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums mt-0.5 block">
                    {activeProfile.vitalsSummary.bloodSugar}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10">
                  <span className="text-[11px] text-slate-300 block">Heart Rate</span>
                  <span className="text-xs font-mono font-bold text-white tabular-nums mt-0.5 block">
                    {activeProfile.vitalsSummary.heartRate} bpm
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10">
                  <span className="text-[11px] text-slate-300 block">SpO2</span>
                  <span className="text-xs font-mono font-bold text-white tabular-nums mt-0.5 block">
                    {activeProfile.vitalsSummary.spo2}%
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-200">
                <div>
                  <span className="text-slate-400">Conditions: </span>
                  <span className="font-semibold text-white">
                    {activeProfile.chronicConditions.join(' · ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Allergies: </span>
                  <span className="font-semibold text-amber-300">
                    {activeProfile.allergies.join(' · ') || 'None'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
                <span className="text-slate-300">
                  Grace Window: {activeProfile.autonomyPreferences.gracePeriodMinutes} mins
                </span>
                <button
                  type="button"
                  onClick={() => setShowVitalsModal(true)}
                  className="min-h-[34px] px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#A3E635] font-bold cursor-pointer shrink-0 transition-colors"
                >
                  Log Daily Vitals →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Interactive KPI Row */}
      <section aria-label="Key Medication and Care Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onSelectSection('medications')}
          className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer"
        >
          <div>
            <span className="text-xs text-slate-600 font-semibold block">Doses Taken Today</span>
            <span className="text-2xl font-mono font-extrabold text-emerald-700 tabular-nums mt-1 block">
              {takenCount} / {activeProfile.medications.length}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {pendingCount} upcoming today
            </span>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('medications')}
          className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer"
        >
          <div>
            <span className="text-xs text-slate-600 font-semibold block">Missed Medications</span>
            <span
              className={`text-2xl font-mono font-extrabold tabular-nums mt-1 block ${
                missedCount > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {missedCount}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {missedCount > 0 ? 'Proactive email sent to family' : 'On track today'}
            </span>
          </div>
          <AlertTriangle
            className={`w-8 h-8 shrink-0 ${missedCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('appointments')}
          className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer"
        >
          <div>
            <span className="text-xs text-slate-600 font-semibold block">Upcoming Doctor Visits</span>
            <span className="text-2xl font-mono font-extrabold text-slate-900 tabular-nums mt-1 block">
              {upcomingAppointments.length}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {upcomingAppointments[0]
                ? `Next: ${upcomingAppointments[0].appointmentDate}`
                : 'No pending visits'}
            </span>
          </div>
          <Stethoscope className="w-8 h-8 text-blue-600 shrink-0" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('care_circle')}
          className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer"
        >
          <div>
            <span className="text-xs text-slate-600 font-semibold block">Email Reminders Sent</span>
            <span className="text-2xl font-mono font-extrabold text-blue-700 tabular-nums mt-1 block">
              {activeProfile.emailReminders.length}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {lowStockMeds.length > 0
                ? `${lowStockMeds.length} medicine low in stock`
                : `${activeProfile.careCircle.length} Care Circle members`}
            </span>
          </div>
          <Mail className="w-8 h-8 text-blue-600 shrink-0" aria-hidden="true" />
        </button>
      </section>

      {/* Smart Care Assistant & Context-Aware Clinical Decision Engine */}
      {(activeSection === 'overview' || activeSection === 'assistant') && (
        <SmartCareAssistant
          profile={activeProfile}
          activeActor={activeCareActor}
          onTriggerEmailReminder={handleTriggerEmailReminder}
          onMarkNextPendingTaken={handleMarkNextPendingTaken}
          onOpenVitalsModal={() => setShowVitalsModal(true)}
          onSpeakText={handleSpeakText}
        />
      )}

      {/* Main Workspace Grid (Balanced 12-Column Layout Across All 5 Navigation Tabs) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left 7 Columns */}
        <div className="lg:col-span-7 space-y-6 lg:space-y-8">
          {/* SECTION A: Daily Medication Schedule & Adherence Tracker */}
          {(activeSection === 'overview' ||
            activeSection === 'medications' ||
            activeSection === 'assistant') && (
            <section
              aria-labelledby="medication-schedule-heading"
              className="glass-card rounded-3xl p-5 sm:p-7 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h2
                    id="medication-schedule-heading"
                    className="text-base sm:text-xl font-extrabold text-slate-900 flex items-center gap-2"
                  >
                    <Pill className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
                    <span>Daily Medication Schedule</span>
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Mark doses taken, snooze, or log missed doses to notify the Care Circle.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!isUnlocked) {
                      setShowPasscodeModal(true);
                      return;
                    }
                    if (!canActorEditSchedule) {
                      showToast(
                        `${activeCareActor} has View-Only permission or caretaker schedule edits are restricted by ${activeProfile.name}.`,
                        'amber'
                      );
                      return;
                    }
                    setEditingMed(null);
                    setMedForm({
                      medicineName: '',
                      dosage: '1 Tablet',
                      purpose: 'Daily Care',
                      timeSlot: '08:00 AM',
                      period: 'Morning',
                      mealTiming: 'After Food',
                      prescribedBy: activeProfile.primaryDoctorName,
                      pillsRemaining: 15,
                      notes: '',
                    });
                    setShowMedModal(true);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#A3E635] text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Add Medication</span>
                </button>
              </div>

              {/* Period Filter Segmented Control */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto max-w-full"
                  role="group"
                  aria-label="Filter medications by time of day"
                >
                  {(['All', 'Morning', 'Afternoon', 'Evening', 'Night'] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      aria-pressed={periodFilter === period}
                      onClick={() => setPeriodFilter(period)}
                      className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        periodFilter === period
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-600 font-mono tabular-nums">
                  <span>{takenCount} Taken</span>
                  <span aria-hidden="true"> · </span>
                  <span>{pendingCount} Pending</span>
                  <span aria-hidden="true"> · </span>
                  <span className={missedCount > 0 ? 'text-rose-600 font-bold' : ''}>
                    {missedCount} Missed
                  </span>
                </div>
              </div>

              {/* Medication List */}
              <div className="space-y-3.5">
                {filteredMeds.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl space-y-2">
                    <Pill className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
                    <p className="text-sm font-bold text-slate-800">
                      No medications scheduled for {periodFilter}
                    </p>
                  </div>
                ) : (
                  filteredMeds.map((med) => {
                    const isTaken = med.todayStatus === 'taken';
                    const isMissed = med.todayStatus === 'missed';
                    const isLowStock = med.pillsRemaining <= 5;
                    const isBusy = updatingMedId === med.id;

                    return (
                      <article
                        key={med.id}
                        aria-label={`${med.medicineName} at ${med.timeSlot}`}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isTaken
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : isMissed
                            ? 'bg-rose-50/50 border-rose-200'
                            : 'bg-slate-50/70 border-slate-200/90'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <span className="font-mono font-bold text-slate-900 tabular-nums">
                                {med.timeSlot} ({med.period})
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-blue-700">{med.mealTiming}</span>
                              <span aria-hidden="true">·</span>
                              <span>{med.dosage}</span>
                              {isLowStock && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-amber-800 font-bold">
                                    Low Stock ({med.pillsRemaining} left)
                                  </span>
                                </>
                              )}
                            </div>

                            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                              {med.medicineName}
                            </h3>

                            <p className="text-xs text-slate-600">
                              <span className="font-semibold text-slate-800">{med.purpose}</span>
                              <span aria-hidden="true"> · </span>
                              <span>{med.prescribedBy}</span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono tabular-nums">
                                {med.pillsRemaining} tablets left
                              </span>
                            </p>

                            {med.notes && <p className="text-xs text-slate-600 pt-0.5">{med.notes}</p>}

                            {med.lastTakenAt && isTaken && (
                              <p className="text-xs font-semibold text-emerald-700 pt-0.5">
                                ✓ Taken today at {med.lastTakenAt}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                            <button
                              type="button"
                              aria-label={`Read instructions aloud for ${med.medicineName}`}
                              onClick={() =>
                                handleSpeakText(
                                  `${med.medicineName}, ${med.dosage}. Scheduled at ${med.timeSlot}, ${med.mealTiming}. Purpose: ${med.purpose}. ${med.notes || ''}`
                                )
                              }
                              className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer flex items-center justify-center"
                              title="Speak medication instructions aloud"
                            >
                              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>

                            <button
                              type="button"
                              aria-label={`Edit schedule for ${med.medicineName}`}
                              onClick={() => {
                                if (!isUnlocked) {
                                  setShowPasscodeModal(true);
                                  return;
                                }
                                if (!canActorEditSchedule) {
                                  showToast(
                                    `${activeCareActor} has View-Only permission or caretaker schedule edits are restricted by ${activeProfile.name}.`,
                                    'amber'
                                  );
                                  return;
                                }
                                setEditingMed(med);
                                setMedForm({
                                  medicineName: med.medicineName,
                                  dosage: med.dosage,
                                  purpose: med.purpose,
                                  timeSlot: med.timeSlot,
                                  period: med.period,
                                  mealTiming: med.mealTiming,
                                  prescribedBy: med.prescribedBy,
                                  pillsRemaining: med.pillsRemaining,
                                  notes: med.notes || '',
                                });
                                setShowMedModal(true);
                              }}
                              className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer flex items-center justify-center"
                              title="Edit Medication Schedule"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              aria-label={`Delete ${med.medicineName} from schedule`}
                              onClick={() => handleDeleteMedication(med)}
                              className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-white hover:bg-rose-50 disabled:opacity-50 border border-slate-200 text-slate-500 hover:text-rose-600 cursor-pointer flex items-center justify-center"
                              title="Delete Medication"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {/* Dose Status Controls */}
                        <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700">
                            Status:{' '}
                            <span
                              className={
                                isTaken
                                  ? 'text-emerald-700'
                                  : isMissed
                                  ? 'text-rose-600'
                                  : 'text-amber-700'
                              }
                            >
                              {isBusy ? 'UPDATING...' : med.todayStatus.toUpperCase()}
                            </span>
                          </span>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleMarkDose(med, 'taken')}
                              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all whitespace-nowrap ${
                                isTaken
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>{isTaken ? 'Taken ✓' : 'Mark Taken'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleMarkDose(med, 'snoozed')}
                              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all whitespace-nowrap ${
                                med.todayStatus === 'snoozed'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-white hover:bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Snooze 15m</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleMarkDose(med, 'missed')}
                              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all whitespace-nowrap ${
                                isMissed
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-white hover:bg-rose-50 text-rose-600 border border-rose-200'
                              }`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Mark Missed</span>
                            </button>

                            {med.todayStatus !== 'pending' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleMarkDose(med, 'pending')}
                                className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              {/* 7-Day Adherence Matrix */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-700">
                    7-Day Adherence History
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
                    {activeProfile.adherenceRate7d}% Weekly Consistency
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {activeProfile.weeklyHistory.map((item) => {
                    const pct = item.total > 0 ? Math.round((item.taken / item.total) * 100) : 100;
                    return (
                      <div
                        key={item.day}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-center space-y-0.5"
                      >
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          {item.day}
                        </span>
                        <span
                          className={`text-xs font-mono font-extrabold tabular-nums block ${
                            pct === 100 ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {item.taken}/{item.total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* SECTION B: Upcoming Medical Appointments & Daily Healthcare Routines */}
          {(activeSection === 'overview' || activeSection === 'appointments') && (
            <>
              <section
                aria-labelledby="appointments-heading"
                className="glass-card rounded-3xl p-5 sm:p-7 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <h2
                      id="appointments-heading"
                      className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2"
                    >
                      <Stethoscope className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
                      <span>Medical Appointments</span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Upcoming clinic visits and family accompaniment details.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isUnlocked) {
                        setShowPasscodeModal(true);
                        return;
                      }
                      setShowAppointmentModal(true);
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#A3E635] hover:bg-[#84CC16] text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Schedule Doctor Visit</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {activeProfile.appointments.length === 0 ? (
                    <p className="text-xs text-slate-600 py-6 text-center">
                      No medical appointments scheduled yet.
                    </p>
                  ) : (
                    activeProfile.appointments.map((apt) => {
                      const isAptBusy = updatingAptId === apt.id;
                      return (
                        <div
                          key={apt.id}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5 text-xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 text-slate-600 font-mono tabular-nums">
                                <span className="font-bold text-slate-900">{apt.appointmentDate}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-bold text-blue-700">{apt.appointmentTime}</span>
                                <span aria-hidden="true">·</span>
                                <span>{apt.clinicOrHospital}</span>
                              </div>
                              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
                                {apt.doctorName} — {apt.speciality}
                              </h3>
                            </div>

                            <span
                              className={`font-bold uppercase text-[11px] shrink-0 ${
                                apt.status === 'completed'
                                  ? 'text-slate-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {apt.status}
                            </span>
                          </div>

                          <p className="text-slate-700">
                            <strong>Purpose:</strong> {apt.purpose} · <strong>Accompanied By:</strong>{' '}
                            {apt.accompaniedBy}
                          </p>
                          <p className="text-slate-600">
                            <strong>Preparation:</strong> {apt.preparationNotes}
                          </p>

                          <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={sendingReminderType !== null}
                              onClick={() => handleTriggerEmailReminder('appointment_reminder')}
                              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 disabled:opacity-50 border border-blue-200 text-blue-700 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>
                                {sendingReminderType === 'appointment_reminder'
                                  ? 'Sending...'
                                  : 'Email Reminder'}
                              </span>
                            </button>

                            <div className="flex items-center gap-2">
                              {apt.status === 'upcoming' ? (
                                <button
                                  type="button"
                                  disabled={isAptBusy}
                                  onClick={() => handleUpdateAppointmentStatus(apt.id, 'completed')}
                                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span>{isAptBusy ? 'Updating...' : 'Mark Completed'}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isAptBusy}
                                  onClick={() => handleUpdateAppointmentStatus(apt.id, 'upcoming')}
                                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-800 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>{isAptBusy ? 'Updating...' : 'Reopen Visit'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Daily Healthcare Routines */}
              <section
                aria-labelledby="routines-heading"
                className="glass-card rounded-3xl p-5 sm:p-7 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
                  <div>
                    <h2
                      id="routines-heading"
                      className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2"
                    >
                      <Activity className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                      <span>Daily Healthcare Routines</span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Daily wellness habits for {activeProfile.name}.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-700 tabular-nums shrink-0">
                    {activeProfile.routines.filter((r) => r.completed).length}/
                    {activeProfile.routines.length} Done
                  </span>
                </div>

                <div className="space-y-2.5">
                  {activeProfile.routines.map((rt) => (
                    <div
                      key={rt.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={rt.completed}
                      onClick={() => handleToggleRoutine(rt.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggleRoutine(rt.id);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        rt.completed
                          ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                          : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            rt.completed
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-slate-300 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-xs sm:text-sm font-bold truncate ${
                              rt.completed ? 'line-through text-slate-500' : 'text-slate-900'
                            }`}
                          >
                            {rt.title}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            <span className="font-mono tabular-nums">{rt.time}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{rt.category}</span>
                            {rt.completedBy && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span className="text-emerald-700 font-semibold">
                                  Done by {rt.completedBy}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-semibold text-blue-700 shrink-0">
                        {rt.completed ? 'Completed' : 'Mark Done'}
                      </span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddRoutine} className="pt-2 flex flex-col sm:flex-row gap-2">
                  <label htmlFor="new-routine-title-input" className="sr-only">
                    New daily routine title
                  </label>
                  <input
                    id="new-routine-title-input"
                    type="text"
                    value={newRoutineTitle}
                    onChange={(e) => setNewRoutineTitle(e.target.value)}
                    placeholder="Add daily routine (e.g., Evening Blood Sugar Check)..."
                    className="flex-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <label htmlFor="new-routine-time-input" className="sr-only">
                    Routine time
                  </label>
                  <input
                    id="new-routine-time-input"
                    type="text"
                    value={newRoutineTime}
                    onChange={(e) => setNewRoutineTime(e.target.value)}
                    placeholder="06:30 PM"
                    className="w-full sm:w-28 min-h-[40px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={!newRoutineTitle.trim()}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    Add Routine
                  </button>
                </form>
              </section>
            </>
          )}

          {/* SECTION C: Dedicated Care Circle Directory & Activity Log when Care Circle Tab is Active */}
          {activeSection === 'care_circle' && (
            <>
              <section
                aria-labelledby="care-circle-main-heading"
                className="glass-card rounded-3xl p-5 sm:p-7 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <h2
                      id="care-circle-main-heading"
                      className="text-base sm:text-xl font-extrabold text-slate-900 flex items-center gap-2"
                    >
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                      <span>Authorized Care Circle Directory</span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Family members and caretakers authorized for {activeProfile.name}&apos;s care profile.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChangePasscodeModal(true)}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Change Passcode
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isUnlocked) {
                          setShowPasscodeModal(true);
                          return;
                        }
                        setShowMemberModal(true);
                      }}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#A3E635] text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Add Member</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeProfile.careCircle.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-extrabold text-slate-900 truncate">{member.name}</span>
                        <span className="font-semibold text-blue-700 shrink-0">{member.relation}</span>
                      </div>
                      <p className="text-xs font-mono text-slate-600 truncate">{member.email}</p>
                      <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                        <span className="font-mono">{member.phone}</span>
                        <span className="font-semibold text-emerald-700">
                          {member.receiveEmailAlerts ? 'Email Alerts ON' : 'View Only'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent Care Circle Audit Activity */}
              <section
                aria-labelledby="audit-log-heading"
                className="glass-card rounded-3xl p-5 sm:p-7 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
                  <div>
                    <h3 id="audit-log-heading" className="text-base font-extrabold text-slate-900">
                      Care Circle Activity Log
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Recent medication updates, passcode checks, and email alerts.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {auditLogs.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900">{entry.actor}: </span>
                        <span className="text-slate-700">{entry.details}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        {entry.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Right 5 Columns: Proactive Email Reminder Center, Elderly Autonomy & Care Circle Access */}
        <div className="lg:col-span-5 space-y-6 lg:space-y-8">
          {/* 1. Proactive Email Reminder Center */}
          <section
            aria-labelledby="email-reminders-heading"
            className="glass-card rounded-3xl p-5 sm:p-6 space-y-4"
          >
            <div className="border-b border-slate-200 pb-3.5">
              <h2
                id="email-reminders-heading"
                className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2"
              >
                <Mail className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
                <span>Proactive Email Reminders</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Dispatch instant email alerts to authorized Care Circle members.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={sendingReminderType !== null}
                onClick={() => handleTriggerEmailReminder('missed_medication')}
                className="min-h-[56px] p-3 rounded-2xl bg-rose-50 hover:bg-rose-100/80 disabled:opacity-60 border border-rose-200 text-left transition-all cursor-pointer flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="text-xs font-extrabold text-rose-900 block">
                    {sendingReminderType === 'missed_medication'
                      ? 'Sending Alert...'
                      : 'Missed Dose Alert'}
                  </span>
                  <span className="text-[11px] text-rose-700 block mt-0.5">
                    Notify family &amp; caretaker
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={sendingReminderType !== null}
                onClick={() => handleTriggerEmailReminder('upcoming_dose')}
                className="min-h-[56px] p-3 rounded-2xl bg-blue-50 hover:bg-blue-100/80 disabled:opacity-60 border border-blue-200 text-left transition-all cursor-pointer flex items-start gap-2.5"
              >
                <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="text-xs font-extrabold text-blue-900 block">
                    {sendingReminderType === 'upcoming_dose'
                      ? 'Sending Alert...'
                      : 'Upcoming Dose Email'}
                  </span>
                  <span className="text-[11px] text-blue-700 block mt-0.5">
                    Next scheduled tablet
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={sendingReminderType !== null}
                onClick={() => handleTriggerEmailReminder('appointment_reminder')}
                className="min-h-[56px] p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 disabled:opacity-60 border border-emerald-200 text-left transition-all cursor-pointer flex items-start gap-2.5"
              >
                <CalendarCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="text-xs font-extrabold text-emerald-900 block">
                    {sendingReminderType === 'appointment_reminder'
                      ? 'Sending Alert...'
                      : 'Appointment Email'}
                  </span>
                  <span className="text-[11px] text-emerald-700 block mt-0.5">
                    Upcoming doctor visit
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={sendingReminderType !== null}
                onClick={() => handleTriggerEmailReminder('refill_alert')}
                className="min-h-[56px] p-3 rounded-2xl bg-amber-50 hover:bg-amber-100/80 disabled:opacity-60 border border-amber-200 text-left transition-all cursor-pointer flex items-start gap-2.5"
              >
                <Send className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <span className="text-xs font-extrabold text-amber-900 block">
                    {sendingReminderType === 'refill_alert'
                      ? 'Sending Alert...'
                      : 'Refill Warning Email'}
                  </span>
                  <span className="text-[11px] text-amber-800 block mt-0.5">
                    Low tablet supply alert
                  </span>
                </div>
              </button>
            </div>

            {/* Dispatched Email Outbox Log */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Care Circle Email Outbox</span>
                <span className="font-mono text-slate-500 tabular-nums">
                  {activeProfile.emailReminders.length} Sent
                </span>
              </div>

              <div
                className="space-y-2.5 max-h-72 overflow-y-auto pr-1"
                role="region"
                aria-label="Sent email reminders log"
              >
                {activeProfile.emailReminders.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                      <span className="font-semibold text-blue-700 truncate">{log.triggeredBy}</span>
                      <span className="font-mono tabular-nums shrink-0">{log.sentAt}</span>
                    </div>
                    <p className="font-bold text-slate-900">{log.subject}</p>
                    <p className="text-slate-600 leading-relaxed">{log.bodyPreview}</p>
                    <p className="text-[11px] font-mono text-slate-500 truncate">
                      To: {log.recipients.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 2. Elderly Decision Autonomy & Self-Governance Panel */}
          <section
            aria-labelledby="autonomy-heading"
            className="glass-card rounded-3xl p-5 sm:p-6 space-y-4"
          >
            <div className="border-b border-slate-200 pb-3">
              <h2
                id="autonomy-heading"
                className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2"
              >
                <Sliders className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Senior Autonomy &amp; Preferences</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Keeps {activeProfile.name} in control of daily check-ins and family alert timing.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label
                  htmlFor="senior-mood-select"
                  className="font-bold text-slate-700 block mb-1"
                >
                  Daily Self-Check-In Mood:
                </label>
                <select
                  id="senior-mood-select"
                  value={activeProfile.autonomyPreferences.dailyCheckInMood}
                  onChange={(e) =>
                    handleUpdateAutonomy({
                      dailyCheckInMood: e.target.value as any,
                    })
                  }
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900"
                >
                  <option value="Energetic">Energetic &amp; Independent</option>
                  <option value="Comfortable">Comfortable &amp; Steady</option>
                  <option value="Tired">Feeling Tired Today</option>
                  <option value="Needs Assistance">Needs Caretaker Check-In</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="grace-window-select"
                  className="font-bold text-slate-700 block mb-1"
                >
                  Grace Window Before Family Email Alert:
                </label>
                <select
                  id="grace-window-select"
                  value={activeProfile.autonomyPreferences.gracePeriodMinutes}
                  onChange={(e) =>
                    handleUpdateAutonomy({
                      gracePeriodMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900"
                >
                  <option value={15}>15 Minutes Grace Window</option>
                  <option value={30}>30 Minutes Grace Window (Recommended)</option>
                  <option value={45}>45 Minutes Grace Window</option>
                  <option value={60}>60 Minutes Grace Window</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="voice-lang-select"
                  className="font-bold text-slate-700 block mb-1"
                >
                  Voice Read-Aloud Language:
                </label>
                <select
                  id="voice-lang-select"
                  value={activeProfile.autonomyPreferences.preferredLanguage}
                  onChange={(e) =>
                    handleUpdateAutonomy({
                      preferredLanguage: e.target.value as any,
                    })
                  }
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900"
                >
                  <option value="en-IN">English (India)</option>
                  <option value="hi-IN">हिन्दी (Hindi)</option>
                  <option value="mr-IN">मराठी (Marathi)</option>
                </select>
              </div>

              <div className="pt-1 flex items-center justify-between gap-3">
                <label
                  htmlFor="allow-caretaker-edits-toggle"
                  className="font-bold text-slate-700 cursor-pointer"
                >
                  Allow Caretaker Medication Edits:
                </label>
                <input
                  id="allow-caretaker-edits-toggle"
                  type="checkbox"
                  checked={activeProfile.autonomyPreferences.allowCaretakerScheduleEdits}
                  onChange={(e) =>
                    handleUpdateAutonomy({
                      allowCaretakerScheduleEdits: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>
          </section>

          {/* 3. Passcode-Protected Care Circle Directory (Shown in Sidebar when not already expanded on left) */}
          {activeSection !== 'care_circle' && (
            <section
              aria-labelledby="care-circle-heading"
              className="glass-card rounded-3xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
                <div>
                  <h2
                    id="care-circle-heading"
                    className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2"
                  >
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>Authorized Care Circle</span>
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {activeProfile.careCircle.length} authorized members.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowChangePasscodeModal(true)}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                    title="Change Care Circle Passcode"
                  >
                    Passcode
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isUnlocked) {
                        setShowPasscodeModal(true);
                        return;
                      }
                      setShowMemberModal(true);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#A3E635] shrink-0" aria-hidden="true" />
                    <span>Add Member</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {activeProfile.careCircle.map((member) => (
                  <div
                    key={member.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-extrabold text-slate-900 truncate">{member.name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-blue-700">{member.relation}</span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-600 truncate mt-0.5">
                        {member.email} · {member.phone}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
                      {member.receiveEmailAlerts ? 'Alerts ON' : 'View Only'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* MODAL 1: Verify Care Circle Passcode */}
      {showPasscodeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-passcode-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="glass-modal rounded-3xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-blue-600" aria-hidden="true" />
                <h3 id="verify-passcode-title" className="text-lg font-extrabold text-slate-900">
                  Enter Care Circle Passcode
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close passcode dialog"
                onClick={() => setShowPasscodeModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter the 4-digit passcode for <strong>{activeProfile.name}</strong> to unlock
              schedule editing. (Demo passcode:{' '}
              <strong className="font-mono text-slate-900">{activeProfile.passcodeHint}</strong>)
            </p>

            <form onSubmit={handleVerifyPasscode} className="space-y-4">
              <div>
                <label htmlFor="passcode-verify-input" className="sr-only">
                  4-digit Care Circle passcode
                </label>
                <input
                  id="passcode-verify-input"
                  type="password"
                  inputMode="numeric"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder={`Enter passcode (${activeProfile.passcodeHint})`}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono text-lg font-extrabold tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {passcodeError && (
                <p role="alert" className="text-xs font-bold text-rose-600 text-center">
                  {passcodeError}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPasscodeInput(activeProfile.passcodeHint)}
                  className="min-h-[42px] px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Auto-Fill ({activeProfile.passcodeHint})
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 min-h-[42px] py-2.5 px-4 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-[#A3E635] text-xs font-extrabold cursor-pointer"
                >
                  {isSubmitting ? 'Verifying...' : 'Unlock Care Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Change Care Circle Passcode */}
      {showChangePasscodeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-passcode-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="glass-modal rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="change-passcode-title" className="text-lg font-extrabold text-slate-900">
                Update Care Circle Passcode
              </h3>
              <button
                type="button"
                aria-label="Close update passcode dialog"
                onClick={() => setShowChangePasscodeModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleChangePasscode} className="space-y-3.5 text-xs">
              <div>
                <label htmlFor="current-passcode-input" className="font-bold text-slate-700 block mb-1">
                  Current Passcode (Hint: {activeProfile.passcodeHint})
                </label>
                <input
                  id="current-passcode-input"
                  type="password"
                  required
                  value={passcodeChangeForm.currentPasscode}
                  onChange={(e) =>
                    setPasscodeChangeForm({
                      ...passcodeChangeForm,
                      currentPasscode: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label htmlFor="new-passcode-input" className="font-bold text-slate-700 block mb-1">
                  New 4-to-6 Digit Passcode
                </label>
                <input
                  id="new-passcode-input"
                  type="password"
                  required
                  value={passcodeChangeForm.newPasscode}
                  onChange={(e) =>
                    setPasscodeChangeForm({
                      ...passcodeChangeForm,
                      newPasscode: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePasscodeModal(false)}
                  className="min-h-[40px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[40px] px-5 py-2.5 rounded-xl bg-[#0F172A] disabled:opacity-50 text-[#A3E635] font-extrabold cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save New Passcode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add / Edit Medication */}
      {showMedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="med-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="glass-modal rounded-3xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="med-modal-title" className="text-lg font-extrabold text-slate-900">
                {editingMed ? 'Edit Medication Schedule' : `Add Medication for ${activeProfile.name}`}
              </h3>
              <button
                type="button"
                aria-label="Close medication dialog"
                onClick={() => setShowMedModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveMedication} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="med-name-input" className="font-bold text-slate-700 block mb-1">
                    Medicine Name *
                  </label>
                  <input
                    id="med-name-input"
                    type="text"
                    required
                    value={medForm.medicineName}
                    onChange={(e) => setMedForm({ ...medForm, medicineName: e.target.value })}
                    placeholder="e.g. Telmisartan 40mg"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label htmlFor="med-dosage-input" className="font-bold text-slate-700 block mb-1">
                    Dosage *
                  </label>
                  <input
                    id="med-dosage-input"
                    type="text"
                    required
                    value={medForm.dosage}
                    onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                    placeholder="e.g. 1 Tablet (40mg)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="med-time-input" className="font-bold text-slate-700 block mb-1">
                    Time Slot
                  </label>
                  <input
                    id="med-time-input"
                    type="text"
                    value={medForm.timeSlot}
                    onChange={(e) => setMedForm({ ...medForm, timeSlot: e.target.value })}
                    placeholder="08:00 AM"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="med-period-select" className="font-bold text-slate-700 block mb-1">
                    Period
                  </label>
                  <select
                    id="med-period-select"
                    value={medForm.period}
                    onChange={(e) =>
                      setMedForm({ ...medForm, period: e.target.value as DosePeriod })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="med-meal-select" className="font-bold text-slate-700 block mb-1">
                    Meal Timing
                  </label>
                  <select
                    id="med-meal-select"
                    value={medForm.mealTiming}
                    onChange={(e) =>
                      setMedForm({ ...medForm, mealTiming: e.target.value as MealTiming })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  >
                    <option value="After Food">After Food</option>
                    <option value="Before Food">Before Food</option>
                    <option value="With Food">With Food</option>
                    <option value="With Water">With Water</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="med-purpose-input" className="font-bold text-slate-700 block mb-1">
                    Clinical Purpose
                  </label>
                  <input
                    id="med-purpose-input"
                    type="text"
                    value={medForm.purpose}
                    onChange={(e) => setMedForm({ ...medForm, purpose: e.target.value })}
                    placeholder="e.g. Blood Pressure"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label htmlFor="med-doctor-input" className="font-bold text-slate-700 block mb-1">
                    Prescribed By
                  </label>
                  <input
                    id="med-doctor-input"
                    type="text"
                    value={medForm.prescribedBy}
                    onChange={(e) => setMedForm({ ...medForm, prescribedBy: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label htmlFor="med-stock-input" className="font-bold text-slate-700 block mb-1">
                    Pills Remaining
                  </label>
                  <input
                    id="med-stock-input"
                    type="number"
                    min={0}
                    value={medForm.pillsRemaining}
                    onChange={(e) =>
                      setMedForm({ ...medForm, pillsRemaining: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="med-notes-input" className="font-bold text-slate-700 block mb-1">
                  Instructions for Senior &amp; Caretaker
                </label>
                <input
                  id="med-notes-input"
                  type="text"
                  value={medForm.notes}
                  onChange={(e) => setMedForm({ ...medForm, notes: e.target.value })}
                  placeholder="e.g. Take with warm water after breakfast"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="min-h-[40px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[40px] px-5 py-2.5 rounded-xl bg-[#0F172A] disabled:opacity-50 text-[#A3E635] font-extrabold cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingMed ? 'Save Changes' : 'Add Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Schedule Medical Appointment */}
      {showAppointmentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="apt-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="glass-modal rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="apt-modal-title" className="text-lg font-extrabold text-slate-900">
                Schedule Medical Appointment — {activeProfile.name}
              </h3>
              <button
                type="button"
                aria-label="Close appointment dialog"
                onClick={() => setShowAppointmentModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleAddAppointment} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="apt-doctor-input" className="font-bold text-slate-700 block mb-1">
                    Doctor Name *
                  </label>
                  <input
                    id="apt-doctor-input"
                    type="text"
                    required
                    value={appointmentForm.doctorName}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, doctorName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label htmlFor="apt-spec-input" className="font-bold text-slate-700 block mb-1">
                    Speciality
                  </label>
                  <input
                    id="apt-spec-input"
                    type="text"
                    value={appointmentForm.speciality}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, speciality: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="apt-date-input" className="font-bold text-slate-700 block mb-1">
                    Appointment Date *
                  </label>
                  <input
                    id="apt-date-input"
                    type="date"
                    required
                    value={appointmentForm.appointmentDate}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, appointmentDate: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="apt-time-input" className="font-bold text-slate-700 block mb-1">
                    Appointment Time *
                  </label>
                  <input
                    id="apt-time-input"
                    type="text"
                    required
                    value={appointmentForm.appointmentTime}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, appointmentTime: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="apt-clinic-input" className="font-bold text-slate-700 block mb-1">
                    Clinic / Hospital Name
                  </label>
                  <input
                    id="apt-clinic-input"
                    type="text"
                    value={appointmentForm.clinicOrHospital}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, clinicOrHospital: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label htmlFor="apt-accompanied-input" className="font-bold text-slate-700 block mb-1">
                    Accompanied By (Care Circle Member)
                  </label>
                  <input
                    id="apt-accompanied-input"
                    type="text"
                    value={appointmentForm.accompaniedBy}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, accompaniedBy: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="apt-purpose-input" className="font-bold text-slate-700 block mb-1">
                  Visit Purpose
                </label>
                <input
                  id="apt-purpose-input"
                  type="text"
                  value={appointmentForm.purpose}
                  onChange={(e) =>
                    setAppointmentForm({ ...appointmentForm, purpose: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                />
              </div>

              <div>
                <label htmlFor="apt-prep-input" className="font-bold text-slate-700 block mb-1">
                  Preparation Checklist
                </label>
                <input
                  id="apt-prep-input"
                  type="text"
                  value={appointmentForm.preparationNotes}
                  onChange={(e) =>
                    setAppointmentForm({ ...appointmentForm, preparationNotes: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppointmentModal(false)}
                  className="min-h-[40px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[40px] px-5 py-2.5 rounded-xl bg-[#0F172A] disabled:opacity-50 text-[#A3E635] font-extrabold cursor-pointer"
                >
                  {isSubmitting ? 'Scheduling...' : 'Schedule & Email Care Circle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Add Family Member / Caretaker */}
      {showMemberModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="glass-modal rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="member-modal-title" className="text-lg font-extrabold text-slate-900">
                Add Family Member or Caretaker
              </h3>
              <button
                type="button"
                aria-label="Close Care Circle member dialog"
                onClick={() => setShowMemberModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3.5 text-xs">
              <div>
                <label htmlFor="member-name-input" className="font-bold text-slate-700 block mb-1">
                  Full Name *
                </label>
                <input
                  id="member-name-input"
                  type="text"
                  required
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  placeholder="e.g. Amit Patil"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="member-role-select" className="font-bold text-slate-700 block mb-1">
                    Relationship / Role
                  </label>
                  <select
                    id="member-role-select"
                    value={memberForm.relation}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, relation: e.target.value as CareRole })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  >
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Primary Caretaker">Primary Caretaker</option>
                    <option value="Nurse">Nurse</option>
                    <option value="Family Member">Family Member</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="member-phone-input" className="font-bold text-slate-700 block mb-1">
                    Phone Number
                  </label>
                  <input
                    id="member-phone-input"
                    type="text"
                    value={memberForm.phone}
                    onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="member-email-input" className="font-bold text-slate-700 block mb-1">
                  Email Address (Receives Proactive Alerts) *
                </label>
                <input
                  id="member-email-input"
                  type="email"
                  required
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                  placeholder="family.member@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memberForm.canEditMedications}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, canEditMedications: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span>Can Edit Medications</span>
                </label>
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memberForm.receiveEmailAlerts}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, receiveEmailAlerts: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span>Receive Email Alerts</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="min-h-[40px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[40px] px-5 py-2.5 rounded-xl bg-[#0F172A] disabled:opacity-50 text-[#A3E635] font-extrabold cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Authorize Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Log Daily Senior Vitals */}
      {showVitalsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="vitals-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="glass-modal rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="vitals-modal-title" className="text-lg font-extrabold text-slate-900">
                Log Daily Vitals — {activeProfile.name}
              </h3>
              <button
                type="button"
                aria-label="Close vitals dialog"
                onClick={() => setShowVitalsModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveVitals} className="space-y-3.5 text-xs">
              <div>
                <label htmlFor="vitals-bp-input" className="font-bold text-slate-700 block mb-1">
                  Blood Pressure (mmHg)
                </label>
                <input
                  id="vitals-bp-input"
                  type="text"
                  value={vitalsForm.bp}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, bp: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label htmlFor="vitals-sugar-input" className="font-bold text-slate-700 block mb-1">
                  Blood Sugar (mg/dL)
                </label>
                <input
                  id="vitals-sugar-input"
                  type="text"
                  value={vitalsForm.bloodSugar}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, bloodSugar: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="vitals-hr-input" className="font-bold text-slate-700 block mb-1">
                    Heart Rate (bpm)
                  </label>
                  <input
                    id="vitals-hr-input"
                    type="number"
                    value={vitalsForm.heartRate}
                    onChange={(e) =>
                      setVitalsForm({ ...vitalsForm, heartRate: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="vitals-spo2-input" className="font-bold text-slate-700 block mb-1">
                    Oxygen SpO2 (%)
                  </label>
                  <input
                    id="vitals-spo2-input"
                    type="number"
                    value={vitalsForm.spo2}
                    onChange={(e) =>
                      setVitalsForm({ ...vitalsForm, spo2: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVitalsModal(false)}
                  className="min-h-[40px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[40px] px-5 py-2.5 rounded-xl bg-[#0F172A] disabled:opacity-50 text-[#A3E635] font-extrabold cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Vitals'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: Create New Senior Profile */}
      {showNewProfileModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-profile-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="glass-modal rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="new-profile-modal-title" className="text-lg font-extrabold text-slate-900">
                Create Shared Elderly Care Profile
              </h3>
              <button
                type="button"
                aria-label="Close new senior profile dialog"
                onClick={() => setShowNewProfileModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateSeniorProfile} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="senior-name-input" className="font-bold text-slate-700 block mb-1">
                    Senior Full Name *
                  </label>
                  <input
                    id="senior-name-input"
                    type="text"
                    required
                    value={newProfileForm.name}
                    onChange={(e) => setNewProfileForm({ ...newProfileForm, name: e.target.value })}
                    placeholder="e.g. Shantaram Kulkarni"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label htmlFor="senior-age-input" className="font-bold text-slate-700 block mb-1">
                    Age *
                  </label>
                  <input
                    id="senior-age-input"
                    type="number"
                    required
                    value={newProfileForm.age}
                    onChange={(e) =>
                      setNewProfileForm({ ...newProfileForm, age: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="senior-passcode-input"
                    className="font-bold text-slate-700 block mb-1"
                  >
                    4-Digit Passcode *
                  </label>
                  <input
                    id="senior-passcode-input"
                    type="text"
                    required
                    value={newProfileForm.passcode}
                    onChange={(e) =>
                      setNewProfileForm({ ...newProfileForm, passcode: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label htmlFor="senior-blood-input" className="font-bold text-slate-700 block mb-1">
                    Blood Group
                  </label>
                  <input
                    id="senior-blood-input"
                    type="text"
                    value={newProfileForm.bloodGroup}
                    onChange={(e) =>
                      setNewProfileForm({ ...newProfileForm, bloodGroup: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="senior-city-input" className="font-bold text-slate-700 block mb-1">
                    City
                  </label>
                  <input
                    id="senior-city-input"
                    type="text"
                    value={newProfileForm.city}
                    onChange={(e) => setNewProfileForm({ ...newProfileForm, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="senior-conditions-input"
                  className="font-bold text-slate-700 block mb-1"
                >
                  Chronic Conditions (comma separated)
                </label>
                <input
                  id="senior-conditions-input"
                  type="text"
                  value={newProfileForm.chronicConditions}
                  onChange={(e) =>
                    setNewProfileForm({ ...newProfileForm, chronicConditions: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="caretaker-name-input"
                    className="font-bold text-slate-700 block mb-1"
                  >
                    Primary Caretaker Name
                  </label>
                  <input
                    id="caretaker-name-input"
                    type="text"
                    value={newProfileForm.caretakerName}
                    onChange={(e) =>
                      setNewProfileForm({ ...newProfileForm, caretakerName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label
                    htmlFor="caretaker-email-input"
                    className="font-bold text-slate-700 block mb-1"
                  >
                    Caretaker Alert Email
                  </label>
                  <input
                    id="caretaker-email-input"
                    type="email"
                    value={newProfileForm.caretakerEmail}
                    onChange={(e) =>
                      setNewProfileForm({ ...newProfileForm, caretakerEmail: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProfileModal(false)}
                  className="min-h-[40px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[40px] px-5 py-2.5 rounded-xl bg-[#0F172A] disabled:opacity-50 text-[#A3E635] font-extrabold cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Senior Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
