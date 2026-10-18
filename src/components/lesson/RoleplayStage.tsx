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
} from 'lucide-react';
import type { CEFRLevel, LessonPlan, NativeLanguage, PhrasingUpgrade, PronunciationCoachingPoint, PronunciationFeedbackWord } from '../../types';
import { speakEnglish, stopSpeaking, playChime, isCurrentlySpeaking } from '../../services/speech';
import {
  startRecognition,
  isRecognitionSupported,
  extractWordsFromSpeechResults,
  deduplicateSpokenText,
  type RecognitionHandle,
  type SpokenSegmentAnalysis,
  type WordConfidenceInfo,
} from '../../services/speechRecognition';
import { AudioRecorderController, type RecordedAudioClip } from '../../services/audioRecorder';
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

const HOLD_THRESHOLD_MS = 600;

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
  const pendingStopRef = useRef(false);
  const hasDetectedVoiceRef = useRef(false);
  const lastVoiceTimeRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);

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
    (index: number) => {
      const text = plan.aiTurns[index];
      if (!text) return;
      setTurns((t) => [...t, { id: `ai-${index}`, speaker: 'ai', text, revealed: false }]);
      setAiIndex(index + 1);
      speakAi(text);
    },
    [plan.aiTurns, speakAi]
  );

  // Kick off with James's opening line & prewarm mic
  useEffect(() => {
    // Pre-warm the microphone stream in the background if permissions are already granted
    vizRef.current.prewarm().catch(() => {});
    const t = window.setTimeout(() => pushAiTurn(0), 500);
    const viz = vizRef.current;
    const recorder = recorderRef.current;
    return () => {
      window.clearTimeout(t);
      stopSpeaking();
      viz.stopMicrophone(true);
      recorder.stop();
      recRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, livePreview, isRecording, isTranscribingAudio]);

  const startRecording = async () => {
    if (isRecordingRef.current || isInitializingMicRef.current || isProcessing) return;
    pendingStopRef.current = false;
    isInitializingMicRef.current = true;
    hasDetectedVoiceRef.current = false;
    lastVoiceTimeRef.current = Date.now();
    stopSpeaking();
    setIsAiSpeaking(false);

    // Instant silky glow + warm acoustic chime on touch
    setIsRecording(true);
    livePreviewRef.current = '';
    setLivePreview('');
    setLiveLowConfidenceWords([]);
    playChime('micStart');

    diagnosticLogger.log('VOICE', 'startRecording initiated by user gesture');

    // CRITICAL: Start SpeechRecognition IMMEDIATELY at tick 0 on user gesture!
    // Never await getUserMedia or MediaRecorder before starting speech recognition.
    // Starting it synchronously guarantees Web Speech API begins listening without losing the first word.
    recRef.current = isRecognitionSupported()
      ? startRecognition({
          lang: plan.persona.accent === 'UK' ? 'en-GB' : 'en-US',
          silenceTimeoutMs: 2300,
          onInterim: (text) => {
            livePreviewRef.current = text;
            setLivePreview(text);
            hasDetectedVoiceRef.current = true;
            lastVoiceTimeRef.current = Date.now();
          },
          onSilenceTimeout: () => {
            if (!isPressingRef.current && !isHoldingRef.current && isRecordingRef.current) {
              stopRecording();
            }
          },
          onSpeechResults: (eventResults) => {
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

    const ok = await vizRef.current.startMicrophone((newBands) => {
      setBands(newBands);
      if (!isRecordingRef.current) return;
      const avg = newBands.length > 0 ? newBands.reduce((a, b) => a + b, 0) / newBands.length : 0;
      const now = Date.now();
      if (avg > 0.04) {
        if (!hasDetectedVoiceRef.current) {
          diagnosticLogger.log('VOICE', `Voice activity detected (amplitude: ${avg.toFixed(3)})`);
        }
        hasDetectedVoiceRef.current = true;
        lastVoiceTimeRef.current = now;
      } else if (
        hasDetectedVoiceRef.current &&
        !isPressingRef.current &&
        !isHoldingRef.current &&
        now - recordingStartedAtRef.current > 1200 &&
        now - lastVoiceTimeRef.current > 2000
      ) {
        // User tapped once, spoke, and paused for ~2.0s -> auto-finish recording!
        hasDetectedVoiceRef.current = false;
        diagnosticLogger.log('VOICE', '2-second silence detected, auto-completing speaking turn');
        stopRecording();
      } else if (
        !hasDetectedVoiceRef.current &&
        !isPressingRef.current &&
        !isHoldingRef.current &&
        now - recordingStartedAtRef.current > 5500
      ) {
        // User started recording but stayed silent for 5.5s -> auto-finish and let tutor prompt them
        diagnosticLogger.log('VOICE', '5.5s initial silence detected, auto-completing speaking turn');
        stopRecording();
      }
    });

    if (!ok) {
      diagnosticLogger.error('VOICE', 'Microphone start failed or permission denied in viz.startMicrophone');
      recRef.current?.stop();
      recRef.current = null;
      isInitializingMicRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsHolding(false);
      onMicDenied();
      return;
    }

    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      isInitializingMicRef.current = false;
      vizRef.current.stopMicrophone(false);
      recRef.current?.stop();
      recRef.current = null;
      isRecordingRef.current = false;
      setIsRecording(false);
      return;
    }

    const activeStream = vizRef.current.getStream();
    await recorderRef.current.start(activeStream);
    recordingStartedAtRef.current = Date.now();
    isInitializingMicRef.current = false;
    isRecordingRef.current = true;

    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      stopRecording();
    }
  };

  const stopRecording = async () => {
    if (isInitializingMicRef.current) {
      pendingStopRef.current = true;
      return;
    }
    if (!isRecordingRef.current || isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;
    isRecordingRef.current = false;
    hasDetectedVoiceRef.current = false;
    setIsRecording(false);
    setIsHolding(false);
    isHoldingRef.current = false;
    isPressingRef.current = false;
    setBands([]);
    setIsProcessing(true);
    playChime('micStop');

    try {
      let audioClip: RecordedAudioClip | null = null;
      try {
        audioClip = await recorderRef.current.stop();
      } catch (e) {
        console.warn('[RoleplayStage] Failed to stop audio recorder:', e);
      }

      // Keep stream warm between turns for zero-latency restart
      vizRef.current.stopMicrophone(false);

      let heard: string | null = null;
      let turnLowConfidenceWords: string[] = [];
      let turnWordConfidences: WordConfidenceInfo[] = [];

      if (recRef.current) {
        const details = await recRef.current.stopWithDetails();
        recRef.current = null;
        if (details) {
          heard = details.transcript;

          const extractedWords = details.rawResults
            ? extractWordsFromSpeechResults(details.rawResults)
            : details.allWords && details.allWords.length > 0
            ? details.allWords
            : [];

          turnWordConfidences = extractedWords;

          const lowConfWordsFromResult = extractedWords
            .filter((w) => w.isLowConfidence || (w.confidence > 0 && w.confidence < 0.75))
            .map((w) => w.word.toLowerCase());

          const lowConfWordsFromDetails = (details.lowConfidenceWords || [])
            .filter((w) => w.isLowConfidence || (w.confidence > 0 && w.confidence < 0.75))
            .map((w) => w.word.toLowerCase());

          const flaggedSegments = details.segments.filter(
            (s) => s.isLowConfidence || (s.confidence > 0 && s.confidence < 0.75) || s.alternatives.length > 0
          );
          if (flaggedSegments.length > 0) {
            pronunciationMetadataRef.current.push(...flaggedSegments);
          }

          turnLowConfidenceWords = Array.from(
            new Set([...lowConfWordsFromResult, ...lowConfWordsFromDetails, ...liveLowConfidenceWords])
          );

          turnLowConfidenceWords.forEach((word) => sessionLowConfidenceWordsRef.current.add(word));
        }
      }

      let finalTranscript = deduplicateSpokenText(livePreviewRef.current.trim() || livePreview.trim() || heard?.trim() || '');
      livePreviewRef.current = '';
      setLivePreview('');
      setLiveLowConfidenceWords([]);

      let audioAttachment: AudioAttachment | null = null;
      if (audioClip && audioClip.base64) {
        audioAttachment = {
          base64: audioClip.base64,
          mimeType: audioClip.mimeType,
        };
        recordedClipsRef.current.push(audioAttachment);
      }

      // AI Audio Transcription Fallback:
      // If the browser Web Speech API did not return text (common on mobile Android due to mic exclusive lock),
      // but the microphone successfully recorded audio, transcribe the audio using Gemini multimodal AI!
      if (!finalTranscript && audioAttachment && audioAttachment.base64) {
        diagnosticLogger.log(
          'VOICE',
          `Web Speech API returned empty transcript. Triggering AI audio transcription fallback (${audioAttachment.mimeType}, size: ${audioAttachment.base64.length} chars)...`
        );
        setIsTranscribingAudio(true);
        try {
          const aiTranscript = await transcribeAudioWithAI({
            base64: audioAttachment.base64,
            mimeType: audioAttachment.mimeType,
            blob: audioClip?.blob,
          });
          if (aiTranscript && aiTranscript.trim().length > 0) {
            finalTranscript = deduplicateSpokenText(aiTranscript.trim());
            diagnosticLogger.log('VOICE', `AI audio fallback transcription successful: "${finalTranscript}"`);
            console.log('[RoleplayStage] Recovered user transcript via AI:', finalTranscript);
          } else {
            diagnosticLogger.warn('VOICE', 'AI audio fallback returned empty or whitespace-only text');
          }
        } catch (err: any) {
          diagnosticLogger.error('VOICE', `AI audio fallback transcription error: ${err?.message || err}`);
          console.warn('[RoleplayStage] AI audio transcription fallback error:', err);
        } finally {
          setIsTranscribingAudio(false);
        }
      }

      // If user stayed silent or no speech was captured, DO NOT ignore it — register hesitation and let tutor guide them!
      if (!finalTranscript) {
        diagnosticLogger.log('VOICE', 'No speech detected after recording stop, registering hesitation turn');
        finalTranscript = '(Silence / hesitated)';
      }

      finalTranscript = deduplicateSpokenText(finalTranscript);

      const idx = userTurnCount.current++;
      const userSpokeReal = true;
      const text = finalTranscript;

      if (userSpokeReal && text !== '(Silence / hesitated)') {
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
      }

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
        const isHesitation = text.includes('Silence / hesitated');
        const fallbackAi = isHesitation
          ? "No worries at all, take your time! If you're not sure how to answer, you could say: 'Could you give me a moment, please?' or ask for a hint."
          : plan.aiTurns[Math.min(aiIndex, plan.aiTurns.length - 1)] || 'Splendid! Lovely chatting with you.';
        setTurns((prev) => [
          ...prev,
          { id: `ai-${Date.now()}`, speaker: 'ai', text: fallbackAi, revealed: false },
        ]);
        setAiIndex((i) => i + 1);
        speakAi(fallbackAi);
      }
    } finally {
      isStoppingRef.current = false;
      setIsProcessing(false);
    }
  };

  // Supports both Hold-and-Release AND Quick-Tap-to-Start / Tap-Again-to-End (plus Auto-Silence Stop)
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isProcessing || isAnalyzingScorecard) return;

    if (isRecordingRef.current || isInitializingMicRef.current) {
      isPressingRef.current = false;
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
    const wasHolding = isHoldingRef.current && duration >= HOLD_THRESHOLD_MS;
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

  const onPointerCancel = (e: React.PointerEvent) => {
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

          {/* Subtle inline live speech preview inside the chat flow (no floating popup clutter) */}
          {isRecording && (
            <div className="flex justify-end animate-fade-in">
              <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm bg-indigo-600/85 text-white/95 shadow-sm backdrop-blur-xs">
                <span>{livePreview || '🎙️ Listening… speak now'}</span>
                <span className="inline-block w-1 h-3.5 ml-1 bg-white/80 animate-pulse align-middle rounded-full" />
              </div>
            </div>
          )}

          {isTranscribingAudio && !isRecording && (
            <div className="flex justify-end animate-fade-in">
              <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-xs font-semibold bg-indigo-600/75 text-white/95 shadow-sm backdrop-blur-xs flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Transcribing your speech…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Minimalist Bottom Bar with the Little Silky Glowing Voice Button */}
      <div className="relative flex-shrink-0 sticky bottom-0 z-20 px-4 sm:px-6 pb-safe pt-2.5 border-t border-slate-200/70 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          {/* Left: Subtle Help Button */}
          <button
            onClick={() => {
              handleStopSpeaking();
              if (isRecordingRef.current || isInitializingMicRef.current) {
                isInitializingMicRef.current = false;
                isRecordingRef.current = false;
                setIsRecording(false);
                setIsHolding(false);
                isHoldingRef.current = false;
                isPressingRef.current = false;
                setBands([]);
                livePreviewRef.current = '';
                setLivePreview('');
                vizRef.current.stopMicrophone();
                recorderRef.current.stop().catch(() => {});
                recRef.current?.stop().catch(() => {});
                recRef.current = null;
              }
              setHelpOpen(true);
              setHelpRequests((n) => n + 1);
            }}
            className="flex flex-col items-center gap-0.5 w-20 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition active:scale-95"
            title="Need a phrase hint?"
          >
            <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/90 hover:bg-amber-50 dark:hover:bg-amber-950/50 flex items-center justify-center transition">
              <LifeBuoy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </span>
            <span className="text-[10px] font-semibold">Hints</span>
          </button>

          {/* Center: The Little Silky Glowing Voice Button */}
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              {/* Layer 1: Ambient breathing radial bloom */}
              <span
                className={`absolute -inset-5 rounded-full pointer-events-none transition-all duration-500 ease-out ${
                  isRecording
                    ? 'silky-orb-active-bloom opacity-100'
                    : 'bg-indigo-500/15 dark:bg-indigo-400/15 blur-xl silky-orb-idle'
                }`}
                style={
                  isRecording
                    ? { transform: `scale(${voiceBloomScale})` }
                    : undefined
                }
              />

              {/* Layer 2: Silky rotating multi-hue aurora halo when recording */}
              <span
                className={`absolute -inset-2 rounded-full blur-md pointer-events-none transition-all duration-500 ease-out ${
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

              {/* Layer 3: Soft inner luminous rim */}
              <span
                className={`absolute -inset-0.5 rounded-full pointer-events-none transition-all duration-500 ${
                  isRecording
                    ? 'bg-gradient-to-tr from-sky-400 via-indigo-400 to-fuchsia-400 opacity-90 blur-[2px]'
                    : 'bg-gradient-to-tr from-brand-400/40 to-indigo-400/40 opacity-50'
                }`}
              />

              {/* The Little Button itself */}
              <button
                type="button"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onKeyDown={onKeyDown}
                onContextMenu={(e) => e.preventDefault()}
                disabled={isProcessing || isAnalyzingScorecard}
                className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-white transition-all duration-500 ease-out touch-none select-none cursor-pointer disabled:opacity-40 ${
                  isRecording
                    ? 'bg-gradient-to-tr from-indigo-600 via-violet-500 to-sky-400 scale-105 shadow-[0_0_30px_rgba(99,102,241,0.65),inset_0_1px_3px_rgba(255,255,255,0.65)]'
                    : 'bg-gradient-to-tr from-brand-600 via-indigo-500 to-sky-500 hover:scale-[1.04] active:scale-95 shadow-[0_6px_20px_rgba(59,130,246,0.35),inset_0_1px_2px_rgba(255,255,255,0.45)]'
                }`}
                aria-label={
                  isRecording
                    ? 'Release or tap to finish speaking'
                    : 'Hold to talk, or tap to start and tap again to end'
                }
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white/95" />
                ) : (
                  <Mic
                    className={`w-6 h-6 transition-transform duration-300 ${
                      isRecording ? 'scale-110 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'text-white'
                    }`}
                  />
                )}
              </button>
            </div>

            <span className="mt-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 select-none">
              {isTranscribingAudio
                ? 'Transcribing…'
                : isProcessing
                ? 'Thinking…'
                : isRecording
                ? isHolding
                  ? 'Release to finish'
                  : 'Tap to finish (or pause)'
                : 'Hold or tap to speak'}
            </span>
          </div>

          {/* Right: Finish Roleplay Button */}
          <button
            onClick={endRoleplay}
            disabled={isAnalyzingScorecard || isProcessing || userTurnsCount === 0}
            className="flex flex-col items-center gap-0.5 w-20 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-35 transition active:scale-95"
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
