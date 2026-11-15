import React, { useState, useEffect } from 'react';
import {
  ElderlyProfile,
  AssistantMessage,
  ClinicalInsight,
  ReminderType,
} from '../types';
import { api } from '../services/api';
import { evaluateElderlyContext } from '../utils/clinicalDecisionEngine';
import {
  Sparkles,
  Send,
  Volume2,
  Mic,
  AlertTriangle,
  CheckCircle2,
  Info,
  Mail,
  Activity,
  Pill,
} from 'lucide-react';

interface SmartCareAssistantProps {
  profile: ElderlyProfile;
  activeActor: string;
  onTriggerEmailReminder: (type: ReminderType) => Promise<void>;
  onMarkNextPendingTaken: () => Promise<void>;
  onOpenVitalsModal: () => void;
  onSpeakText: (text: string) => void;
}

const QUICK_PROMPTS = [
  'Give me a complete daily medication & adherence summary',
  'Are any medications missed or overdue today?',
  'Check meal timing and drug-allergy safety guidance',
  'What is the next upcoming doctor appointment and preparation?',
  'Analyze latest blood pressure and blood sugar vitals',
];

export const SmartCareAssistant: React.FC<SmartCareAssistantProps> = ({
  profile,
  activeActor,
  onTriggerEmailReminder,
  onMarkNextPendingTaken,
  onOpenVitalsModal,
  onSpeakText,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);

  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const insights: ClinicalInsight[] = evaluateElderlyContext(profile);

  // Initialize assistant greeting when profile changes
  useEffect(() => {
    const takenCount = profile.medications.filter((m) => m.todayStatus === 'taken').length;
    const missedCount = profile.medications.filter((m) => m.todayStatus === 'missed').length;
    const pendingCount = profile.medications.filter((m) => m.todayStatus === 'pending').length;

    const welcomeText =
      `Hello! I am your Care Assistant for ${profile.name} (${profile.age} yrs). ` +
      `Today, ${takenCount}/${profile.medications.length} doses are taken (${profile.adherenceRate7d}% 7-day adherence). ` +
      (missedCount > 0
        ? `${missedCount} missed dose${missedCount === 1 ? ' requires' : 's require'} attention. `
        : '') +
      (pendingCount > 0
        ? `${pendingCount} dose${pendingCount === 1 ? ' is' : 's are'} upcoming today.`
        : 'All scheduled doses for today are complete.');

    setMessages([
      {
        id: `msg-init-${profile.id}`,
        sender: 'assistant',
        text: welcomeText,
        timestamp: 'Ready',
        contextTags: [
          `Senior: ${profile.name}`,
          `Conditions: ${profile.chronicConditions.join(', ')}`,
          `Grace Window: ${profile.autonomyPreferences.gracePeriodMinutes}m`,
        ],
        suggestedActions: [
          ...(missedCount > 0
            ? [{ label: 'Email Family About Missed Dose', action: 'send_missed_email' as const }]
            : []),
          ...(pendingCount > 0
            ? [{ label: 'Mark Next Pending Dose Taken', action: 'mark_next_taken' as const }]
            : []),
          { label: 'Send Upcoming Dose Email', action: 'send_upcoming_email' as const },
        ],
      },
    ]);
  }, [profile.id]);

  const handleSendPrompt = async (customQuery?: string) => {
    const query = (customQuery ?? inputPrompt).trim();
    if (!query || isThinking) return;

    const userMsg: AssistantMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customQuery) setInputPrompt('');
    setIsThinking(true);

    try {
      const res = await api.askSmartCareAssistant(profile.id, query);
      const botMsg: AssistantMessage = {
        id: `msg-bot-${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        contextTags: res.contextTags,
        suggestedActions: res.suggestedActions,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'assistant',
          text: err?.message || 'Unable to process request right now.',
          timestamp: 'Now',
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleVoiceDictation = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onSpeakText('Voice dictation is not supported in this browser. Please type your question.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = profile.autonomyPreferences.preferredLanguage || 'en-IN';
    recognition.interimResults = false;
    setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setIsListening(false);
      if (transcript) {
        setInputPrompt(transcript);
        handleSendPrompt(transcript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleSuggestedAction = async (
    action: 'send_missed_email' | 'send_upcoming_email' | 'send_appointment_email' | 'mark_next_taken'
  ) => {
    if (actionBusy) return;
    setActionBusy(action);
    try {
      if (action === 'send_missed_email') {
        await onTriggerEmailReminder('missed_medication');
      } else if (action === 'send_upcoming_email') {
        await onTriggerEmailReminder('upcoming_dose');
      } else if (action === 'send_appointment_email') {
        await onTriggerEmailReminder('appointment_reminder');
      } else if (action === 'mark_next_taken') {
        await onMarkNextPendingTaken();
      }
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <section
      aria-labelledby="smart-assistant-heading"
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
    >
      {/* Left 5 Columns: Context-Aware Clinical Decision Insights */}
      <div className="lg:col-span-5 glass-card rounded-3xl p-5 sm:p-6 space-y-4 flex flex-col">
        <div className="border-b border-slate-200 pb-3">
          <h2
            id="smart-assistant-heading"
            className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2"
          >
            <Activity className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
            <span>Clinical Care Alerts</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Live checks on {profile.name}&apos;s doses, vitals, and remaining tablet supply.
          </p>
        </div>

        <div className="space-y-3 flex-1" role="region" aria-label="Clinical Decision Insights">
          {insights.map((item) => {
            const isCritical = item.severity === 'critical';
            const isWarning = item.severity === 'warning';

            return (
              <div
                key={item.id}
                className={`p-3.5 sm:p-4 rounded-2xl border space-y-2 ${
                  isCritical
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : isWarning
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                    {isCritical ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                    )}
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                    {item.category}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-700">{item.recommendation}</p>

                {item.actionLabel && item.actionType && (
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={async () => {
                        if (item.actionType === 'review_vitals') {
                          onOpenVitalsModal();
                          return;
                        }
                        setActionBusy(item.id);
                        try {
                          if (item.actionType === 'send_missed_email') {
                            await onTriggerEmailReminder('missed_medication');
                          } else if (item.actionType === 'send_refill_email') {
                            await onTriggerEmailReminder('refill_alert');
                          } else if (item.actionType === 'send_appointment_email') {
                            await onTriggerEmailReminder('appointment_reminder');
                          }
                        } finally {
                          setActionBusy(null);
                        }
                      }}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#A3E635] shrink-0" aria-hidden="true" />
                      <span>
                        {actionBusy === item.id ? 'Processing...' : item.actionLabel}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 7 Columns: Interactive Smart Care Assistant */}
      <div className="lg:col-span-7 glass-card rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
              <span>Smart Care Assistant</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Ask about {profile.name}&apos;s doses, meal rules, or doctor visits.
            </p>
          </div>
        </div>

        {/* Quick Context Question Buttons */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested care questions">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={isThinking}
              onClick={() => handleSendPrompt(q)}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 disabled:opacity-50 text-slate-800 text-xs font-semibold transition-colors cursor-pointer text-left"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Conversation Feed */}
        <div
          className="space-y-3 max-h-80 overflow-y-auto pr-1"
          role="log"
          aria-live="polite"
          aria-label="Care Assistant conversation history"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3.5 sm:p-4 rounded-2xl border text-xs sm:text-sm space-y-2 ${
                msg.sender === 'assistant'
                  ? 'bg-slate-50 border-slate-200 text-slate-900'
                  : 'bg-[#0F172A] border-slate-800 text-white ml-4 sm:ml-8'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] opacity-75">
                <span className="font-bold truncate">
                  {msg.sender === 'assistant' ? 'SilverCare Assistant' : activeActor}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono tabular-nums">{msg.timestamp}</span>
                  {msg.sender === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => onSpeakText(msg.text)}
                      aria-label="Read assistant message aloud"
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 cursor-pointer"
                      title="Read response aloud"
                    >
                      <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <p className="leading-relaxed">{msg.text}</p>

              {msg.contextTags && msg.contextTags.length > 0 && (
                <div className="text-[11px] text-slate-500 pt-1">
                  {msg.contextTags.join(' · ')}
                </div>
              )}

              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {msg.suggestedActions.map((act) => (
                    <button
                      key={act.label}
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={() => handleSuggestedAction(act.action)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {actionBusy === act.action ? 'Working...' : act.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isThinking && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
              Analyzing {profile.name}&apos;s medication schedule and vitals...
            </div>
          )}
        </div>

        {/* Accessible Prompt Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 border-t border-slate-200"
        >
          <label htmlFor="assistant-query-input" className="sr-only">
            Ask the Elderly Care Assistant a question
          </label>
          <input
            id="assistant-query-input"
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={`Ask about ${profile.name}'s doses, vitals, or appointments...`}
            className="w-full sm:flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleVoiceDictation}
              aria-label={isListening ? 'Listening for voice question' : 'Speak question using microphone'}
              className={`min-h-[42px] min-w-[42px] p-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-center ${
                isListening
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title="Voice Input"
            >
              <Mic className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="submit"
              disabled={isThinking || !inputPrompt.trim()}
              className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#A3E635] text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{isThinking ? 'Asking...' : 'Ask Assistant'}</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
