import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic,
  Eye,
  EyeOff,
  LifeBuoy,
  Volume2,
  Flag,
  Loader2,
  Square,
  ArrowRight,
  Zap,
  CheckCircle2,
  Target,
  ChevronDown,
  ChevronUp,
  Lock,
  Headphones,
  Terminal,
  Send,
  Keyboard,
} from 'lucide-react';
import type { CEFRLevel, LessonPlan, NativeLanguage, PhrasingUpgrade, PronunciationCoachingPoint, PronunciationFeedbackWord } from '../../types';
import { speakEnglish, stopSpeaking, playChime, isCurrentlySpeaking } from '../../services/speech';
import {
  startRecognition,
  isRecognitionSupported,
  extractWordsFromSpeechResults,
  deduplicateSpokenText,
  chooseBestTranscript,
  type RecognitionHandle,
  type SpokenSegmentAnalysis,
  type WordConfidenceInfo,
} from '../../services/speechRecognition';
import { AudioRecorderController } from '../../services/audioRecorder';
import { AudioVisualizerController } from '../../services/audioVisualizer';
import { HowDoISaySheet } from './HowDoISaySheet';
import {
  generateJamesReply,
  generateGeminiScorecard,
  cleanTextForTTS,
  transcribeAudioWithAI,
  type AudioAttachment,
} from '../../services/geminiService';
import { getDueSRSFlashcards } from '../../services/srsService';
import { getAvailableAudioSpeeds, useGamificationStore } from '../../store/rewardSystem';
import { InteractiveTranscriptText, WordLookupModal } from '../WordLookupPopover';
import { diagnosticLogger } from '../../services/diagnosticLogger';
import { DiagnosticLogsModal } from '../DiagnosticLogsModal';
import { toast } from '../../services/toast';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'to', 'in', 'on', 'at', 'for', 'of', 'with', 'it', 'that', 'this', 'and', 'or', 'so'
]);

const CONTRACTION_MAP: Record<string, string> = {
  "i'd": 'i would',
  "i'm": 'i am',
  "i'll": 'i will',
  "i've": 'i have',
  "can't": 'cannot',
  "don't": 'do not',
  "won't": 'will not',
  "didn't": 'did not',
  "couldn't": 'could not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "it's": 'it is',
  "that's": 'that is',
  "we're": 'we are',
  "you're": 'you are',
  "they're": 'they are',
  "there's": 'there is',
  "what's": 'what is',
  "let's": 'let us',
};

function normalizeText(text: string): string {
  let lower = text.toLowerCase();
  for (const [contraction, expanded] of Object.entries(CONTRACTION_MAP)) {
    lower = lower.replaceAll(contraction, expanded);
  }
  return lower.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fuzzy token & keyword matcher for target phrase usage
 * Returns true if direct substring matches OR >= 70% of core keywords are present
 */
function matchesTargetPhrase(spokenText: string, targetPhrase: string): boolean {
  if (!spokenText || !targetPhrase) return false;
  const normSpoken = normalizeText(spokenText);
  const normTarget = normalizeText(targetPhrase);

  if (!normSpoken || !normTarget) return false;

  // 1. Direct substring match
  if (normSpoken.includes(normTarget)) {
    return true;
  }

  // 2. Token overlap and core keyword matching
  const targetTokens = normTarget.split(' ').filter(Boolean);
  const spokenTokens = new Set(normSpoken.split(' ').filter(Boolean));

  const coreTargetWords = targetTokens.filter((w) => !STOP_WORDS.has(w));
  const wordsToCheck = coreTargetWords.length >= 2 ? coreTargetWords : targetTokens;

  if (wordsToCheck.length === 0) return false;

  let matched = 0;
  for (const word of wordsToCheck) {
    if (spokenTokens.has(word)) {
      matched++;
    }
  }

  const ratio = matched / wordsToCheck.length;
  return ratio >= 0.7;
}

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
  unblurredTurnCount?: number;
  usedTargetPhraseIds?: string[];
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
  const [bands, setBands] = useState<number[]>([]);
  const [revealAll, setRevealAll] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [revealsUsed, setRevealsUsed] = useState(0);
  const [lookupWord, setLookupWord] = useState<{ word: string; sentence: string } | null>(null);
  const [helpRequests, setHelpRequests] = useState(0);
  const [analyzingSeconds, setAnalyzingSeconds] = useState(0);
  const [isDiagnosticLogsOpen, setIsDiagnosticLogsOpen] = useState(false);
  const scorecardCancelledRef = useRef(false);

  // Gamification, live mission tracking & speed control
  const [currentSpeed, setCurrentSpeed] = useState<number>(audioSpeed);
  const [unblurredTurnCount, setUnblurredTurnCount] = useState<number>(0);
  const [usedTargetPhraseIds, setUsedTargetPhraseIds] = useState<Set<string>>(new Set());
  const [isMissionsCollapsed, setIsMissionsCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );
  const [justMatchedPhraseId, setJustMatchedPhraseId] = useState<string | null>(null);

  const { currentTier } = useGamificationStore();
  const availableSpeeds = useMemo(() => getAvailableAudioSpeeds(currentTier), [currentTier]);

  const dueSRSCard = useMemo(() => {
    try {
      const due = getDueSRSFlashcards();
      return due.find((c) => c.box === 1 || c.box === 2) || null;
    } catch {
      return null;
    }
  }, []);

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
      unblurredTurnCount,
      usedTargetPhraseIds: Array.from(usedTargetPhraseIds),
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

  // Synchronous Push-To-Talk / Tap-To-Talk tracking refs
  const isRecordingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isInitializingMicRef = useRef(false);
  const livePreviewRef = useRef('');
  const pressStartTimeRef = useRef(0);
  const isPressingRef = useRef(false);
  const isHoldingRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const initialAiTimerRef = useRef<number | null>(null);
  const pendingStopRef = useRef(false);
  const hasDetectedVoiceRef = useRef(false);
  const lastVoiceTimeRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [typedReply, setTypedReply] = useState('');

  const userTurnsCount = turns.filter((t) => t.speaker === 'user').length;
  const currentTurn = userTurnsCount + 1;

  const handleStopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopSpeaking();
    setIsAiSpeaking(false);
  }, []);

  // Monitor active speech synthesis state to gracefully reset indicator
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
      if (isRecordingRef.current || isInitializingMicRef.current) return;
      const cleaned = cleanTextForTTS(text, plan.persona.name);
      if (!cleaned) return;

      speakEnglish(cleaned, {
        rate: currentSpeed,
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
    [currentSpeed, plan.persona.accent, plan.persona.name, plan.persona.pitch, plan.persona.ttsVoicePreference, plan.persona.gender]
  );

  const pushAiTurn = useCallback(
    (index: number, silent = false) => {
      const text = plan.aiTurns[index];
      if (!text) return;
      setTurns((t) => {
        if (t.some((existing) => existing.id === `ai-${index}`)) return t;
        return [...t, { id: `ai-${index}`, speaker: 'ai', text, revealed: false }];
      });
      setAiIndex(index + 1);
      if (!silent) {
        speakAi(text);
      }
    },
    [plan.aiTurns, speakAi]
  );

  // Kick off with James's opening line & prewarm mic
  useEffect(() => {
    // Pre-warm the microphone stream in the background if permissions are already granted
    vizRef.current.prewarm().catch(() => {});
    initialAiTimerRef.current = window.setTimeout(() => {
      initialAiTimerRef.current = null;
      pushAiTurn(0);
    }, 500);
    const viz = vizRef.current;
    const recorder = recorderRef.current;
    return () => {
      if (initialAiTimerRef.current) {
        window.clearTimeout(initialAiTimerRef.current);
        initialAiTimerRef.current = null;
      }
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      stopSpeaking();
      viz.stopMicrophone(true);
      recorder.stop();
      recRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, livePreview, isRecording, isTranscribingAudio]);

  const cancelRecording = useCallback(() => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pendingStopRef.current = false;
    isInitializingMicRef.current = false;
    isRecordingRef.current = false;
    isStoppingRef.current = false;
    isPressingRef.current = false;
    isHoldingRef.current = false;
    hasDetectedVoiceRef.current = false;
    setIsRecording(false);
    setIsHolding(false);
    setIsTranscribingAudio(false);
    setBands([]);
    livePreviewRef.current = '';
    setLivePreview('');
    setLiveLowConfidenceWords([]);
    vizRef.current.stopMicrophone(false);
    recorderRef.current.stop().catch(() => {});
    recRef.current?.abort();
    recRef.current = null;
    playChime('tap');
  }, []);

  const processUserTurn = async (
    text: string,
    audioAttachment: AudioAttachment | null = null,
    turnLowConfidenceWords: string[] = [],
    turnWordConfidences: WordConfidenceInfo[] = []
  ) => {
    const idx = userTurnCount.current++;

    const phrasesToCheck = [...plan.phrases];
    if (dueSRSCard) {
      phrasesToCheck.push({
        id: dueSRSCard.id,
        phrase: dueSRSCard.phrase,
        ipa: dueSRSCard.ipa,
        usageContext: dueSRSCard.context,
        translations: {},
      });
    }

    const newlyMatched: string[] = [];
    phrasesToCheck.forEach((tp) => {
      if (!usedTargetPhraseIds.has(tp.id)) {
        if (matchesTargetPhrase(text, tp.phrase)) {
          newlyMatched.push(tp.id);
        }
      }
    });

    if (newlyMatched.length > 0) {
      setUsedTargetPhraseIds((prev) => {
        const next = new Set(prev);
        newlyMatched.forEach((id) => next.add(id));
        return next;
      });
      setJustMatchedPhraseId(newlyMatched[0]);
      setTimeout(() => setJustMatchedPhraseId(null), 3500);
      playChime('success');
    }

    const newTurns: Turn[] = [
      ...turns,
      {
        id: `u-${idx}`,
        speaker: 'user',
        text,
        revealed: true,
        isMock: false,
        lowConfidenceWords: turnLowConfidenceWords,
        wordConfidences: turnWordConfidences,
      },
    ];
    // Clear livePreview in the exact same synchronous React batch as setTurns
    // so the user's spoken words never vanish for even a single frame!
    livePreviewRef.current = '';
    setLivePreview('');
    setLiveLowConfidenceWords([]);
    setTurns(newTurns);

    try {
      const historyForGemini = newTurns.map((t) => ({ speaker: t.speaker, text: t.text }));

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
      const fallbackAi =
        plan.aiTurns[Math.min(aiIndex, plan.aiTurns.length - 1)] || 'Splendid! Lovely chatting with you.';
      setTurns((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, speaker: 'ai', text: fallbackAi, revealed: false },
      ]);
      setAiIndex((i) => i + 1);
      speakAi(fallbackAi);
    }
  };

  const handleSendTypedReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = typedReply.trim();
    if (!cleaned || isProcessing || isAnalyzingScorecard) return;
    if (isRecordingRef.current || isInitializingMicRef.current) {
      cancelRecording();
    }
    handleStopSpeaking();
    setTypedReply('');
    setIsProcessing(true);
    try {
      await processUserTurn(cleaned, null, [], []);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    if (isRecordingRef.current || isInitializingMicRef.current || isStoppingRef.current || isProcessing) return;
    if (initialAiTimerRef.current) {
      window.clearTimeout(initialAiTimerRef.current);
      initialAiTimerRef.current = null;
      pushAiTurn(0, true);
    }
    pendingStopRef.current = false;
    isInitializingMicRef.current = true;
    isRecordingRef.current = true;
    hasDetectedVoiceRef.current = false;
    const startTs = Date.now();
    recordingStartedAtRef.current = startTs;
    lastVoiceTimeRef.current = startTs;
    handleStopSpeaking();

    // Instant liquid silver glow + warm acoustic chime on touch
    setIsRecording(true);
    livePreviewRef.current = '';
    setLivePreview('');
    setLiveLowConfidenceWords([]);
    playChime('micStart');

    diagnosticLogger.log('VOICE', 'startRecording initiated by user gesture');

    // Synchronously unmute any prewarmed tracks and start MediaRecorder at tick 0 if stream is already live
    vizRef.current.enableTracksSync();
    const prewarmedStream = vizRef.current.getStream();
    let recorderStartedAtTickZero = false;
    if (prewarmedStream && prewarmedStream.active) {
      recorderStartedAtTickZero = true;
      recorderRef.current.start(prewarmedStream).catch(() => {
        recorderStartedAtTickZero = false;
      });
    }

    // CRITICAL: Start SpeechRecognition IMMEDIATELY at tick 0 on user gesture!
    recRef.current = isRecognitionSupported()
      ? startRecognition({
          lang: plan.persona.accent === 'UK' ? 'en-GB' : 'en-US',
          silenceTimeoutMs: 5000,
          initialSilenceTimeoutMs: 15000,
          onInterim: (text) => {
            if (!isRecordingRef.current && !isStoppingRef.current) return;
            livePreviewRef.current = text;
            setLivePreview(text);
            hasDetectedVoiceRef.current = true;
            lastVoiceTimeRef.current = Date.now();
          },
          onSilenceTimeout: () => {
            if (isRecordingRef.current) {
              if (livePreviewRef.current.trim().length > 0 || hasDetectedVoiceRef.current) {
                stopRecording();
              } else {
                cancelRecording();
              }
            }
          },
          onSpeechResults: (eventResults) => {
            const extracted = extractWordsFromSpeechResults(eventResults);
            const lowConfWords = extracted
              .filter((w) => w.isLowConfidence)
              .map((w) => w.word);
            if (lowConfWords.length > 0) {
              setLiveLowConfidenceWords(Array.from(new Set(lowConfWords)));
            }
          },
        })
      : null;

    const ok = await vizRef.current.startMicrophone((newBands) => {
      setBands(newBands);
      if (!isRecordingRef.current) return;
      const avg = newBands.length > 0 ? newBands.reduce((a, b) => a + b, 0) / newBands.length : 0;
      const now = Date.now();
      if (avg > 0.045) {
        if (!hasDetectedVoiceRef.current) {
          diagnosticLogger.log('VOICE', `Voice activity detected (amplitude: ${avg.toFixed(3)})`);
        }
        hasDetectedVoiceRef.current = true;
        lastVoiceTimeRef.current = now;
      }
    });

    if (!ok) {
      diagnosticLogger.error('VOICE', 'Microphone start failed or permission denied in viz.startMicrophone');
      recRef.current?.abort();
      recRef.current = null;
      isInitializingMicRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsHolding(false);
      onMicDenied();
      return;
    }

    if (!isRecordingRef.current) {
      isInitializingMicRef.current = false;
      return;
    }

    if (!recorderStartedAtTickZero || !recorderRef.current.isRecording()) {
      const activeStream = vizRef.current.getStream();
      await recorderRef.current.start(activeStream);
    }
    isInitializingMicRef.current = false;

    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      stopRecording();
    }
  };

  const stopRecording = async () => {
    if (!isRecordingRef.current || isStoppingRef.current) {
      return;
    }
    if (isInitializingMicRef.current) {
      pendingStopRef.current = true;
      return;
    }
    isStoppingRef.current = true;
    isRecordingRef.current = false;
    const hadVoice = hasDetectedVoiceRef.current || livePreviewRef.current.trim().length > 0;
    hasDetectedVoiceRef.current = false;
    setIsRecording(false);
    setIsHolding(false);
    isHoldingRef.current = false;
    isPressingRef.current = false;
    setBands([]);
    setIsProcessing(true);
    playChime('micStop');

    try {
      // Short 180ms acoustic tail buffer so the final syllable is never clipped
      await new Promise((resolve) => window.setTimeout(resolve, 180));

      const activeRec = recRef.current;
      recRef.current = null;

      const [audioClip, details] = await Promise.all([
        recorderRef.current.stop().catch((e) => {
          console.warn('[RoleplayStage] Failed to stop audio recorder:', e);
          return null;
        }),
        activeRec ? activeRec.stopWithDetails().catch(() => null) : Promise.resolve(null),
      ]);

      // Stop visualizer loop after recorder and speech recognition have flushed
      vizRef.current.stopMicrophone(false);

      let heard: string | null = null;
      let turnLowConfidenceWords: string[] = [];
      let turnWordConfidences: WordConfidenceInfo[] = [];

      if (details) {
        heard = details.transcript;

        const extractedWords = details.rawResults
          ? extractWordsFromSpeechResults(details.rawResults)
          : details.allWords && details.allWords.length > 0
          ? details.allWords
          : [];

        turnWordConfidences = extractedWords;

        const lowConfWordsFromResult = extractedWords
          .filter((w) => w.isLowConfidence)
          .map((w) => w.word.toLowerCase());

        const lowConfWordsFromDetails = (details.lowConfidenceWords || [])
          .filter((w) => w.isLowConfidence)
          .map((w) => w.word.toLowerCase());

        const flaggedSegments = details.segments.filter((s) => s.isLowConfidence);
        if (flaggedSegments.length > 0) {
          pronunciationMetadataRef.current.push(...flaggedSegments);
        }

        turnLowConfidenceWords = Array.from(
          new Set([...lowConfWordsFromResult, ...lowConfWordsFromDetails, ...liveLowConfidenceWords])
        );

        turnLowConfidenceWords.forEach((word) => sessionLowConfidenceWordsRef.current.add(word));
      }

      const bestRawTranscript = chooseBestTranscript(
        livePreviewRef.current.trim() || livePreview.trim(),
        heard?.trim() || ''
      );
      let finalTranscript = deduplicateSpokenText(bestRawTranscript);

      // Keep livePreview updated with the flushed transcript so it remains visible on screen without vanishing!
      if (finalTranscript) {
        livePreviewRef.current = finalTranscript;
        setLivePreview(finalTranscript);
      }

      let audioAttachment: AudioAttachment | null = null;
      if (audioClip && audioClip.base64) {
        audioAttachment = {
          base64: audioClip.base64,
          mimeType: audioClip.mimeType,
        };
      }

      // Only invoke AI audio transcription as a fallback if Web Speech API produced nothing at all
      if (
        !finalTranscript &&
        audioAttachment &&
        audioAttachment.base64 &&
        (hadVoice || (audioClip?.durationMs ?? 0) >= 450)
      ) {
        diagnosticLogger.log(
          'VOICE',
          `Fallback AI audio transcription (duration=${audioClip?.durationMs ?? 0}ms)...`
        );
        setIsTranscribingAudio(true);
        try {
          const aiPromise = transcribeAudioWithAI({
            base64: audioAttachment.base64,
            mimeType: audioAttachment.mimeType,
            blob: audioClip?.blob,
          });
          const timeoutPromise = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2800));
          const aiTranscript = await Promise.race([aiPromise, timeoutPromise]);

          if (aiTranscript && aiTranscript.trim().length > 0) {
            finalTranscript = chooseBestTranscript(finalTranscript, aiTranscript.trim());
            livePreviewRef.current = finalTranscript;
            setLivePreview(finalTranscript);
          }
        } catch (err: any) {
          diagnosticLogger.error('VOICE', `AI audio transcription error: ${err?.message || err}`);
          console.warn('[RoleplayStage] AI audio transcription error:', err);
        } finally {
          setIsTranscribingAudio(false);
        }
      }

      // Do NOT inject a fake "(Silence / hesitated)" turn when no speech was heard!
      if (!finalTranscript) {
        livePreviewRef.current = '';
        setLivePreview('');
        setLiveLowConfidenceWords([]);
        diagnosticLogger.log('VOICE', 'No speech detected after recording stop; resetting cleanly without fake turn');
        toast.info(
          "Didn't catch any speech — press and hold to speak, or click once to start and click again when done.",
          'No Speech Heard'
        );
        return;
      }

      if (audioAttachment) {
        recordedClipsRef.current.push(audioAttachment);
      }

      finalTranscript = deduplicateSpokenText(finalTranscript);
      await processUserTurn(finalTranscript, audioAttachment, turnLowConfidenceWords, turnWordConfidences);
    } finally {
      isStoppingRef.current = false;
      setIsProcessing(false);
    }
  };

  // Push-to-Talk (press, speak, release -> transcribes) + Quick-Click Toggle (click quickly -> click again later)
  const QUICK_CLICK_THRESHOLD_MS = 300;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isProcessing || isAnalyzingScorecard || isStoppingRef.current) return;

    // If already recording from a previous quick-click, clicking again finishes and transcribes!
    if (isRecordingRef.current || isInitializingMicRef.current) {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      isPressingRef.current = false;
      setIsHolding(false);
      isHoldingRef.current = false;
      stopRecording();
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore if unsupported */
    }

    pressStartTimeRef.current = Date.now();
    isPressingRef.current = true;
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      if (isPressingRef.current) {
        setIsHolding(true);
        isHoldingRef.current = true;
      }
    }, QUICK_CLICK_THRESHOLD_MS);

    startRecording();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }

    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!isPressingRef.current) return;
    const heldMs = Date.now() - pressStartTimeRef.current;
    isPressingRef.current = false;
    setIsHolding(false);
    isHoldingRef.current = false;

    // If the user held the button down to speak (>= 300ms), releasing immediately stops and transcribes!
    // If they clicked once quickly (< 300ms), it stays listening until they click again.
    if (heldMs >= QUICK_CLICK_THRESHOLD_MS && (isRecordingRef.current || isInitializingMicRef.current)) {
      stopRecording();
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerUp(e);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (isRecordingRef.current) stopRecording();
      else startRecording();
    }
  };

  const revealTurn = (id: string) => {
    const target = turns.find((x) => x.id === id);
    if (!target || target.revealed) return;
    setUnblurredTurnCount((c) => c + 1);
    setRevealsUsed((n) => n + 1);
    setTurns((t) => t.map((x) => (x.id === id ? { ...x, revealed: true } : x)));
  };

  const endRoleplay = async () => {
    stopSpeaking();
    vizRef.current.stopMicrophone(true);
    recorderRef.current.stop();
    recRef.current?.stop();

    const userTurnsList = turns.filter((t) => t.speaker === 'user').map((t) => t.text);
    setIsAnalyzingScorecard(true);

    try {
      const sessionLowConf = Array.from(sessionLowConfidenceWordsRef.current);
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
        unblurredTurnCount,
        usedTargetPhraseIds: Array.from(usedTargetPhraseIds),
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
        unblurredTurnCount,
        usedTargetPhraseIds: Array.from(usedTargetPhraseIds),
        helpRequests,
        aiTurnsHeard: turns.filter((t) => t.speaker === 'ai').length,
        lowConfidenceWords: Array.from(sessionLowConfidenceWordsRef.current),
      });
    } finally {
      setIsAnalyzingScorecard(false);
    }
  };

  // Subtle dynamic voice amplitude scale for the silky orb (1.0 -> 1.35)
  const avgBandAmp =
    bands.length > 0 ? bands.reduce((acc, v) => acc + v, 0) / bands.length : 0;
  const voiceBloomScale = isRecording ? 1 + Math.min(0.4, avgBandAmp * 0.75) : 1;

  return (
    <div className="relative flex flex-col h-full flex-1 min-h-0 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 overflow-hidden">
      {/* Compact Top Status & Audio Controls Row */}
      <div className="flex items-center justify-between px-3.5 sm:px-6 pt-2.5 flex-shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-[11px] font-bold border border-brand-200 dark:border-brand-800">
            Turn {currentTurn}
          </span>

          {unblurredTurnCount === 0 ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold"
              title="Keep transcripts blurred and listen with your ears to earn +15 XP bonus!"
            >
              <Headphones className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Ears-Only (+15 XP)</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold"
              title="Transcript was unblurred · Ears-Only bonus used"
            >
              <Eye className="w-3 h-3 text-slate-400" />
              <span>Peeked</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center bg-slate-100/90 dark:bg-slate-850 p-0.5 rounded-xl border border-slate-200 dark:border-slate-750"
            title="Speaking playback speed"
          >
            {availableSpeeds.map((opt) => {
              const isSelected = currentSpeed === opt.speed;
              return (
                <button
                  key={opt.speed}
                  type="button"
                  disabled={!opt.unlocked}
                  onClick={() => {
                    if (opt.unlocked) {
                      playChime('tap');
                      setCurrentSpeed(opt.speed);
                    }
                  }}
                  title={opt.unlocked ? opt.label : opt.lockReason || 'Tier perk locked'}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-2xs ring-1 ring-black/5'
                      : opt.unlocked
                      ? 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95'
                      : 'text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {!opt.unlocked && <Lock className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />}
                  <span>{opt.speed}x</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              playChime('tap');
              setRevealAll((r) => {
                const next = !r;
                if (next) setUnblurredTurnCount((c) => c + 1);
                return next;
              });
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition ${
              revealAll
                ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            aria-pressed={revealAll}
            title="Toggle blurred transcript for auditory ear training"
          >
            {revealAll ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{revealAll ? 'Revealed' : 'Blurred'}</span>
          </button>

          {/* Diagnostic Logs Button */}
          <button
            type="button"
            onClick={() => {
              playChime('tap');
              setIsDiagnosticLogsOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition"
            title="Open Diagnostic & Voice Logs"
          >
            <Terminal className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span className="hidden sm:inline">Logs</span>
          </button>
        </div>
      </div>

      {/* Compact Persona & Mission Phrases Header */}
      <div className="px-3.5 sm:px-6 pt-2 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <span className="text-2xl block leading-none">{plan.persona.avatar}</span>
              {isAiSpeaking && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {plan.persona.name}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">·</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {plan.persona.role}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isAiSpeaking
                  ? `${plan.persona.name} is speaking…`
                  : isProcessing
                  ? `${plan.persona.name} is thinking…`
                  : plan.persona.accent === 'UK'
                  ? '🇬🇧 British English'
                  : '🇺🇸 American English'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isAiSpeaking && (
              <button
                onClick={handleStopSpeaking}
                type="button"
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-300 text-[11px] font-bold rounded-xl border border-rose-200 dark:border-rose-800 transition active:scale-95"
                title="Stop speaking"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            )}

            {dueSRSCard && (
              <span 
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 text-[11px] font-bold"
                title="Includes 1 phrase you saved earlier to help lock it into memory."
              >
                🔄 Past Phrase Refresher (+15 Bonus XP)
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsMissionsCollapsed((c) => !c)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/70 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:bg-amber-100/70 transition"
            >
              <Target className="w-3 h-3 text-brand-600 dark:text-brand-400" />
              <span>Phrases ({usedTargetPhraseIds.size}/{plan.phrases.length})</span>
              {isMissionsCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Collapsible phrase pill chips */}
        {!isMissionsCollapsed && (
          <div className="px-3 py-2 rounded-2xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex flex-wrap gap-1.5 animate-fade-in">
            {plan.phrases.map((phrase) => {
              const isUsed = usedTargetPhraseIds.has(phrase.id);
              const isJustMatched = justMatchedPhraseId === phrase.id;
              return (
                <div
                  key={phrase.id}
                  onClick={() => {
                    playChime('tap');
                    speakEnglish(phrase.phrase, {
                      rate: currentSpeed,
                      accent: plan.persona.accent,
                      personaName: plan.persona.name,
                    });
                  }}
                  title="Speak this phrase aloud in conversation for +10 Bonus XP! Tap to hear pronunciation."
                  className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-300 ${
                    isUsed
                      ? 'bg-emerald-500 text-white shadow-xs font-bold ring-2 ring-emerald-300 dark:ring-emerald-600'
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-2xs'
                  } ${isJustMatched ? 'scale-105 ring-4 ring-emerald-400 animate-pulse' : ''}`}
                >
                  {isUsed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white flex-shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  )}
                  <span className="truncate max-w-[200px] sm:max-w-[280px]">“{phrase.phrase}”</span>
                  <span className={`text-[10px] font-black ${isUsed ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {isUsed ? '+10 XP ✓' : '+10 XP'}
                  </span>
                </div>
              );
            })}

            {dueSRSCard && (
              <div
                key={dueSRSCard.id}
                onClick={() => {
                  playChime('tap');
                  speakEnglish(dueSRSCard.phrase, {
                    rate: currentSpeed,
                    accent: plan.persona.accent,
                    personaName: plan.persona.name,
                  });
                }}
                title="Includes 1 phrase you saved earlier to help lock it into memory."
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  usedTargetPhraseIds.has(dueSRSCard.id)
                    ? 'bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-300 shadow-xs'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs hover:bg-amber-100 dark:hover:bg-amber-900/60'
                }`}
              >
                {usedTargetPhraseIds.has(dueSRSCard.id) ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-950 flex-shrink-0" />
                ) : (
                  <span className="text-[11px]">🔄</span>
                )}
                <span className="truncate max-w-[180px]">“{dueSRSCard.phrase}”</span>
                <span className="text-[10px] font-extrabold text-amber-800 dark:text-amber-300">📌 From Your Saved Phrases</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Spacious Conversation Transcript */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-3 pb-4 space-y-2.5 scrollbar-none no-scrollbar"
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
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-md shadow-sm'
                  }`}
                >
                  {t.speaker === 'ai' ? (
                    <div>
                      {hidden ? (
                        <button
                          onClick={() => revealTurn(t.id)}
                          className="text-left w-full"
                          aria-label="Hidden text. Tap to reveal."
                        >
                          <span className="block py-0.5 blur-[5px] select-none transition-all duration-300">
                            {t.text}
                          </span>
                          <span className="block mt-1 text-[11px] font-bold text-brand-600 dark:text-brand-400">
                            Listen first · tap to reveal
                          </span>
                        </button>
                      ) : (
                        <div className="py-0.5">
                          <InteractiveTranscriptText
                            text={t.text}
                            onSelectWord={(w, s) => setLookupWord({ word: w, sentence: s })}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {t.text.includes('Silence / hesitated') ? (
                        <div className="flex items-center gap-1.5 py-0.5 text-xs text-brand-100/95 font-medium italic">
                          <LifeBuoy className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 animate-pulse" />
                          <span>(Hesitated · Taking time to think)</span>
                        </div>
                      ) : (
                        (() => {
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
                      })())}
                      {t.lowConfidenceWords && t.lowConfidenceWords.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-amber-200 bg-black/20 px-2 py-0.5 rounded-md border border-amber-300/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                          <span>Flagged pronunciation (&lt;75%): {t.lowConfidenceWords.join(', ')}</span>
                        </div>
                      )}
                    </>
                  )}
                  {t.speaker === 'ai' && (
                    <button
                      onClick={() => speakAi(t.text)}
                      className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400"
                    >
                      <Volume2 className="w-3 h-3" /> Replay
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Continuous inline speech bubble that stays visible until committed to turns (never vanishes!) */}
          {(isRecording || livePreview.trim().length > 0) && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed bg-brand-600 text-white rounded-br-md shadow-sm">
                <span>{livePreview || '🎙️ Listening… speak now'}</span>
                {isRecording && (
                  <span className="inline-block w-1 h-3.5 ml-1.5 bg-white/85 animate-pulse align-middle rounded-full" />
                )}
              </div>
            </div>
          )}

          {isTranscribingAudio && !isRecording && !livePreview.trim() && (
            <div className="flex justify-end animate-fade-in">
              <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-xs font-semibold bg-brand-600/85 text-white/95 shadow-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Transcribing…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Minimalist Bottom Bar with the Silver Flowing Liquid Push-to-Talk Button */}
      <div className="relative flex-shrink-0 sticky bottom-0 z-20 px-4 sm:px-6 pb-safe pt-2.5 border-t border-slate-200/70 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md space-y-2">
        {showTextInput && !isRecording && (
          <form onSubmit={handleSendTypedReply} className="max-w-xl mx-auto flex items-center gap-2 animate-fade-in">
            <input
              type="text"
              value={typedReply}
              onChange={(e) => setTypedReply(e.target.value)}
              disabled={isProcessing || isAnalyzingScorecard}
              placeholder={`Type your reply to ${plan.persona.name}...`}
              className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
            <button
              type="submit"
              disabled={!typedReply.trim() || isProcessing || isAnalyzingScorecard}
              className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        )}

        <div className="max-w-xl mx-auto flex items-center justify-between">
          {/* Left: Subtle Help & Keyboard Buttons */}
          <div className="flex items-center gap-2 w-24">
            <button
              onClick={() => {
                handleStopSpeaking();
                if (isRecordingRef.current || isInitializingMicRef.current) {
                  cancelRecording();
                }
                setHelpOpen(true);
                setHelpRequests((n) => n + 1);
              }}
              className="flex flex-col items-center gap-0.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition active:scale-95"
              title="Need a phrase hint?"
            >
              <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/90 hover:bg-amber-50 dark:hover:bg-amber-950/50 flex items-center justify-center transition">
                <LifeBuoy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </span>
              <span className="text-[10px] font-semibold">Hints</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playChime('tap');
                setShowTextInput((v) => !v);
              }}
              className={`flex flex-col items-center gap-0.5 transition active:scale-95 ${
                showTextInput
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400'
              }`}
              title="Type a reply instead of speaking"
            >
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                  showTextInput
                    ? 'bg-brand-100 dark:bg-brand-950/70 text-brand-600 dark:text-brand-400 ring-1 ring-brand-300 dark:ring-brand-700'
                    : 'bg-slate-100 dark:bg-slate-800/90 hover:bg-brand-50 dark:hover:bg-brand-950/50'
                }`}
              >
                <Keyboard className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-semibold">Type</span>
            </button>
          </div>

          {/* Center: Single Simple Silver Flowing Liquid Push-to-Talk Button */}
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              {/* Layer 1: Liquid silver breathing radial bloom */}
              <span
                className={`absolute -inset-5 rounded-full pointer-events-none transition-all duration-500 ease-out ${
                  isRecording
                    ? 'liquid-silver-bloom opacity-100'
                    : 'bg-slate-400/20 dark:bg-slate-300/15 blur-xl silky-orb-idle'
                }`}
                style={
                  isRecording
                    ? { transform: `scale(${voiceBloomScale})` }
                    : undefined
                }
              />

              {/* Layer 2: Flowing liquid silver aura when speaking */}
              <span
                className={`absolute -inset-2 rounded-full blur-md pointer-events-none transition-all duration-500 ease-out ${
                  isRecording
                    ? 'liquid-silver-aura opacity-95'
                    : 'opacity-0 scale-75'
                }`}
                style={
                  isRecording
                    ? { transform: `scale(${voiceBloomScale * 0.98})` }
                    : undefined
                }
              />

              {/* The Single Simple Silver Flowing Liquid Button */}
              <button
                type="button"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onKeyDown={onKeyDown}
                onContextMenu={(e) => e.preventDefault()}
                disabled={isProcessing || isAnalyzingScorecard}
                className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ease-out touch-none select-none cursor-pointer disabled:opacity-40 ${
                  isRecording
                    ? 'liquid-silver-btn-active scale-105'
                    : 'liquid-silver-btn active:scale-95'
                }`}
                aria-label={
                  isRecording
                    ? isHolding
                      ? 'Release to finish speaking'
                      : 'Click to finish speaking'
                    : 'Hold to speak, or click once to start'
                }
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
                ) : (
                  <Mic
                    className={`w-6 h-6 transition-transform duration-300 ${
                      isRecording
                        ? 'text-slate-900 scale-110 drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]'
                        : 'text-slate-800'
                    }`}
                  />
                )}
              </button>
            </div>

            <span className="mt-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 select-none">
              {isProcessing
                ? 'Replying…'
                : isRecording
                ? isHolding
                  ? 'Release to transcribe'
                  : 'Listening… click again when done'
                : 'Hold to talk · or click once'}
            </span>
          </div>

          {/* Right: Finish Roleplay Button */}
          <div className="flex justify-end w-24">
            <button
              onClick={endRoleplay}
              disabled={isAnalyzingScorecard || isProcessing || userTurnsCount === 0}
              className="flex flex-col items-center gap-0.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-35 transition active:scale-95"
              title={userTurnsCount >= 1 ? 'Finish & view scorecard' : 'Speak at least once to finish'}
            >
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                  userTurnsCount >= 3
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                    : userTurnsCount >= 1
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-400 dark:text-slate-500'
                }`}
              >
                <Flag className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-semibold">Finish</span>
            </button>
          </div>
        </div>
      </div>

      {helpOpen && (
        <HowDoISaySheet
          phrases={plan.helpPhrases}
          nativeLanguage={nativeLanguage}
          accent={plan.persona.accent}
          audioSpeed={audioSpeed}
          scenarioTitle={plan.title}
          onClose={() => setHelpOpen(false)}
          onUsed={() => {}}
        />
      )}

      {/* Scorecard Grading Overlay with Multimodal Gemini AI */}
      {isAnalyzingScorecard && (
        <div className="absolute inset-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-4 shadow-soft">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Grading Your Spoken Roleplay</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
            {analyzingSeconds < 2
              ? 'Analyzing speech rhythm and phonetics with Gemini AI…'
              : 'Polishing your British phrasing upgrades and acoustic scores…'}
          </p>

          {analyzingSeconds >= 2 && (
            <button
              onClick={handleSkipWaitAndProceed}
              className="mt-5 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-brand-600 dark:hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95 animate-fade-in border border-transparent dark:border-slate-700"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>View Scorecard Instantly</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          )}
        </div>
      )}

      {/* Instant British Dictionary & Audio Lookup Popover */}
      {lookupWord && (
        <WordLookupModal
          word={lookupWord.word}
          contextSentence={lookupWord.sentence}
          scenarioTitle={plan.title}
          persona={plan.persona}
          audioSpeed={audioSpeed}
          onClose={() => setLookupWord(null)}
        />
      )}

      {/* In-App Diagnostic Logs Modal */}
      <DiagnosticLogsModal
        isOpen={isDiagnosticLogsOpen}
        onClose={() => setIsDiagnosticLogsOpen(false)}
      />
    </div>
  );
};
