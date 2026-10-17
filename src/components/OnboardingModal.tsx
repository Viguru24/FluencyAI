import React, { useState } from 'react';
import {
  Sparkles,
  Volume2,
  ArrowRight,
  ArrowLeft,
  Compass,
  Check,
  Globe,
  ChevronRight,
} from 'lucide-react';
import { ALL_PERSONAS, setActivePersona } from '../data/personas';
import { speakEnglish, playChime, stopSpeaking } from '../services/speech';
import type { AIPersona, PersonaId, NativeLanguage, UserProgress } from '../types';
import logoMark from '../assets/logo-mark.png';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: UserProgress;
  onUpdateProgress: (updater: (prev: UserProgress) => UserProgress) => void;
  onComplete: (data: {
    goal: string;
    coachId: PersonaId;
    nativeLanguage: NativeLanguage;
    dailyMinutes: number;
    startPlacement: boolean;
  }) => void;
}

const GOALS = [
  {
    id: 'career',
    title: 'Career & Executive Meetings',
    subtitle: 'Interviews, client pitches, polite diplomacy & assertiveness',
    icon: '💼',
    badge: 'Popular',
  },
  {
    id: 'travel',
    title: 'Travel & Daily Living',
    subtitle: 'Restaurants, airports, social small talk, asking for help',
    icon: '✈️',
  },
  {
    id: 'fluency',
    title: 'Spoken Fluency & Thinking in English',
    subtitle: 'Stop translating in your head and speak without hesitation',
    icon: '⚡',
    badge: 'Top Pick',
  },
  {
    id: 'exam',
    title: 'IELTS / TOEFL / Cambridge Exam Prep',
    subtitle: 'Structured speaking answers, linking words, rich idioms',
    icon: '🎓',
  },
];

const PACES = [
  {
    minutes: 5,
    title: 'Casual Pace',
    subtitle: '5 minutes / day',
    xp: 50,
    desc: 'Quick habit-builder. 1 spoken scenario per day.',
    icon: '🌱',
  },
  {
    minutes: 15,
    title: 'Recommended Pace',
    subtitle: '15 minutes / day',
    xp: 150,
    desc: 'Optimal fluency curve. Prep, live roleplay, and review deck.',
    icon: '🔥',
    isRecommended: true,
  },
  {
    minutes: 30,
    title: 'Intensive Immersion',
    subtitle: '30 minutes / day',
    xp: 300,
    desc: 'Rapid transformation. Deep free talk and multiple roleplays.',
    icon: '⚡',
  },
];

const LANGUAGES: { lang: NativeLanguage; label: string; flag: string }[] = [
  { lang: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { lang: 'Mandarin', label: '中文 (Chinese)', flag: '🇨🇳' },
  { lang: 'Japanese', label: '日本語 (Japanese)', flag: '🇯🇵' },
  { lang: 'Portuguese', label: 'Português', flag: '🇧🇷' },
  { lang: 'Arabic', label: 'العربية (Arabic)', flag: '🇸🇦' },
  { lang: 'French', label: 'Français', flag: '🇫🇷' },
  { lang: 'Vietnamese', label: 'Tiếng Việt', flag: '🇻🇳' },
  { lang: 'German', label: 'Deutsch', flag: '🇩🇪' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  progress,
  onUpdateProgress,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedGoal, setSelectedGoal] = useState<string>('fluency');
  const [selectedPersonaId, setSelectedPersonaId] = useState<PersonaId>(
    progress.activePersonaId || 'james'
  );
  const [selectedLanguage, setSelectedLanguage] = useState<NativeLanguage>(
    progress.nativeLanguage || 'Spanish'
  );
  const [selectedMinutes, setSelectedMinutes] = useState<number>(
    progress.dailyGoalMinutes || 15
  );
  const [auditioningId, setAuditioningId] = useState<PersonaId | null>(null);

  if (!isOpen) return null;

  const handleAudition = (persona: AIPersona) => {
    stopSpeaking();
    playChime('tap');
    setAuditioningId(persona.id as PersonaId);

    const phrase = persona.sampleVoicePhrase || persona.greeting;
    speakEnglish(phrase, {
      personaName: persona.name,
      rate: persona.rate || 0.94,
      pitch: persona.pitch || 1.0,
      accent: persona.accent || 'UK',
      voicePreferences: persona.ttsVoicePreference,
      gender: persona.gender,
      onStart: () => setAuditioningId(persona.id as PersonaId),
      onEnd: () => setAuditioningId(null),
    });
  };

  const handleNext = () => {
    playChime('tap');
    if (step < 4) {
      setStep((prev) => (prev + 1) as any);
    }
  };

  const handleBack = () => {
    playChime('tap');
    if (step > 1) {
      setStep((prev) => (prev - 1) as any);
    }
  };

  const handleFinish = (startPlacement: boolean) => {
    stopSpeaking();
    playChime('success');

    // Update global active persona
    setActivePersona(selectedPersonaId);

    // Apply selections to progress
    const matchingPace = PACES.find((p) => p.minutes === selectedMinutes) || PACES[1];
    onUpdateProgress((prev) => ({
      ...prev,
      nativeLanguage: selectedLanguage,
      dailyGoalMinutes: selectedMinutes,
      dailyGoalXP: matchingPace.xp,
      activePersonaId: selectedPersonaId,
      hasCompletedOnboarding: true,
    }));

    onComplete({
      goal: selectedGoal,
      coachId: selectedPersonaId,
      nativeLanguage: selectedLanguage,
      dailyMinutes: selectedMinutes,
      startPlacement,
    });
  };

  const currentCoach = ALL_PERSONAS[selectedPersonaId] || ALL_PERSONAS.james;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transition-all">
        {/* Top Progress Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#2a323d] to-[#151a22] p-1 border border-slate-700/60 shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src={logoMark} alt="Fluency AI" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Quick Setup • Step {step} of 4
              </span>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {step === 1 && 'Your English Speaking Goal'}
                {step === 2 && 'Choose Your Coach & Language'}
                {step === 3 && 'Your Daily Commitment'}
                {step === 4 && 'Ready for Launch'}
              </div>
            </div>
          </div>

          {/* Stepper dots */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-6 bg-brand-600 dark:bg-brand-400'
                    : s < step
                    ? 'w-2 bg-emerald-500'
                    : 'w-2 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* STEP 1: GOAL SELECTION */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center max-w-md mx-auto space-y-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Why are you learning spoken English?
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  We'll adapt your daily scenarios and AI dialogue prompts to match your focus.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 pt-2">
                {GOALS.map((goal) => {
                  const isSelected = selectedGoal === goal.id;
                  return (
                    <button
                      key={goal.id}
                      onClick={() => {
                        playChime('tap');
                        setSelectedGoal(goal.id);
                      }}
                      className={`relative w-full p-4 rounded-2xl border text-left transition-all active:scale-[0.99] flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 ring-2 ring-brand-500/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="text-2xl p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                          {goal.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {goal.title}
                            </span>
                            {goal.badge && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300">
                                {goal.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {goal.subtitle}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                          isSelected
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: COACH & NATIVE LANGUAGE */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center max-w-md mx-auto space-y-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Meet Your AI Voice Coach
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Listen to their natural British accent and choose who fits your style.
                </p>
              </div>

              {/* Coach Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {Object.values(ALL_PERSONAS).map((persona) => {
                  const isSelected = selectedPersonaId === persona.id;
                  const isAuditioning = auditioningId === persona.id;

                  return (
                    <div
                      key={persona.id}
                      onClick={() => {
                        playChime('tap');
                        setSelectedPersonaId(persona.id as PersonaId);
                      }}
                      className={`relative p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 ring-2 ring-brand-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                            {persona.avatar}
                          </span>
                          <div>
                            <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                              {persona.name}
                              {isSelected && (
                                <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400">
                                  Selected
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                              {persona.role}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAudition(persona);
                          }}
                          className={`p-2 rounded-xl transition ${
                            isAuditioning
                              ? 'bg-brand-600 text-white animate-pulse'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-brand-100 hover:text-brand-700'
                          }`}
                          title="Preview voice pronunciation"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 italic">
                        "{persona.greeting}"
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Native Language Selector */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-brand-600" />
                  Your Native Language (for translation hints):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {LANGUAGES.map((item) => (
                    <button
                      key={item.lang}
                      type="button"
                      onClick={() => {
                        playChime('tap');
                        setSelectedLanguage(item.lang);
                      }}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border text-left flex items-center gap-2 transition ${
                        selectedLanguage === item.lang
                          ? 'border-brand-500 bg-brand-500 text-white shadow-2xs'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>{item.flag}</span>
                      <span className="truncate">{item.lang}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DAILY COMMITMENT */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center max-w-md mx-auto space-y-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Choose Your Daily Habit Pace
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Consistency builds fluency faster than cramming. You can change this anytime.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {PACES.map((pace) => {
                  const isSelected = selectedMinutes === pace.minutes;
                  return (
                    <button
                      key={pace.minutes}
                      onClick={() => {
                        playChime('tap');
                        setSelectedMinutes(pace.minutes);
                      }}
                      className={`w-full p-4 rounded-2xl border text-left transition-all active:scale-[0.99] flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 ring-2 ring-brand-500/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="text-2xl p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                          {pace.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                              {pace.title}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300">
                              {pace.subtitle}
                            </span>
                            {pace.isRecommended && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-400 text-amber-950">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {pace.desc}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>+{pace.xp} XP</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: READY TO BEGIN */}
          {step === 4 && (
            <div className="space-y-5 animate-fade-in text-center max-w-md mx-auto py-2">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-brand-500 via-indigo-500 to-purple-500 text-white flex items-center justify-center text-3xl shadow-soft">
                {currentCoach.avatar}
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  You're Ready to Speak!
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {currentCoach.name} is configured for {selectedMinutes} mins/day, supporting{' '}
                  <span className="font-bold text-brand-600 dark:text-brand-400">
                    {selectedLanguage}
                  </span>{' '}
                  translations.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                {/* Option 1: Take 2-min interactive placement */}
                <button
                  onClick={() => handleFinish(true)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-sm shadow-md hover:shadow-lg transition active:scale-98 flex items-center justify-center gap-2 group"
                >
                  <Compass className="w-4 h-4 text-amber-200 group-hover:rotate-45 transition-transform" />
                  <span>🎙️ Find My CEFR Level (2-min Check)</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Option 2: Jump straight into Day 1 Practice */}
                <button
                  onClick={() => handleFinish(false)}
                  className="w-full py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition active:scale-98"
                >
                  🚀 Jump Straight to Daily Roleplay Practice
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              Skip for now
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-soft transition active:scale-95"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
