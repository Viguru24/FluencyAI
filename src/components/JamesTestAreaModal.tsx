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
  Square,
  Award,
  Pencil,
  Check,
  Bot
} from 'lucide-react';
import { WaveformVisualizer, type VisualizerMode } from './lesson/WaveformVisualizer';
import { speakEnglish, stopSpeaking, playChime } from '../services/speech';
import {
  startRecognition,
  isRecognitionSupported,
  type RecognitionHandle,
  type SpokenSegmentAnalysis
} from '../services/speechRecognition';
import { AudioRecorderController, type RecordedAudioClip } from '../services/audioRecorder';
import { AudioVisualizerController } from '../services/audioVisualizer';
import {
  generateJamesReply,
  generateGeminiScorecard,
  type AudioAttachment,
  type ChatMessage,
  type DynamicScorecardResult
} from '../services/geminiService';
import { getLLMConfig, type LLMConfig } from '../services/llmConfig';
import { AIGatewaySettingsModal } from './AIGatewaySettingsModal';
import type { AIPersona, LessonPlan } from '../types';
import {
  useGamificationStore,
  getAvailableAudioSpeeds,
  calculateEarnedXP,
  awardGamificationXP,
} from '../store/rewardSystem';

interface Turn {
  id: string;
  speaker: 'ai' | 'user';
  text: string;
  latencyMs?: number;
  isMock?: boolean;
  timestamp: string;
}

interface TestScenarioPreset {
  id: string;
  name: string;
  icon: string;
  badge: string;
  title: string;
  greeting: string;
  description: string;
  quickPrompts: string[];
}

const TEST_SCENARIOS: TestScenarioPreset[] = [
  {
    id: 'office-welcome',
    name: 'London Office First Day',
    icon: '🏢',
    badge: 'Flagship Roleplay',
    title: 'Your First Day at a UK Office',
    greeting: "Welcome aboard! Great to meet you in person. How was your journey in on the tube this morning?",
    description: 'James as your friendly London Team Lead welcoming you to the office, showing you around, and chatting about team priorities.',
    quickPrompts: [
      "Good morning James, really excited to be here!",
      "The Central line was packed, but I made it on time!",
      "Could you walk me through our team's main priorities?",
      "Where can I grab the best coffee around here?"
    ]
  },
  {
    id: 'pronunciation-drill',
    name: 'Pronunciation Doctor',
    icon: '🔤',
    badge: 'Acoustic & Syllable Drill',
    title: 'Interactive Pronunciation Coaching',
    greeting: "Right then! Need a hand with tricky British pronunciation? Ask me how to pronounce any word, and I'll break down the syllables and stress for you.",
    description: 'Test James’s real-time syllable breakdown and interactive drill mode ("Now tap your mic and say it back to me!").',
    quickPrompts: [
      "How do I pronounce Worcestershire?",
      "Could you teach me how to pronounce Gloucestershire?",
      "How is comfortable pronounced in British English?",
      "Can you break down the word queueing?"
    ]
  },
  {
    id: 'casual-banter',
    name: 'Pub & Small Talk',
    icon: '☕',
    badge: 'Social & Cultural',
    title: 'Casual British Small Talk & Banter',
    greeting: "Proper British weather out there today, isn't it? Fancy heading round the corner for a quick brew?",
    description: 'Test natural British humor, weather complaints, tea etiquette, and conversational idioms.',
    quickPrompts: [
      "Absolute downpour out there! A hot tea sounds wonderful.",
      "What is the golden rule of making tea in a British office?",
      "Are you watching the football this weekend?",
      "Any recommendations for a good pub near the office?"
    ]
  },
  {
    id: 'grammar-stress',
    name: 'Grammar & Politeness Test',
    icon: '🧐',
    badge: 'Error Handling',
    title: 'Politeness & Grammar Stress Testing',
    greeting: "I'm all ears! Go ahead and test me with tricky sentences, unusual phrasing, or common English slips.",
    description: 'Feed James non-standard grammar or blunt phrasing to test how gracefully he responds without breaking character.',
    quickPrompts: [
      "I want a flat white right now.",
      "Yesterday I go to the supermarket with car.",
      "I am agree with your proposal completely.",
      "Can you explain the difference between keen on and fond of?"
    ]
  },
  {
    id: 'job-interview',
    name: 'UK Job Interview',
    icon: '💼',
    badge: 'Professional',
    title: 'UK Senior Role Interview',
    greeting: "Thanks for joining us today. To start off, could you tell me a little about yourself and what drew you to this role?",
    description: 'Rigorous professional interview practice with challenging follow-up questions in British business English.',
    quickPrompts: [
      "I have over five years of experience leading cross-functional engineering teams.",
      "I'm keen to work in a collaborative London tech environment.",
      "Could you tell me more about how your team approaches quarterly sprints?",
      "I thrive in environments where autonomy and clear ownership are valued."
    ]
  }
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  audioSpeed?: number;
  onOpenLessonRoleplay?: () => void;
}

const HOLD_THRESHOLD_MS = 350;

export const JamesTestAreaModal: React.FC<Props> = ({
  isOpen,
  onClose,
  audioSpeed = 0.9,
  onOpenLessonRoleplay
}) => {
  const [selectedScenario, setSelectedScenario] = useState<TestScenarioPreset>(TEST_SCENARIOS[0]);
  const [turns, setTurns] = useState<Turn[]>(() => [
    {
      id: 'ai-init',
      speaker: 'ai',
      text: TEST_SCENARIOS[0].greeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bands, setBands] = useState<number[]>([]);
  const [livePreview, setLivePreview] = useState('');
  const [typedInput, setTypedInput] = useState('');
  const [currentSpeed, setCurrentSpeed] = useState<number>(audioSpeed);
  const [isMuted, setIsMuted] = useState(false);
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(getLLMConfig);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [showDevToggle, setShowDevToggle] = useState(true);

  // Gamification Store for real-time tier context & dev testing
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

  // Scorecard modal/drawer state
  const [isAnalyzingScorecard, setIsAnalyzingScorecard] = useState(false);
  const [scorecardResult, setScorecardResult] = useState<DynamicScorecardResult | null>(null);
  const [showScorecardModal, setShowScorecardModal] = useState(false);

  // Editable user bubble
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [editTextValue, setEditTextValue] = useState('');

  // Audio controllers
  const vizRef = useRef(new AudioVisualizerController());
  const recorderRef = useRef(new AudioRecorderController());
  const recRef = useRef<RecognitionHandle | null>(null);
  const recordedClipsRef = useRef<AudioAttachment[]>([]);
  const pronunciationMetadataRef = useRef<SpokenSegmentAnalysis[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Push-To-Talk tracking refs
  const pressStartTimeRef = useRef(0);
  const isPressingRef = useRef(false);
  const isHoldingRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const pendingStopRef = useRef(false);
  const prevOpenRef = useRef(false);

  const persona: AIPersona = {
    name: 'James',
    role: 'Team Lead, London',
    avatar: '🧑‍💼',
    accent: 'UK',
    greeting: selectedScenario.greeting,
    tone: 'Warm, sharp, polite British manager',
  };

  // Sync LLM config changes
  useEffect(() => {
    const handleConfigChange = () => {
      setLlmConfig(getLLMConfig());
    };
    window.addEventListener('fluency_llm_config_changed', handleConfigChange);
    return () => window.removeEventListener('fluency_llm_config_changed', handleConfigChange);
  }, []);

  // Initialize or reset scenario
  const resetScenario = useCallback((scenario: TestScenarioPreset) => {
    stopSpeaking();
    vizRef.current.stopMicrophone();
    recorderRef.current.stop().catch(() => {});
    recRef.current?.stop();
    setIsRecording(false);
    setIsProcessing(false);
    setIsAiSpeaking(false);
    setLivePreview('');
    setScorecardResult(null);
    setShowScorecardModal(false);
    setLastLatency(null);

    const initialTurn: Turn = {
      id: `ai-init-${Date.now()}`,
      speaker: 'ai',
      text: scenario.greeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setTurns([initialTurn]);

    // Speak James's opening line if unmuted
    if (!isMuted) {
      window.setTimeout(() => {
        speakEnglish(scenario.greeting, {
          rate: currentSpeed,
          accent: 'UK',
          personaName: 'James',
          onStart: () => setIsAiSpeaking(true),
          onEnd: () => setIsAiSpeaking(false),
        });
      }, 350);
    }
  }, [currentSpeed, isMuted]);

  // Handle open / close audio lifecycle
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      if (!isMuted) {
        window.setTimeout(() => {
          speakEnglish(selectedScenario.greeting, {
            rate: currentSpeed,
            accent: 'UK',
            personaName: 'James',
            onStart: () => setIsAiSpeaking(true),
            onEnd: () => setIsAiSpeaking(false),
          });
        }, 350);
      }
    } else if (!isOpen) {
      stopSpeaking();
      vizRef.current.stopMicrophone();
      recorderRef.current.stop().catch(() => {});
      recRef.current?.stop();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, isMuted, currentSpeed, selectedScenario.greeting]);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, livePreview, isProcessing]);

  // Speak AI reply
  const speakText = (text: string) => {
    if (isMuted) return;
    stopSpeaking();
    speakEnglish(text, {
      rate: currentSpeed,
      accent: 'UK',
      personaName: 'James',
      onStart: () => setIsAiSpeaking(true),
      onEnd: () => setIsAiSpeaking(false)
    });
  };

  // Submit a turn from the user (via voice or text)
  const handleUserMessage = async (rawMessage: string, audioClip?: RecordedAudioClip | null) => {
    const text = rawMessage.trim();
    if (!text) return;

    stopSpeaking();
    setIsAiSpeaking(false);
    setIsProcessing(true);

    let audioAttachment: AudioAttachment | null = null;
    if (audioClip && audioClip.base64) {
      audioAttachment = {
        base64: audioClip.base64,
        mimeType: audioClip.mimeType
      };
      recordedClipsRef.current.push(audioAttachment);
    }

    const userTurn: Turn = {
      id: `u-${Date.now()}`,
      speaker: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newTurns = [...turns, userTurn];
    setTurns(newTurns);
    playChime('tap');

    const startTime = performance.now();
    try {
      const historyForGemini: ChatMessage[] = newTurns.map((t) => ({
        speaker: t.speaker,
        text: t.text
      }));

      const reply = await generateJamesReply(
        historyForGemini,
        selectedScenario.title,
        [
          "Brilliant! Lovely chatting with you — tell me a bit more about what you'd like to test next.",
          "Spot on. That makes total sense in a London workplace context.",
          "Splendid! Anything else you'd like to drill or test with me today?"
        ],
        persona,
        audioAttachment
      );

      const latency = Math.round(performance.now() - startTime);
      setLastLatency(latency);

      const aiTurn: Turn = {
        id: `ai-${Date.now()}`,
        speaker: 'ai',
        text: reply,
        latencyMs: latency,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setTurns((prev) => [...prev, aiTurn]);
      speakText(reply);

      // Reward live speaking practice with James (+10 Base XP with active multipliers)
      const xpResult = calculateEarnedXP('james-test-lab', 10, pronunciationAvg, streakDays);
      awardGamificationXP(xpResult, 1);
    } catch (err) {
      console.warn('[JamesTestArea] Reply error:', err);
      const fallback = "I caught that! Testing James offline: Splendid job speaking out loud. What would you like to test next?";
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
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      speakText(fallback);
    } finally {
      setIsProcessing(false);
    }
  };

  // Start Voice Recording
  const startRecording = async () => {
    if (isRecording || isProcessing) return;
    pendingStopRef.current = false;
    stopSpeaking();
    setIsAiSpeaking(false);

    const ok = await vizRef.current.startMicrophone(setBands);
    if (!ok) {
      alert("Microphone permission was not granted. Please allow microphone access in your browser to talk to James.");
      return;
    }

    const stream = vizRef.current.getStream();
    await recorderRef.current.start(stream);

    playChime('tap');
    setIsRecording(true);
    setLivePreview('');

    recRef.current = isRecognitionSupported()
      ? startRecognition({
          lang: 'en-GB',
          silenceTimeoutMs: 0,
          onInterim: (text) => setLivePreview(text)
        })
      : null;

    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      stopRecording();
    }
  };

  // Stop Voice Recording
  const stopRecording = async () => {
    if (!isRecording) {
      pendingStopRef.current = true;
      return;
    }

    setIsRecording(false);
    setIsHolding(false);
    isHoldingRef.current = false;
    isPressingRef.current = false;

    let audioClip: RecordedAudioClip | null = null;
    try {
      audioClip = await recorderRef.current.stop();
    } catch (e) {
      console.warn('[JamesTestArea] Recorder stop error:', e);
    }

    vizRef.current.stopMicrophone();

    let heard = '';
    if (recRef.current) {
      const details = await recRef.current.stopWithDetails();
      recRef.current = null;
      if (details) {
        heard = details.transcript;
        if (details.segments.length > 0) {
          pronunciationMetadataRef.current.push(...details.segments);
        }
      }
    }

    const finalSpoken = livePreview.trim() || heard.trim();
    setLivePreview('');

    if (finalSpoken) {
      handleUserMessage(finalSpoken, audioClip);
    }
  };

  // Pointer event handlers for Push-To-Talk
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    if (isRecording) {
      stopRecording();
      return;
    }

    pressStartTimeRef.current = Date.now();
    isPressingRef.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    startRecording();

    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      if (isPressingRef.current) {
        setIsHolding(true);
        isHoldingRef.current = true;
      }
    }, HOLD_THRESHOLD_MS);
  };

  const onPointerUp = (e?: React.PointerEvent) => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!isPressingRef.current) return;
    const duration = Date.now() - pressStartTimeRef.current;
    isPressingRef.current = false;
    const wasHolding = isHoldingRef.current || duration >= HOLD_THRESHOLD_MS;
    setIsHolding(false);
    isHoldingRef.current = false;

    if (e) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    if (wasHolding) {
      stopRecording();
    }
  };

  const handleSendTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim() || isProcessing) return;
    const text = typedInput.trim();
    setTypedInput('');
    handleUserMessage(text);
  };

  // Re-run turn after editing user bubble
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

  // Test Scorecard Generator
  const handleRunScorecardTest = async () => {
    const userTurnsList = turns.filter((t) => t.speaker === 'user').map((t) => t.text);
    if (userTurnsList.length === 0) {
      alert("Speak or type at least one turn to James before running the CEFR scorecard evaluation.");
      return;
    }

    setIsAnalyzingScorecard(true);
    setShowScorecardModal(true);

    const dummyPlan: LessonPlan = {
      id: 'james-test-plan',
      title: selectedScenario.title,
      contextLabel: selectedScenario.name,
      persona,
      xpReward: 35,
      minutes: 5,
      phrases: [],
      aiTurns: [selectedScenario.greeting],
      mockUserReplies: userTurnsList,
      upgrades: [],
      helpPhrases: []
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
      console.warn('[JamesTestArea] Scorecard analysis error:', err);
    } finally {
      setIsAnalyzingScorecard(false);
    }
  };

  const visualizerMode: VisualizerMode = isRecording ? 'user' : isAiSpeaking ? 'ai' : 'idle';

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
        <div className="relative w-full sm:max-w-2xl h-[85vh] max-h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
          
          {/* Header */}
          <header className="px-4 py-3 bg-gradient-to-r from-brand-700 via-indigo-700 to-sky-700 text-white flex-shrink-0 shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
                  🧑‍💼
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm font-black tracking-tight truncate">James AI Test Lab</h1>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-300/40 text-emerald-200 text-[10px] font-extrabold tracking-wider uppercase">
                      🇬🇧 Direct Mode
                    </span>
                  </div>
                  <p className="text-[11px] text-brand-100/90 truncate">
                    Talk freely with James • Zero phrase preparation • Real-time British speech
                  </p>
                </div>
              </div>

              {/* Action buttons in header */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Audio Speed Pill with Tier Lock Awareness */}
                <button
                  onClick={() => {
                    playChime('tap');
                    const unlocked = availableSpeeds.filter((s) => s.unlocked).map((s) => s.speed);
                    const speeds = unlocked.length > 0 ? unlocked : [0.85];
                    const currentIndex = speeds.indexOf(currentSpeed);
                    const next = currentIndex >= 0 ? speeds[(currentIndex + 1) % speeds.length] : speeds[0];
                    setCurrentSpeed(next);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-[11px] font-bold text-white transition flex items-center gap-1.5"
                  title={`Speed: ${currentSpeed}x · Click to toggle tier speeds`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>{currentSpeed}x</span>
                </button>

                {/* Mute Toggle */}
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

                {/* Gateway config shortcut */}
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

                {/* Dev Controls Toggle */}
                <button
                  onClick={() => {
                    playChime('tap');
                    setShowDevToggle((prev) => !prev);
                  }}
                  className={`px-2 py-1 rounded-xl transition active:scale-95 text-[11px] font-bold flex items-center gap-1 ${
                    showDevToggle
                      ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                  title="Toggle Dev Gamification Simulator Bar"
                >
                  <span>🛠️</span>
                  <span className="hidden sm:inline">Dev Mode</span>
                </button>

                {/* Close Button */}
                <button
                  onClick={() => {
                    stopSpeaking();
                    onClose();
                  }}
                  className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white transition"
                  aria-label="Close James Test Area"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scenario Selector Carousel */}
            <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {TEST_SCENARIOS.map((sc) => {
                const isActive = sc.id === selectedScenario.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => {
                      playChime('tap');
                      setSelectedScenario(sc);
                      resetScenario(sc);
                    }}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
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

          {/* Diagnostic & Status Sub-bar */}
          <div className="px-4 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-800">
                {llmConfig.provider === 'freellmapi'
                  ? 'FreeLLMAPI (Unified Local)'
                  : llmConfig.apiKey
                  ? 'Gemini 2.5 Flash'
                  : 'Offline Scripted Mock'}
              </span>
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
                title="Restart conversation from turn 0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Chat</span>
              </button>

              {turns.filter((t) => t.speaker === 'user').length > 0 && (
                <button
                  onClick={handleRunScorecardTest}
                  className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1 transition"
                  title="Run CEFR grading on this conversation"
                >
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Test Scorecard</span>
                </button>
              )}
            </div>
          </div>

          {/* Dev Test Toggle & Gamification Controls Bar */}
          {showDevToggle && (
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Dev Gamification Simulator:
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
                  title="Simulate earning +100 XP (Triggers floating XP toast)"
                >
                  +100 XP
                </button>

                <button
                  onClick={() => {
                    playChime('tap');
                    devSetTier('silver');
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-[11px] transition active:scale-95"
                  title="Trigger Silver promotion"
                >
                  🥈 Silver
                </button>

                <button
                  onClick={() => {
                    playChime('tap');
                    devSetTier('gold');
                  }}
                  className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] transition active:scale-95"
                  title="Trigger Gold promotion"
                >
                  🥇 Gold
                </button>

                <button
                  onClick={() => {
                    playChime('tap');
                    devSetTier('platinum');
                  }}
                  className="px-2 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-[11px] transition active:scale-95"
                  title="Trigger Platinum promotion"
                >
                  💠 Platinum
                </button>

                <button
                  onClick={() => {
                    playChime('tap');
                    devSetTier('diamond');
                  }}
                  className="px-2 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[11px] transition active:scale-95"
                  title="Trigger Diamond promotion"
                >
                  💎 Diamond
                </button>

                <button
                  onClick={() => {
                    playChime('tap');
                    devReset();
                  }}
                  className="px-1.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-bold transition active:scale-95"
                  title="Reset Demo Gamification State"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Quick-Prompt Suggestions Banner */}
          <div className="px-4 py-2 bg-gradient-to-r from-brand-50 to-sky-50 border-b border-brand-100/60 overflow-x-auto no-scrollbar flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 flex items-center gap-1 flex-shrink-0">
              <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> Quick Tests:
            </span>
            {selectedScenario.quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleUserMessage(prompt)}
                disabled={isProcessing}
                className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-white hover:bg-brand-100/70 text-slate-700 hover:text-brand-900 border border-slate-200/90 text-xs font-medium transition shadow-2xs active:scale-95 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Feed */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-gradient-to-b from-slate-50/50 to-white"
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
                      🧑‍💼
                    </div>
                  )}

                  <div className={`max-w-[85%] group ${isAi ? '' : 'items-end'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold text-slate-400">
                        {isAi ? 'James' : 'You (Learner)'}
                      </span>
                      <span className="text-[9px] text-slate-400">{turn.timestamp}</span>
                      {turn.latencyMs && (
                        <span className="text-[9px] font-mono text-emerald-600 font-bold">
                          {turn.latencyMs}ms
                        </span>
                      )}
                    </div>

                    <div
                      className={`relative p-3.5 rounded-2xl text-sm leading-relaxed shadow-xs ${
                        isAi
                          ? 'bg-white border border-slate-200/80 text-slate-900 rounded-tl-sm'
                          : 'bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-tr-sm'
                      }`}
                    >
                      {editingTurnId === turn.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editTextValue}
                            onChange={(e) => setEditTextValue(e.target.value)}
                            className="w-full p-2 rounded-xl text-slate-900 bg-white border border-brand-300 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
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
                        <div className="whitespace-pre-wrap">{turn.text}</div>
                      )}

                      {/* AI bubble action bar (Replay audio) */}
                      {isAi && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <button
                            onClick={() => {
                              playChime('tap');
                              speakText(turn.text);
                            }}
                            className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800 transition"
                            title="Replay James speaking this"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Hear James speak</span>
                          </button>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(turn.text);
                              playChime('tap');
                            }}
                            className="text-[10px] text-slate-400 hover:text-slate-600 transition"
                            title="Copy text to clipboard"
                          >
                            Copy
                          </button>
                        </div>
                      )}

                      {/* User bubble edit pencil */}
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

            {/* Live speech preview */}
            {isRecording && livePreview && (
              <div className="flex justify-end animate-pulse">
                <div className="max-w-[85%] p-3 rounded-2xl bg-brand-500/80 text-white text-sm border border-brand-400/40 rounded-tr-sm shadow-md">
                  <div className="text-[10px] font-bold text-brand-200 mb-0.5">Listening live…</div>
                  <div>{livePreview}</div>
                </div>
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium py-2">
                <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center animate-spin">
                  <Bot className="w-4 h-4" />
                </div>
                <span>James is thinking and crafting British response…</span>
              </div>
            )}
          </div>

          {/* Interactive Speaking Visualizer & Push-To-Talk Bar */}
          <div className="px-4 py-3 bg-white border-t border-slate-200 flex-shrink-0 space-y-3 shadow-lg">
            
            {/* Visualizer center stage */}
            <div className="flex flex-col items-center justify-center">
              <div className="scale-75 -my-6">
                <WaveformVisualizer mode={visualizerMode} bands={bands} />
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-1 text-center">
                {isRecording
                  ? isHolding
                    ? 'Speaking (Hold-to-Talk) • Release to send to James'
                    : 'Speaking (Tap-to-Talk) • Mic wide open • Tap mic button again to send'
                  : isAiSpeaking
                  ? 'James is speaking — listen carefully'
                  : isProcessing
                  ? 'Generating British response…'
                  : 'Tap or Hold microphone to speak to James'}
              </div>
            </div>

            {/* Mic Button & Typed Input row */}
            <div className="flex items-center gap-2">
              {/* Push-To-Talk Button */}
              <button
                type="button"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                disabled={isProcessing}
                className={`relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all active:scale-95 flex-shrink-0 shadow-md ${
                  isRecording
                    ? 'bg-rose-500 text-white ring-4 ring-rose-300 animate-pulse'
                    : 'bg-gradient-to-tr from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-brand-500/30'
                } disabled:opacity-50`}
                title={isRecording ? 'Tap or release to finish' : 'Tap or hold to speak'}
              >
                {isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              {/* Typed Message Input */}
              <form onSubmit={handleSendTyped} className="flex-1 flex items-center gap-1.5">
                <input
                  type="text"
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  placeholder="Type a test phrase or question for James…"
                  disabled={isRecording || isProcessing}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-2xl text-xs sm:text-sm text-slate-800 outline-none transition shadow-inner placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!typedInput.trim() || isProcessing || isRecording}
                  className="p-3 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white transition active:scale-95 disabled:opacity-40 disabled:hover:bg-brand-600 shadow-sm"
                  title="Send message to James"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Fast Jump Link to full lesson */}
            {onOpenLessonRoleplay && (
              <div className="pt-1 text-center">
                <button
                  onClick={() => {
                    stopSpeaking();
                    onClose();
                    onOpenLessonRoleplay();
                  }}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 transition underline underline-offset-2"
                >
                  Prefer the full 3-Stage Daily Lesson? Jump directly to Stage 2 Live Roleplay &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scorecard Analysis Modal Drawer */}
      {showScorecardModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-slate-900 text-base">James's CEFR Feedback</h3>
              </div>
              <button
                onClick={() => setShowScorecardModal(false)}
                className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isAnalyzingScorecard ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-600">
                  James & Gemini are analyzing your spoken dialogue and acoustic intonation…
                </p>
              </div>
            ) : scorecardResult ? (
              <div className="space-y-4">
                {/* Score Pills */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-2xl bg-brand-50 border border-brand-200/80">
                    <div className="text-[10px] font-bold text-brand-600 uppercase">Fluency</div>
                    <div className="text-lg font-black text-brand-900">{scorecardResult.fluency}%</div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Pronunciation</div>
                    <div className="text-lg font-black text-emerald-900">{scorecardResult.pronunciation}%</div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-sky-50 border border-sky-200/80">
                    <div className="text-[10px] font-bold text-sky-600 uppercase">Listening</div>
                    <div className="text-lg font-black text-sky-900">{scorecardResult.listening}%</div>
                  </div>
                </div>

                {/* Acoustic feedback */}
                {scorecardResult.acousticFeedback && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    <strong className="text-slate-900">Acoustic & Accent Coaching:</strong>{' '}
                    {scorecardResult.acousticFeedback}
                  </div>
                )}

                {/* Phrasing Upgrades */}
                {scorecardResult.upgrades && scorecardResult.upgrades.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Phrasing & Politeness Upgrades
                    </div>
                    {scorecardResult.upgrades.map((u, i) => (
                      <div key={i} className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs space-y-1">
                        <div className="text-rose-700 line-through font-medium">"{u.whatYouSaid}"</div>
                        <div className="text-emerald-800 font-extrabold flex items-center gap-1">
                          <span>&rarr;</span> <span>"{u.moreNatural}"</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-tight pt-0.5">{u.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowScorecardModal(false)}
                  className="w-full py-2.5 rounded-2xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-500 transition"
                >
                  Close Feedback
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No scorecard data available yet.</p>
            )}
          </div>
        </div>
      )}

      {/* AI Gateway Settings Modal */}
      {showGatewayModal && (
        <AIGatewaySettingsModal
          isOpen={showGatewayModal}
          onClose={() => setShowGatewayModal(false)}
          onConnectionStatusChange={() => setLlmConfig(getLLMConfig())}
        />
      )}
    </>
  );
};
