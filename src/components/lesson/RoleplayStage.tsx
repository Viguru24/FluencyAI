import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Eye, EyeOff, LifeBuoy, Volume2, Flag, Loader2, Pencil, Check, Send, Square, ArrowRight, Zap } from 'lucide-react';
import type { CEFRLevel, LessonPlan, NativeLanguage, PhrasingUpgrade, PronunciationCoachingPoint, PronunciationFeedbackWord } from '../../types';
import { speakEnglish, stopSpeaking, playChime, isCurrentlySpeaking } from '../../services/speech';
import {
  startRecognition,
  isRecognitionSupported,
  extractWordsFromSpeechResults,
  type RecognitionHandle,
  type SpokenSegmentAnalysis,
  type WordConfidenceInfo,
} from '../../services/speechRecognition';
import { AudioRecorderController, type RecordedAudioClip } from '../../services/audioRecorder';
import { AudioVisualizerController } from '../../services/audioVisualizer';
import { WaveformVisualizer } from './WaveformVisualizer';
import { HowDoISaySheet } from './HowDoISaySheet';
import {
  generateJamesReply,
  generateGeminiScorecard,
  cleanTextForTTS,
  type AudioAttachment,
} from '../../services/geminiService';

interface Turn {
  id: string;
  speaker: 'ai' | 'user';
  text: string;
  revealed: boolean;
  isMock?: boolean;
  lowConfidenceWords?: string[];
  wordConfidences?: WordConfidenceInfo[];
}

export interface RoleplayStats {
  userTurns: string[];
  revealsUsed: number;
  helpRequests: number;
  aiTurnsHeard: number;
  fluencyScore?: number;
  pronunciationScore?: number;
  listeningScore?: number;
  dynamicUpgrades?: PhrasingUpgrade[];
  phrasesToReview?: string[];
  pronunciationCoachingPoints?: PronunciationCoachingPoint[];
  pronunciationFeedback?: PronunciationFeedbackWord[];
  acousticFeedback?: string;
  lowConfidenceWords?: string[];
}

interface Props {
  plan: LessonPlan;
  nativeLanguage: NativeLanguage;
  audioSpeed: number;
  userLevel?: CEFRLevel;
  phraseScores?: number[];
  onMicDenied: () => void;
  onEnd: (stats: RoleplayStats) => void;
}

const HOLD_THRESHOLD_MS = 350;

export const RoleplayStage: React.FC<Props> = ({
  plan,
  nativeLanguage,
  audioSpeed,
  userLevel,
  phraseScores = [],
  onMicDenied,
  onEnd,
}) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [aiIndex, setAiIndex] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzingScorecard, setIsAnalyzingScorecard] = useState(false);
  const [livePreview, setLivePreview] = useState('');
  const [liveLowConfidenceWords, setLiveLowConfidenceWords] = useState<string[]>([]);
  const [isEditingBubble, setIsEditingBubble] = useState(false);
  const [bubbleEditValue, setBubbleEditValue] = useState('');
  const [bands, setBands] = useState<number[]>([]);
  const [revealAll, setRevealAll] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [revealsUsed, setRevealsUsed] = useState(0);
  const [helpRequests, setHelpRequests] = useState(0);
  const [analyzingSeconds, setAnalyzingSeconds] = useState(0);
  const scorecardCancelledRef = useRef(false);

  useEffect(() => {
    let timer: any;
    if (isAnalyzingScorecard) {
      setAnalyzingSeconds(0);
      scorecardCancelledRef.current = false;
      timer = setInterval(() => {
        setAnalyzingSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isAnalyzingScorecard]);

  const handleSkipWaitAndProceed = () => {
    scorecardCancelledRef.current = true;
    setIsAnalyzingScorecard(false);
    const userTurnsList = turns.filter((t) => t.speaker === 'user').map((t) => t.text);
    onEnd({
      userTurns: userTurnsList,
      revealsUsed,
      helpRequests,
      aiTurnsHeard: turns.filter((t) => t.speaker === 'ai').length,
      lowConfidenceWords: Array.from(sessionLowConfidenceWordsRef.current),
    });
  };

  const vizRef = useRef(new AudioVisualizerController());
  const recorderRef = useRef(new AudioRecorderController());
  const recRef = useRef<RecognitionHandle | null>(null);
  const recordedClipsRef = useRef<AudioAttachment[]>([]);
  const pronunciationMetadataRef = useRef<SpokenSegmentAnalysis[]>([]);
  const sessionLowConfidenceWordsRef = useRef<Set<string>>(new Set());
  const userTurnCount = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEditingBubbleRef = useRef(false);
  isEditingBubbleRef.current = isEditingBubble;

  // Push-To-Talk tracking refs
  const pressStartTimeRef = useRef(0);
  const isPressingRef = useRef(false);
  const isHoldingRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const pendingStopRef = useRef(false);

  const userTurnsCount = turns.filter((t) => t.speaker === 'user').length;
  const currentTurn = userTurnsCount + 1;


  const handleStopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopSpeaking();
    setIsAiSpeaking(false);
  }, []);

  // Monitor active speech synthesis state to gracefully reset visualizer/button
  useEffect(() => {
    if (!isAiSpeaking) return;
    const interval = window.setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (!window.speechSynthesis.speaking && !isCurrentlySpeaking()) {
          setIsAiSpeaking(false);
        }
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [isAiSpeaking]);

  const speakAi = useCallback(
    (text: string) => {
      // Clean any accidental thinking tags, system markers, or brackets before sending to TTS
      const cleaned = cleanTextForTTS(text, plan.persona.name);
      if (!cleaned) return;

      speakEnglish(cleaned, {
        rate: audioSpeed,
        accent: plan.persona.accent,
        personaName: plan.persona.name,
        pitch: plan.persona.pitch,
        voicePreferences: plan.persona.ttsVoicePreference,
        gender: plan.persona.gender,
        onStart: () => setIsAiSpeaking(true),
        onEnd: () => setIsAiSpeaking(false),
      });
      setIsAiSpeaking(true);
    },
    [audioSpeed, plan.persona.accent, plan.persona.name, plan.persona.pitch, plan.persona.ttsVoicePreference, plan.persona.gender]
  );

  const pushAiTurn = useCallback(
    (index: number) => {
      const text = plan.aiTurns[index];
      if (!text) return;
      setTurns((t) => [...t, { id: `ai-${index}`, speaker: 'ai', text, revealed: false }]);
      setAiIndex(index + 1);
      speakAi(text);
    },
    [plan.aiTurns, speakAi]
  );

  // Kick off with James's opening line
  useEffect(() => {
    const t = window.setTimeout(() => pushAiTurn(0), 500);
    const viz = vizRef.current;
    const recorder = recorderRef.current;
    return () => {
      window.clearTimeout(t);
      stopSpeaking();
      viz.stopMicrophone();
      recorder.stop();
      recRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, livePreview]);

  const startRecording = async () => {
    if (isRecording || isProcessing) return;
    pendingStopRef.current = false;
    stopSpeaking();
    setIsAiSpeaking(false);

    const ok = await vizRef.current.startMicrophone(setBands);
    if (!ok) {
      onMicDenied();
      return;
    }

    // Simultaneously start MediaRecorder using the active microphone stream
    const activeStream = vizRef.current.getStream();
    await recorderRef.current.start(activeStream);

    playChime('tap');
    setIsRecording(true);
    setLivePreview('');
    setLiveLowConfidenceWords([]);
    setIsEditingBubble(false);
    setBubbleEditValue('');

    // Push-To-Talk Speaking Mode (Zero VAD / No auto-cutoff):
    // Continuous = true, interimResults = true, silenceTimeoutMs = 0
    // The mic stays wide open so the learner can pause for as long as they need to think
    recRef.current = isRecognitionSupported()
      ? startRecognition({
          lang: plan.persona.accent === 'UK' ? 'en-GB' : 'en-US',
          silenceTimeoutMs: 0,
          onInterim: (text) => {
            if (!isEditingBubbleRef.current) {
              setLivePreview(text);
            }
          },
          onSpeechResults: (eventResults) => {
            // Extract the confidence score for each word from the SpeechRecognitionResult array
            const extracted = extractWordsFromSpeechResults(eventResults);
            const lowConfWords = extracted
              .filter((w) => w.isLowConfidence || (w.confidence > 0 && w.confidence < 0.75))
              .map((w) => w.word);
            if (lowConfWords.length > 0) {
              setLiveLowConfidenceWords(Array.from(new Set(lowConfWords)));
            }
          },
        })
      : null;

    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      stopRecording();
    }
  };

  const stopRecording = async () => {
    if (!isRecording) {
      pendingStopRef.current = true;
      return;
    }
    setIsRecording(false);
    setIsHolding(false);
    isHoldingRef.current = false;
    isPressingRef.current = false;
    setIsProcessing(true);
    setIsEditingBubble(false);

    // Stop MediaRecorder and capture audio clip for Gemini 2.5 Flash / FreeLLMAPI
    let audioClip: RecordedAudioClip | null = null;
    try {
      audioClip = await recorderRef.current.stop();
    } catch (e) {
      console.warn('[RoleplayStage] Failed to stop audio recorder:', e);
    }

    // Stop audio visualizer
    vizRef.current.stopMicrophone();

    let heard: string | null = null;
    let turnLowConfidenceWords: string[] = [];
    let turnWordConfidences: WordConfidenceInfo[] = [];

    if (recRef.current) {
      const details = await recRef.current.stopWithDetails();
      recRef.current = null;
      if (details) {
        heard = details.transcript;

        // 1. Extract the confidence score for each word from the SpeechRecognitionResult array
        const extractedWords = details.rawResults
          ? extractWordsFromSpeechResults(details.rawResults)
          : details.allWords && details.allWords.length > 0
          ? details.allWords
          : [];

        turnWordConfidences = extractedWords;

        // 2. If any recognized word has a confidence score below 0.75, flag it in the transcript state
        const lowConfWordsFromResult = extractedWords
          .filter((w) => w.isLowConfidence || (w.confidence > 0 && w.confidence < 0.75))
          .map((w) => w.word.toLowerCase());

        const lowConfWordsFromDetails = (details.lowConfidenceWords || [])
          .filter((w) => w.isLowConfidence || (w.confidence > 0 && w.confidence < 0.75))
          .map((w) => w.word.toLowerCase());

        // Accumulate segments with lower confidence (< 0.75) or phonetic ambiguity
        const flaggedSegments = details.segments.filter(
          (s) => s.isLowConfidence || (s.confidence > 0 && s.confidence < 0.75) || s.alternatives.length > 0
        );
        if (flaggedSegments.length > 0) {
          pronunciationMetadataRef.current.push(...flaggedSegments);
        }

        turnLowConfidenceWords = Array.from(
          new Set([...lowConfWordsFromResult, ...lowConfWordsFromDetails, ...liveLowConfidenceWords])
        );

        // Record in session low-confidence set
        turnLowConfidenceWords.forEach((word) => sessionLowConfidenceWordsRef.current.add(word));
      }
    }

    // If learner manually edited text via the pencil icon, prioritize their edit
    const finalTranscript = bubbleEditValue.trim() || livePreview.trim() || heard?.trim() || '';
    setLivePreview('');
    setLiveLowConfidenceWords([]);
    setBubbleEditValue('');

    // Store audio attachment for multimodal Gemini analysis
    let audioAttachment: AudioAttachment | null = null;
    if (audioClip && audioClip.base64) {
      audioAttachment = {
        base64: audioClip.base64,
        mimeType: audioClip.mimeType,
      };
      recordedClipsRef.current.push(audioAttachment);
    }

    const idx = userTurnCount.current++;
    const fallback = plan.mockUserReplies[idx % plan.mockUserReplies.length];
    const userSpokeReal = Boolean(finalTranscript.length > 0);
    const text = userSpokeReal ? finalTranscript : fallback;

    const newTurns: Turn[] = [
      ...turns,
      {
        id: `u-${idx}`,
        speaker: 'user',
        text,
        revealed: true,
        isMock: !userSpokeReal,
        lowConfidenceWords: turnLowConfidenceWords,
        wordConfidences: turnWordConfidences,
      },
    ];
    setTurns(newTurns);

    try {
      const historyForGemini = newTurns.map((t) => ({ speaker: t.speaker, text: t.text }));

      // Dynamic conversational turn without hard turn cutoffs:
      // James listens, riffs, and asks relevant follow-up questions for as many turns as the user wants
      const aiReply = await generateJamesReply(
        historyForGemini,
        plan.title,
        plan.aiTurns,
        plan.persona,
        audioAttachment,
        userLevel
      );

      setTurns((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, speaker: 'ai', text: aiReply, revealed: false },
      ]);
      setAiIndex((i) => i + 1);
      speakAi(aiReply);
    } catch (err) {
      console.warn('Error fetching tutor reply:', err);
      const fallbackAi = plan.aiTurns[Math.min(aiIndex, plan.aiTurns.length - 1)] || 'Splendid! Lovely chatting with you.';
      setTurns((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, speaker: 'ai', text: fallbackAi, revealed: false },
      ]);
      setAiIndex((i) => i + 1);
      speakAi(fallbackAi);
    } finally {
      setIsProcessing(false);
    }
  };

  // Push-To-Talk Handlers (supports both Tap-to-Toggle and Press-and-Hold)
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isProcessing || isAnalyzingScorecard) return;

    if (isRecording) {
      // If already recording, tapping acts as "Done / Send"
      stopRecording();
      return;
    }

    pressStartTimeRef.current = Date.now();
    isPressingRef.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore if unsupported */
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
      // Press-and-Hold: releasing immediately stops and sends the turn
      stopRecording();
    }
    // If duration < HOLD_THRESHOLD_MS: Tap-to-Talk!
    // Mic stays wide open hands-free so the user can speak without holding.
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    onPointerUp(e);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (isRecording) stopRecording();
      else startRecording();
    }
  };

  const revealTurn = (id: string) => {
    const target = turns.find((x) => x.id === id);
    if (!target || target.revealed) return;
    setRevealsUsed((n) => n + 1);
    setTurns((t) => t.map((x) => (x.id === id ? { ...x, revealed: true } : x)));
  };

  const endRoleplay = async () => {
    stopSpeaking();
    vizRef.current.stopMicrophone();
    recorderRef.current.stop();
    recRef.current?.stop();

    const userTurnsList = turns.filter((t) => t.speaker === 'user').map((t) => t.text);
    setIsAnalyzingScorecard(true);

    try {
      const sessionLowConf = Array.from(sessionLowConfidenceWordsRef.current);
      // Fast timeout safeguard: 6 seconds max
      const scorecardPromise = generateGeminiScorecard({
        plan,
        userTurns: userTurnsList,
        phraseScores,
        defaultUpgrades: plan.upgrades,
        audioClips: recordedClipsRef.current,
        pronunciationMetadata: pronunciationMetadataRef.current,
        lowConfidenceWords: sessionLowConf,
      });

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
      const scorecard = await Promise.race([scorecardPromise, timeoutPromise]);

      if (scorecardCancelledRef.current) return;

      onEnd({
        userTurns: userTurnsList,
        revealsUsed,
        helpRequests,
        aiTurnsHeard: turns.filter((t) => t.speaker === 'ai').length,
        fluencyScore: scorecard?.fluency,
        pronunciationScore: scorecard?.pronunciation,
        listeningScore: scorecard?.listening,
        dynamicUpgrades: scorecard?.upgrades,
        pronunciationCoachingPoints: scorecard?.pronunciationCoachingPoints,
        pronunciationFeedback: scorecard?.pronunciationFeedback,
        acousticFeedback: scorecard?.acousticFeedback,
        lowConfidenceWords: sessionLowConf,
      });
    } catch (err) {
      console.warn('Scorecard analysis error:', err);
      if (scorecardCancelledRef.current) return;
      onEnd({
        userTurns: userTurnsList,
        revealsUsed,
        helpRequests,
        aiTurnsHeard: turns.filter((t) => t.speaker === 'ai').length,
        lowConfidenceWords: Array.from(sessionLowConfidenceWordsRef.current),
      });
    } finally {
      setIsAnalyzingScorecard(false);
    }
  };

  const mode = isRecording ? 'user' : isAiSpeaking ? 'ai' : 'idle';
  const statusText = isRecording
    ? isHolding
      ? 'Speaking (Hold-to-Talk) · Release button when finished to send'
      : 'Speaking (Tap-to-Talk) · Mic wide open · Tap "Done / Send" when ready'
    : isProcessing
    ? `${plan.persona.name} is listening & thinking…`
    : isAiSpeaking
    ? `${plan.persona.name} is speaking — listen carefully`
    : userTurnsCount >= 3
    ? 'Keep chatting freely, or click "Finish & Get Scorecard"'
    : 'Your turn — hold or tap the mic to speak';

  return (
    <div className="relative flex flex-col h-[85vh] max-h-[85vh] flex-1 min-h-0 bg-gradient-to-b from-slate-50 to-white overflow-hidden">
      {/* Stage tag with Turn Count badge + reveal toggle */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-3 flex-shrink-0">
        <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold border border-brand-200">
          Stage 2 · Turn {currentTurn} · Open Conversation
        </span>

        <button
          onClick={() => {
            playChime('tap');
            setRevealAll((r) => !r);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
            revealAll
              ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:bg-slate-50'
          }`}
          aria-pressed={revealAll}
          title="Toggle blurred transcript for ear training"
        >
          {revealAll ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {revealAll ? 'Transcript: Revealed' : 'Transcript: Blurred'}
        </button>
      </div>

      {/* Persona + waveform */}
      <div className="flex flex-col items-center pt-1.5 px-4 sm:px-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{plan.persona.avatar}</span>
          <div className="text-left">
            <div className="text-sm font-extrabold text-slate-900">{plan.persona.name}</div>
            <div className="text-[11px] text-slate-500">
              {plan.persona.role} · {plan.persona.accent === 'UK' ? '🇬🇧 British' : '🇺🇸 American'}
            </div>
          </div>
        </div>
        {/* Active Audio Waveform Visualizer + Instant Stop Speaking Kill-Switch */}
        <div className="relative flex items-center justify-center w-full max-w-2xl px-4 mt-0.5">
          <WaveformVisualizer mode={mode} bands={bands} />

          {/* Instant "Stop Speaking" kill-switch button */}
          {isAiSpeaking && (
            <button
              onClick={handleStopSpeaking}
              type="button"
              className="absolute right-3 sm:right-6 md:right-8 flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs sm:text-sm font-black rounded-xl shadow-xl shadow-rose-600/35 border border-rose-400 transition-all duration-150 animate-pulse z-20 cursor-pointer"
              title="Stop speaking immediately"
              aria-label="Stop Speaking"
            >
              <Square className="w-3.5 h-3.5 fill-white flex-shrink-0" />
              <span>Stop Speaking</span>
            </button>
          )}
        </div>
        <p className="text-xs sm:text-sm font-semibold text-slate-600 mb-1.5 px-6 text-center" aria-live="polite">
          {statusText}
        </p>
      </div>

      {/* Live transcript with internal scrolling: flex-1 overflow-y-auto */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-3 pb-6 space-y-2.5 scrollbar-none no-scrollbar"
      >
        <div className="max-w-3xl mx-auto space-y-2.5">
        {turns.map((t) => {
          const hidden = t.speaker === 'ai' && !t.revealed && !revealAll;
          return (
            <div key={t.id} className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  t.speaker === 'user'
                    ? 'bg-brand-600 text-white rounded-br-md'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                }`}
              >
                {t.speaker === 'ai' ? (
                  <button
                    onClick={() => revealTurn(t.id)}
                    className="text-left w-full"
                    aria-label={hidden ? 'Hidden text. Tap to reveal.' : t.text}
                  >
                    <span className={`block py-0.5 transition-all duration-300 ${hidden ? 'blur-[5px] select-none' : ''}`}>
                      {t.text}
                    </span>
                    {hidden && (
                      <span className="block mt-1 text-[11px] font-bold text-brand-600">
                        Listen first · tap to reveal
                      </span>
                    )}
                  </button>
                ) : (
                  <>
                    {(() => {
                      if (!t.lowConfidenceWords || t.lowConfidenceWords.length === 0) {
                        return <span>{t.text}</span>;
                      }
                      const lowConfSet = new Set(t.lowConfidenceWords.map((w) => w.toLowerCase()));
                      const tokens = t.text.split(/(\s+)/);
                      return (
                        <span>
                          {tokens.map((token, idx) => {
                            const clean = token.toLowerCase().replace(/[^a-z']/g, '');
                            const isFlagged = clean && lowConfSet.has(clean);
                            if (isFlagged) {
                              return (
                                <span
                                  key={idx}
                                  className="inline-block relative underline decoration-amber-300 decoration-wavy underline-offset-4 font-bold text-amber-200 bg-amber-400/20 px-1 rounded-sm cursor-help"
                                  title="Acoustic speech confidence < 75% · Flagged for British pronunciation coaching"
                                >
                                  {token}
                                </span>
                              );
                            }
                            return <span key={idx}>{token}</span>;
                          })}
                        </span>
                      );
                    })()}
                    {t.lowConfidenceWords && t.lowConfidenceWords.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-amber-200 bg-black/20 px-2 py-0.5 rounded-md border border-amber-300/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                        <span>Flagged pronunciation (&lt;75%): {t.lowConfidenceWords.join(', ')}</span>
                      </div>
                    )}
                    {t.isMock && (
                      <span className="block mt-1 text-[10px] text-brand-100">
                        Demo transcript (speech-to-text unavailable)
                      </span>
                    )}
                  </>
                )}
                {t.speaker === 'ai' && (
                  <button
                    onClick={() => speakAi(t.text)}
                    className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-brand-600"
                  >
                    <Volume2 className="w-3 h-3" /> Replay
                  </button>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Controls Container with Push-to-Talk Interface & Live Transcription (Permanently Docked & Sticky) */}
      <div className="relative flex-shrink-0 sticky bottom-0 z-20 px-4 sm:px-6 pb-4 sm:pb-5 pt-3 border-t border-slate-200/90 bg-white/95 backdrop-blur-md shadow-lg">
        {/* Real-time live transcription bubble floating above the PTT button */}
        {isRecording && (
          <div className="absolute bottom-[calc(100%+12px)] left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-xl z-20 animate-slide-up">
            <div className="relative bg-white/95 backdrop-blur-md rounded-2xl p-3.5 border border-rose-200/90 shadow-2xl text-slate-800">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                  </span>
                  <span className="text-[11px] font-extrabold text-rose-600 tracking-wide uppercase">
                    Live Transcription
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    · Mic open (no cutoff)
                  </span>
                  {liveLowConfidenceWords.length > 0 && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Flagged (&lt;75%): {liveLowConfidenceWords.join(', ')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      if (isEditingBubble) {
                        setIsEditingBubble(false);
                      } else {
                        setBubbleEditValue(livePreview || '');
                        setIsEditingBubble(true);
                      }
                    }}
                    className="px-2 py-1 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100 text-[11px] font-medium flex items-center gap-1 transition"
                    title="Edit misheard words"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>{isEditingBubble ? 'Cancel' : 'Edit'}</span>
                  </button>

                  <button
                    onClick={() => stopRecording()}
                    className="px-3 py-1 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow flex items-center gap-1.5 active:scale-95 transition"
                    title="Send audio and transcript to James"
                  >
                    <Send className="w-3 h-3" />
                    <span>Done / Send</span>
                  </button>
                </div>
              </div>

              {isEditingBubble ? (
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="text"
                    value={bubbleEditValue}
                    onChange={(e) => setBubbleEditValue(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 shadow-inner"
                    placeholder="Correct misheard word..."
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setLivePreview(bubbleEditValue);
                      setIsEditingBubble(false);
                    }}
                    className="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-brand-700 active:scale-95 transition flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Apply
                  </button>
                </div>
              ) : (
                <div className="min-h-[28px] flex items-center">
                  {livePreview ? (
                    <div className="text-sm font-semibold text-slate-900 leading-relaxed max-h-28 overflow-y-auto pr-1">
                      “{livePreview}”
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-rose-500 animate-pulse align-middle rounded-xs" />
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-slate-500 italic flex items-center gap-2 py-0.5">
                      <span className="text-sm">🎙️</span>
                      <span>Listening… Speak freely at your own pace. Pauses will not cut you off.</span>
                    </p>
                  )}
                </div>
              )}

              {/* Downward pointer to mic */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rotate-45 border-r border-b border-rose-200/90 shadow-xs" />
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              stopSpeaking();
              setHelpOpen(true);
              setHelpRequests((n) => n + 1);
            }}
            className="flex flex-col items-center gap-1 w-20 sm:w-28 text-amber-700 hover:text-amber-800 transition active:scale-95"
          >
            <span className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-100 hover:bg-amber-200 flex items-center justify-center transition shadow-2xs">
              <LifeBuoy className="w-5 h-5" />
            </span>
            <span className="text-[10px] sm:text-xs font-bold leading-tight text-center">How do I say…?</span>
          </button>

          {/* Robust Push-To-Talk / Hold-to-Talk / Tap-to-Talk Mic Interface */}
          <div className="flex flex-col items-center relative">
            {/* Glowing animated recording ring when active */}
            {isRecording && (
              <>
                {/* Outermost expanding ping aura */}
                <span className="absolute -inset-3.5 rounded-full bg-rose-500/25 animate-ping pointer-events-none" />
                {/* Soft ambient radial bloom */}
                <span className="absolute -inset-5 rounded-full bg-rose-500/20 blur-xl animate-pulse pointer-events-none" />
                {/* Active glowing ring boundary */}
                <span className="absolute -inset-1 rounded-full ring-4 ring-rose-400 ring-offset-2 ring-offset-white shadow-[0_0_28px_rgba(244,63,94,0.6)] pointer-events-none animate-pulse" />
              </>
            )}

            <button
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onKeyDown={onKeyDown}
              disabled={isProcessing || isAnalyzingScorecard}
              className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center text-white transition-all duration-200 active:scale-95 touch-none select-none disabled:opacity-40 ${
                isRecording
                  ? 'bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 scale-105 shadow-xl shadow-rose-500/35'
                  : 'bg-gradient-to-br from-brand-600 via-brand-500 to-emerald-500 shadow-fab hover:shadow-lg hover:scale-[1.02]'
              }`}
              aria-label={isRecording ? 'Tap or release to send spoken turn' : 'Push to talk: hold or tap to speak'}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin mb-0.5" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-white/90">Thinking</span>
                </>
              ) : isRecording ? (
                <>
                  <Send className="w-7 h-7 text-white fill-white/20 translate-x-0.5 mb-0.5" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-rose-100">Done · Send</span>
                </>
              ) : (
                <>
                  <Mic className="w-9 h-9 mb-0.5" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-white/90">Push to Talk</span>
                </>
              )}
            </button>

            {/* Clear contextual instruction below the button */}
            <div className="h-5 flex items-center justify-center mt-1.5">
              {isRecording ? (
                <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {isHolding ? 'Release to Send' : 'Tap to Finish & Send'}
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-slate-500">
                  Hold or tap to speak
                </span>
              )}
            </div>
          </div>

          <button
            onClick={endRoleplay}
            disabled={isAnalyzingScorecard || isProcessing || userTurnsCount === 0}
            className="flex flex-col items-center gap-1 w-20 sm:w-28 text-slate-700 disabled:opacity-40 transition-all active:scale-95"
          >
            <span
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all ${
                userTurnsCount >= 3
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-soft shadow-emerald-500/20 animate-pulse-subtle'
                  : userTurnsCount >= 1
                  ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Flag className="w-5 h-5" />
            </span>
            <span className="text-[10px] sm:text-xs font-extrabold text-center leading-tight">
              {userTurnsCount >= 1 ? 'Finish & Get Scorecard' : 'Speak first'}
            </span>
          </button>

        </div>
      </div>

      {helpOpen && (
        <HowDoISaySheet
          phrases={plan.helpPhrases}
          nativeLanguage={nativeLanguage}
          accent={plan.persona.accent}
          audioSpeed={audioSpeed}
          onClose={() => setHelpOpen(false)}
          onUsed={() => {}}
        />
      )}

      {/* Scorecard Grading Overlay with Multimodal Gemini AI */}
      {isAnalyzingScorecard && (
        <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mb-4 shadow-soft">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Grading Your Spoken Roleplay</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            {analyzingSeconds < 2
              ? 'Analyzing speech rhythm and phonetics with Gemini AI…'
              : 'Polishing your British phrasing upgrades and acoustic scores…'}
          </p>

          {analyzingSeconds >= 2 && (
            <button
              onClick={handleSkipWaitAndProceed}
              className="mt-5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95 animate-fade-in"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>View Scorecard Instantly</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
