import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Mic,
  Volume2,
  VolumeX,
  Send,
  RotateCcw,
  Sparkles,
  Zap,
  Server,
  Award,
  Pencil,
  Check,
  Bot,
} from 'lucide-react';
import { speakEnglish, stopSpeaking, playChime } from '../services/speech';
import type { RecordedAudioClip } from '../services/audioRecorder';
import {
  generateJamesReply,
  generateGeminiScorecard,
  type AudioAttachment,
  type ChatMessage,
  type DynamicScorecardResult,
} from '../services/geminiService';
import { getLLMConfig, type LLMConfig } from '../services/llmConfig';
import { AIGatewaySettingsModal } from './AIGatewaySettingsModal';
import type { AIPersona, CEFRLevel, LessonPlan } from '../types';
import {
  useGamificationStore,
  getAvailableAudioSpeeds,
  calculateEarnedXP,
  awardGamificationXP,
} from '../store/rewardSystem';
import { useVoiceCapture } from '../hooks/useVoiceCapture';
import { InteractiveTranscriptText, WordLookupModal } from './WordLookupPopover';

interface Turn {
  id: string;
  speaker: 'ai' | 'user';
  text: string;
  latencyMs?: number;
  isMock?: boolean;
  timestamp: string;
}

interface TopicPreset {
  id: string;
  name: string;
  icon: string;
  badge: string;
  title: string;
  greeting: (coachName: string) => string;
  description: string;
  quickPrompts: string[];
}

const FREE_TALK_TOPICS: TopicPreset[] = [
  {
    id: 'casual-banter',
    name: 'Daily Catch-Up & Banter',
    icon: '☕',
    badge: 'Everyday Fluency',
    title: 'Casual British Small Talk & Coffee Catch-Up',
    greeting: () => "Proper British weather out there today, isn't it? Fancy a quick catch-up over a brew?",
    description: 'Practice natural small talk, idioms, weekend plans, and spontaneous everyday conversation.',
    quickPrompts: [
      "Absolute downpour out there! A hot tea sounds wonderful.",
      "How has your week been going so far?",
      "Any recommendations for a great spot to unwind after work?",
      "I'm trying to sound more natural in casual British chats.",
    ],
  },
  {
    id: 'office-welcome',
    name: 'Workplace & Team Chat',
    icon: '🏢',
    badge: 'Workplace English',
    title: 'Your First Day at a UK Office',
    greeting: () => "Welcome aboard! Great to catch up in person. How was your journey in this morning?",
    description: 'Chat about team priorities, project updates, and polite workplace diplomacy.',
    quickPrompts: [
      "Good morning! Really excited to be working with the team.",
      "The commute was busy, but I made it right on time!",
      "Could you walk me through our main priorities for this week?",
      "Where can I grab the best coffee around here?",
    ],
  },
  {
    id: 'pronunciation-drill',
    name: 'Pronunciation Coach',
    icon: '🔤',
    badge: 'Syllables & Stress',
    title: 'Interactive Pronunciation & Accent Coaching',
    greeting: () =>
      "Right then! Need a hand with tricky British pronunciation? Ask me how to pronounce any word, and I'll break down the syllables and stress for you.",
    description: 'Ask how to pronounce tricky words and practice saying them back with real-time syllable stress tips.',
    quickPrompts: [
      "How do I pronounce Worcestershire?",
      "Could you teach me how to pronounce Gloucestershire?",
      "How is comfortable pronounced in British English?",
      "Can you break down the word schedule for me?",
    ],
  },
  {
    id: 'politeness-coach',
    name: 'Polite Phrasing Practice',
    icon: '✨',
    badge: 'Natural Upgrades',
    title: 'British Politeness & Diplomatic Phrasing',
    greeting: () =>
      "I'm all ears! Try out any requests, emails, or tricky situations with me and we'll make them sound effortlessly natural.",
    description: 'Practice softening direct requests, disagreeing politely, and using natural British modals.',
    quickPrompts: [
      "How can I politely ask a colleague to send a late report?",
      "I need to reschedule a meeting with my manager.",
      "Can you explain the difference between keen on and fond of?",
      "How do I politely say no to extra work when I'm busy?",
    ],
  },
  {
    id: 'job-interview',
    name: 'Mock Interview',
    icon: '💼',
    badge: 'Career Prep',
    title: 'UK Professional Role Interview',
    greeting: () =>
      "Thanks for joining today. To start off, could you tell me a little about yourself and what excites you most about your work?",
    description: 'Practice confident, structured answers to professional interview questions.',
    quickPrompts: [
      "I have over five years of experience leading cross-functional projects.",
      "I'm keen to work in a collaborative international environment.",
      "Could you tell me more about how your team approaches new projects?",
      "I thrive in environments where clear communication and ownership are valued.",
    ],
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  audioSpeed?: number;
  persona?: AIPersona;
  userLevel?: CEFRLevel;
  onOpenLessonRoleplay?: () => void;
}

export const JamesTestAreaModal: React.FC<Props> = ({
  isOpen,
  onClose,
  audioSpeed = 0.9,
  persona: activePersonaProp,
  userLevel = 'B1',
  onOpenLessonRoleplay,
}) => {
  const coach: AIPersona = React.useMemo(
    () =>
      activePersonaProp || {
        name: 'James',
        role: 'Team Lead, London',
        avatar: '🧑‍💼',
        accent: 'UK',
        greeting: FREE_TALK_TOPICS[0].greeting('James'),
        tone: 'Warm, sharp, polite British manager',
      },
    [activePersonaProp]
  );

  const [selectedScenario, setSelectedScenario] = useState<TopicPreset>(FREE_TALK_TOPICS[0]);
  const [turns, setTurns] = useState<Turn[]>(() => [
    {
      id: 'ai-init',
      speaker: 'ai',
      text: FREE_TALK_TOPICS[0].greeting(coach.name),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [currentSpeed, setCurrentSpeed] = useState<number>(audioSpeed);
  const [isMuted, setIsMuted] = useState(false);
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(getLLMConfig);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [showDevToggle, setShowDevToggle] = useState(false);

  const {
    currentTier,
    currentTierConfig,
    totalXP,
    streakDays,
    pronunciationAvg,
    devAddXP,
    devSetTier,
    devReset,
  } = useGamificationStore();

  const availableSpeeds = getAvailableAudioSpeeds(currentTier);

  const [isAnalyzingScorecard, setIsAnalyzingScorecard] = useState(false);
  const [scorecardResult, setScorecardResult] = useState<DynamicScorecardResult | null>(null);
  const [showScorecardModal, setShowScorecardModal] = useState(false);

  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [editTextValue, setEditTextValue] = useState('');
  const [lookupWord, setLookupWord] = useState<{ word: string; sentence: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);

  const speakText = useCallback(
    (text: string) => {
      if (isMuted) return;
      stopSpeaking();
      speakEnglish(text, {
        rate: currentSpeed,
        accent: coach.accent || 'UK',
        personaName: coach.name,
        onStart: () => setIsAiSpeaking(true),
        onEnd: () => setIsAiSpeaking(false),
      });
    },
    [coach.accent, coach.name, currentSpeed, isMuted]
  );

  const handleUserMessage = useCallback(
    async (rawMessage: string, audioClip?: RecordedAudioClip | null) => {
      const text = rawMessage.trim();
      if (!text) return;

      stopSpeaking();
      setIsAiSpeaking(false);
      setIsProcessing(true);

      let audioAttachment: AudioAttachment | null = null;
      if (audioClip && audioClip.base64) {
        audioAttachment = {
          base64: audioClip.base64,
          mimeType: audioClip.mimeType,
        };
      }

      const userTurn: Turn = {
        id: `u-${Date.now()}`,
        speaker: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const newTurns = [...turns, userTurn];
      setTurns(newTurns);
      playChime('tap');

      const startTime = performance.now();
      try {
        const historyForGemini: ChatMessage[] = newTurns.map((t) => ({
          speaker: t.speaker,
          text: t.text,
        }));

        const reply = await generateJamesReply(
          historyForGemini,
          selectedScenario.title,
          [
            "Brilliant! Lovely chatting with you — tell me a bit more about what's on your mind.",
            "Spot on. That sounds really natural.",
            "Splendid! What else would you like to talk about today?",
          ],
          coach,
          audioAttachment,
          userLevel
        );

        const latency = Math.round(performance.now() - startTime);
        setLastLatency(latency);

        const aiTurn: Turn = {
          id: `ai-${Date.now()}`,
          speaker: 'ai',
          text: reply,
          latencyMs: latency,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setTurns((prev) => [...prev, aiTurn]);
        speakText(reply);

        const xpResult = calculateEarnedXP('james-test-lab', 10, pronunciationAvg, streakDays);
        awardGamificationXP(xpResult, 1);
      } catch (err) {
        console.warn('[FreeTalk] Reply error:', err);
        const fallback = "Lovely speaking with you! Keep going — what else would you like to practice?";
        const latency = Math.round(performance.now() - startTime);
        setLastLatency(latency);

        setTurns((prev) => [
          ...prev,
          {
            id: `ai-err-${Date.now()}`,
            speaker: 'ai',
            text: fallback,
            latencyMs: latency,
            isMock: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        speakText(fallback);
      } finally {
        setIsProcessing(false);
      }
    },
    [coach, pronunciationAvg, selectedScenario.title, speakText, streakDays, turns, userLevel]
  );

  const {
    isRecording,
    isHolding,
    bands,
    livePreview,
    recordedClipsRef,
    pronunciationMetadataRef,
    cleanupAudio,
    onPointerDown,
    onPointerUp,
  } = useVoiceCapture({
    lang: coach.accent === 'US' ? 'en-US' : 'en-GB',
    onBeforeStart: () => setIsAiSpeaking(false),
    onCompleteCapture: handleUserMessage,
  });

  useEffect(() => {
    const handleConfigChange = () => {
      setLlmConfig(getLLMConfig());
    };
    window.addEventListener('fluency_llm_config_changed', handleConfigChange);
    return () => window.removeEventListener('fluency_llm_config_changed', handleConfigChange);
  }, []);

  const resetScenario = useCallback(
    (scenario: TopicPreset) => {
      cleanupAudio();
      setIsProcessing(false);
      setIsAiSpeaking(false);
      setScorecardResult(null);
      setShowScorecardModal(false);
      setLastLatency(null);

      const greetingText = scenario.greeting(coach.name);
      const initialTurn: Turn = {
        id: `ai-init-${Date.now()}`,
        speaker: 'ai',
        text: greetingText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setTurns([initialTurn]);

      if (!isMuted) {
        window.setTimeout(() => {
          speakText(greetingText);
        }, 350);
      }
    },
    [cleanupAudio, coach.name, isMuted, speakText]
  );

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      const greetingText = selectedScenario.greeting(coach.name);
      if (!isMuted) {
        window.setTimeout(() => {
          speakText(greetingText);
        }, 350);
      }
    } else if (!isOpen) {
      cleanupAudio();
    }
    prevOpenRef.current = isOpen;
  }, [cleanupAudio, coach.name, isMuted, isOpen, selectedScenario, speakText]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, livePreview, isProcessing]);

  const handleSendTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim() || isProcessing) return;
    const text = typedInput.trim();
    setTypedInput('');
    handleUserMessage(text);
  };

  const handleSaveTurnEdit = (turnId: string) => {
    if (!editTextValue.trim()) {
      setEditingTurnId(null);
      return;
    }
    const updated = turns.map((t) => (t.id === turnId ? { ...t, text: editTextValue.trim() } : t));
    setTurns(updated);
    setEditingTurnId(null);
    setEditTextValue('');
  };

  const handleRunScorecardTest = async () => {
    const userTurnsList = turns.filter((t) => t.speaker === 'user').map((t) => t.text);
    if (userTurnsList.length === 0) {
      alert(`Speak or type at least one turn to ${coach.name} before requesting feedback.`);
      return;
    }

    setIsAnalyzingScorecard(true);
    setShowScorecardModal(true);

    const dummyPlan: LessonPlan = {
      id: 'free-talk-plan',
      title: selectedScenario.title,
      contextLabel: selectedScenario.name,
      persona: coach,
      xpReward: 35,
      minutes: 5,
      phrases: [],
      aiTurns: [selectedScenario.greeting(coach.name)],
      mockUserReplies: userTurnsList,
      upgrades: [],
      helpPhrases: [],
    };

    try {
      const result = await generateGeminiScorecard({
        plan: dummyPlan,
        userTurns: userTurnsList,
        phraseScores: [88, 92, 85],
        audioClips: recordedClipsRef.current,
        pronunciationMetadata: pronunciationMetadataRef.current,
      });
      setScorecardResult(result);
    } catch (err) {
      console.warn('[FreeTalk] Scorecard analysis error:', err);
    } finally {
      setIsAnalyzingScorecard(false);
    }
  };

  const avgBandAmp =
    bands.length > 0 ? bands.reduce((acc, v) => acc + v, 0) / bands.length : 0;
  const voiceBloomScale = isRecording ? 1 + Math.min(0.4, avgBandAmp * 0.75) : 1;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 animate-fade-in">
        <div className="relative w-full sm:max-w-2xl h-[100dvh] max-h-[100dvh] sm:h-[88vh] sm:max-h-[88vh] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-transparent sm:border-slate-200 dark:border-slate-800">
          {/* Header */}
          <header className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-brand-700 via-indigo-700 to-sky-700 text-white flex-shrink-0 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-lg sm:text-xl shadow-inner flex-shrink-0">
                  {coach.avatar || '🧑‍💼'}
                  {isAiSpeaking && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-brand-700 animate-pulse" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h1 className="text-xs sm:text-sm font-black tracking-tight truncate">
                      Free Talk with {coach.name}
                    </h1>
                    <span className="hidden xs:inline-block px-2 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-300/40 text-emerald-200 text-[10px] font-extrabold tracking-wider uppercase flex-shrink-0">
                      Live Voice
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-brand-100/90 truncate">
                    {coach.role} • Spontaneous coaching
                  </p>
                </div>
              </div>

              {/* Action buttons in header */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <button
                  onClick={() => {
                    playChime('tap');
                    const unlocked = availableSpeeds.filter((s) => s.unlocked).map((s) => s.speed);
                    const speeds = unlocked.length > 0 ? unlocked : [0.85];
                    const currentIndex = speeds.indexOf(currentSpeed);
                    const next = currentIndex >= 0 ? speeds[(currentIndex + 1) % speeds.length] : speeds[0];
                    setCurrentSpeed(next);
                  }}
                  className="px-2 py-1 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-[11px] font-bold text-white transition flex items-center gap-1"
                  title={`Speed: ${currentSpeed}x · Click to toggle speech speed`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>{currentSpeed}x</span>
                </button>

                <button
                  onClick={() => {
                    playChime('tap');
                    if (!isMuted) stopSpeaking();
                    setIsMuted((m) => !m);
                  }}
                  className={`p-1.5 rounded-xl transition active:scale-95 ${
                    isMuted ? 'bg-rose-500/80 text-white' : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                  title={isMuted ? 'Speech output muted' : 'Mute speech output'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => {
                    playChime('tap');
                    setShowGatewayModal(true);
                  }}
                  className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition"
                  title="Configure AI Gateway & Keys"
                >
                  <Server className="w-4 h-4 text-emerald-300" />
                </button>

                <button
                  onClick={() => {
                    playChime('tap');
                    setShowDevToggle((prev) => !prev);
                  }}
                  className={`p-1.5 rounded-xl transition active:scale-95 text-[11px] font-bold ${
                    showDevToggle
                      ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                  title="Toggle Gamification Simulator"
                >
                  <span>🛠️</span>
                </button>

                <button
                  onClick={() => {
                    stopSpeaking();
                    onClose();
                  }}
                  className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition"
                  aria-label="Close Free Talk"
                >
                  <X className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Topic Selector Pills (Wrapped cleanly on mobile) */}
            <div className="mt-2.5 flex items-center flex-wrap gap-1.5 pb-0.5">
              {FREE_TALK_TOPICS.map((sc) => {
                const isActive = sc.id === selectedScenario.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => {
                      playChime('tap');
                      setSelectedScenario(sc);
                      resetScenario(sc);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all active:scale-95 ${
                      isActive
                        ? 'bg-white text-brand-900 shadow-md font-extrabold'
                        : 'bg-white/15 hover:bg-white/25 text-white/90 border border-white/10'
                    }`}
                  >
                    <span>{sc.icon}</span>
                    <span>{sc.name}</span>
                  </button>
                );
              })}
            </div>
          </header>

          {/* Compact Action Sub-bar */}
          <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedScenario.badge}</span>
              {lastLatency !== null && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                  ⚡ {lastLatency}ms
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => resetScenario(selectedScenario)}
                className="hover:text-brand-600 flex items-center gap-1 transition"
                title="Restart conversation"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restart</span>
              </button>

              {turns.filter((t) => t.speaker === 'user').length > 0 && (
                <button
                  onClick={handleRunScorecardTest}
                  className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1 transition"
                  title="Get instant phrasing & pronunciation feedback"
                >
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Get Feedback</span>
                </button>
              )}
            </div>
          </div>

          {/* Optional Dev Gamification Controls Bar (collapsed by default) */}
          {showDevToggle && (
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Simulator ({llmConfig.provider}):
                </span>
                <span className="text-[10px] font-bold text-slate-300 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                  {currentTierConfig.badgeAccent.icon} {currentTierConfig.name} ({totalXP.toLocaleString()} XP)
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => {
                    playChime('tap');
                    devAddXP(100);
                  }}
                  className="px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] transition active:scale-95 shadow-sm"
                >
                  +100 XP
                </button>
                <button
                  onClick={() => {
                    playChime('tap');
                    devSetTier('silver');
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-[11px] transition active:scale-95"
                >
                  🥈 Silver
                </button>
                <button
                  onClick={() => {
                    playChime('tap');
                    devSetTier('gold');
                  }}
                  className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] transition active:scale-95"
                >
                  🥇 Gold
                </button>
                <button
                  onClick={() => {
                    playChime('tap');
                    devSetTier('platinum');
                  }}
                  className="px-2 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-[11px] transition active:scale-95"
                >
                  💠 Platinum
                </button>
                <button
                  onClick={() => {
                    playChime('tap');
                    devSetTier('diamond');
                  }}
                  className="px-2 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[11px] transition active:scale-95"
                >
                  💎 Diamond
                </button>
                <button
                  onClick={() => {
                    playChime('tap');
                    devReset();
                  }}
                  className="px-1.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-bold transition active:scale-95"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Conversation Starters Banner */}
          <div className="px-4 py-2 bg-gradient-to-r from-brand-50 to-sky-50 dark:from-slate-800 dark:to-slate-800/80 border-b border-brand-100/60 dark:border-slate-700 overflow-x-auto no-scrollbar flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400 flex items-center gap-1 flex-shrink-0">
              <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> Starters:
            </span>
            {selectedScenario.quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleUserMessage(prompt)}
                disabled={isProcessing}
                className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-brand-100/70 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 hover:text-brand-900 dark:hover:text-white border border-slate-200/90 dark:border-slate-600 text-xs font-medium transition shadow-2xs active:scale-95 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Feed */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-950"
          >
            {turns.map((turn) => {
              const isAi = turn.speaker === 'ai';
              return (
                <div
                  key={turn.id}
                  className={`flex items-start gap-2.5 ${isAi ? 'justify-start' : 'justify-end'}`}
                >
                  {isAi && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-sky-500 text-white flex items-center justify-center text-sm shadow-xs flex-shrink-0 mt-0.5">
                      {coach.avatar || '🧑‍💼'}
                    </div>
                  )}

                  <div className={`max-w-[85%] group ${isAi ? '' : 'items-end'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold text-slate-400">
                        {isAi ? coach.name : 'You'}
                      </span>
                      <span className="text-[9px] text-slate-400">{turn.timestamp}</span>
                    </div>

                    <div
                      className={`relative p-3.5 rounded-2xl text-sm leading-relaxed shadow-xs ${
                        isAi
                          ? 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-tl-sm'
                          : 'bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-tr-sm'
                      }`}
                    >
                      {editingTurnId === turn.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editTextValue}
                            onChange={(e) => setEditTextValue(e.target.value)}
                            className="w-full p-2 rounded-xl text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-brand-300 dark:border-brand-700 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                            rows={2}
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setEditingTurnId(null)}
                              className="px-2 py-1 rounded-lg bg-white/20 text-xs font-semibold hover:bg-white/30"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveTurnEdit(turn.id)}
                              className="px-2.5 py-1 rounded-lg bg-white text-brand-700 text-xs font-bold shadow-xs hover:bg-brand-50 flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">
                          <InteractiveTranscriptText
                            text={turn.text}
                            onSelectWord={(w, s) => setLookupWord({ word: w, sentence: s })}
                          />
                        </div>
                      )}

                      {isAi && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <button
                            onClick={() => {
                              playChime('tap');
                              speakText(turn.text);
                            }}
                            className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800 transition"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Listen again</span>
                          </button>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(turn.text);
                              playChime('tap');
                            }}
                            className="text-[10px] text-slate-400 hover:text-slate-600 transition"
                          >
                            Copy
                          </button>
                        </div>
                      )}

                      {!isAi && editingTurnId !== turn.id && (
                        <button
                          onClick={() => {
                            setEditingTurnId(turn.id);
                            setEditTextValue(turn.text);
                          }}
                          className="absolute -left-7 top-2 p-1 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition"
                          title="Edit what you said"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isRecording && livePreview && (
              <div className="flex justify-end animate-pulse">
                <div className="max-w-[85%] p-3 rounded-2xl bg-brand-500/80 text-white text-sm border border-brand-400/40 rounded-tr-sm shadow-md">
                  <div className="text-[10px] font-bold text-brand-200 mb-0.5">Listening live…</div>
                  <div>{livePreview}</div>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium py-2">
                <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center animate-spin">
                  <Bot className="w-4 h-4" />
                </div>
                <span>{coach.name} is replying…</span>
              </div>
            )}

            {isAiSpeaking && (
              <div className="flex items-center gap-2 text-indigo-500 text-xs font-semibold py-1 animate-pulse">
                <Volume2 className="w-4 h-4" />
                <span>{coach.name} is speaking…</span>
              </div>
            )}
          </div>

          {/* Sleek Silky Voice & Text Input Bar */}
          <div className="px-4 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex-shrink-0 space-y-2 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center flex-shrink-0">
                {/* Ambient breathing radial bloom */}
                <span
                  className={`absolute -inset-3.5 rounded-full pointer-events-none transition-all duration-500 ease-out ${
                    isRecording
                      ? 'silky-orb-active-bloom opacity-100'
                      : 'bg-indigo-500/15 dark:bg-indigo-400/15 blur-lg silky-orb-idle'
                  }`}
                  style={
                    isRecording
                      ? { transform: `scale(${voiceBloomScale})` }
                      : undefined
                  }
                />

                {/* Silky rotating aurora halo */}
                <span
                  className={`absolute -inset-1.5 rounded-full blur-xs pointer-events-none transition-all duration-500 ease-out ${
                    isRecording
                      ? 'silky-orb-active-aura opacity-95'
                      : 'opacity-0 scale-75'
                  }`}
                  style={
                    isRecording
                      ? { transform: `scale(${voiceBloomScale * 0.98})` }
                      : undefined
                  }
                />

                <button
                  type="button"
                  onPointerDown={(e) => onPointerDown(e, isProcessing)}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={isProcessing}
                  className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full text-white transition-all duration-500 ease-out touch-none select-none cursor-pointer disabled:opacity-40 ${
                    isRecording
                      ? 'bg-gradient-to-tr from-indigo-600 via-violet-500 to-sky-400 scale-105 shadow-[0_0_24px_rgba(99,102,241,0.65),inset_0_1px_3px_rgba(255,255,255,0.65)]'
                      : 'bg-gradient-to-tr from-brand-600 via-indigo-500 to-sky-500 hover:scale-[1.04] active:scale-95 shadow-[0_4px_16px_rgba(59,130,246,0.35),inset_0_1px_2px_rgba(255,255,255,0.45)]'
                  }`}
                  title={
                    isRecording
                      ? isHolding
                        ? 'Release to finish'
                        : 'Tap again to finish'
                      : 'Hold to talk, or tap to start and tap again to end'
                  }
                >
                  <Mic
                    className={`w-5 h-5 transition-transform duration-300 ${
                      isRecording ? 'scale-110 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'text-white'
                    }`}
                  />
                </button>
              </div>

              <form onSubmit={handleSendTyped} className="flex-1 flex items-center gap-1.5">
                <input
                  type="text"
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  placeholder={
                    isRecording
                      ? isHolding
                        ? 'Listening… release button when finished'
                        : 'Listening… tap button again when finished'
                      : `Hold or tap mic to speak, or type to ${coach.name}…`
                  }
                  disabled={isRecording || isProcessing}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-brand-500 dark:focus:border-brand-400 rounded-2xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none transition shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!typedInput.trim() || isProcessing || isRecording}
                  className="p-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white transition active:scale-95 disabled:opacity-40 disabled:hover:bg-brand-600 shadow-sm"
                  title={`Send message to ${coach.name}`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {onOpenLessonRoleplay && (
              <div className="pt-0.5 text-center">
                <button
                  onClick={() => {
                    stopSpeaking();
                    onClose();
                    onOpenLessonRoleplay();
                  }}
                  className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition underline underline-offset-2"
                >
                  Prefer structured practice? Start Today&apos;s Guided Roleplay &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scorecard Feedback Modal Drawer */}
      {showScorecardModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  {coach.name}&apos;s Conversation Feedback
                </h3>
              </div>
              <button
                onClick={() => setShowScorecardModal(false)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isAnalyzingScorecard ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {coach.name} is analyzing your phrasing and pronunciation…
                </p>
              </div>
            ) : scorecardResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800">
                    <div className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase">Fluency</div>
                    <div className="text-lg font-black text-brand-900 dark:text-brand-200">{scorecardResult.fluency}%</div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800">
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Pronunciation</div>
                    <div className="text-lg font-black text-emerald-900 dark:text-emerald-200">{scorecardResult.pronunciation}%</div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800">
                    <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase">Listening</div>
                    <div className="text-lg font-black text-sky-900 dark:text-sky-200">{scorecardResult.listening}%</div>
                  </div>
                </div>

                {scorecardResult.acousticFeedback && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <strong className="text-slate-900 dark:text-white">Accent &amp; Rhythm Note:</strong>{' '}
                    {scorecardResult.acousticFeedback}
                  </div>
                )}

                {scorecardResult.upgrades && scorecardResult.upgrades.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Phrasing Upgrades
                    </div>
                    {scorecardResult.upgrades.map((u, i) => (
                      <div key={i} className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                        <div className="text-rose-700 dark:text-rose-400 line-through font-medium">&ldquo;{u.whatYouSaid}&rdquo;</div>
                        <div className="text-emerald-800 dark:text-emerald-300 font-extrabold flex items-center gap-1">
                          <span>&rarr;</span> <span>&ldquo;{u.moreNatural}&rdquo;</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight pt-0.5">{u.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowScorecardModal(false)}
                  className="w-full py-2.5 rounded-2xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-500 transition"
                >
                  Continue Chatting
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No feedback available yet.</p>
            )}
          </div>
        </div>
      )}

      {showGatewayModal && (
        <AIGatewaySettingsModal
          isOpen={showGatewayModal}
          onClose={() => setShowGatewayModal(false)}
          onConnectionStatusChange={() => setLlmConfig(getLLMConfig())}
        />
      )}

      {/* Instant British Dictionary & Audio Lookup Popover */}
      {lookupWord && (
        <WordLookupModal
          word={lookupWord.word}
          contextSentence={lookupWord.sentence}
          scenarioTitle={selectedScenario.title}
          persona={coach}
          audioSpeed={currentSpeed}
          onClose={() => setLookupWord(null)}
        />
      )}
    </>
  );
};
