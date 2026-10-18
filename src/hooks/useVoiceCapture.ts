import { useState, useRef, useCallback, useEffect } from 'react';
import { stopSpeaking, playChime } from '../services/speech';
import {
  startRecognition,
  isRecognitionSupported,
  deduplicateSpokenText,
  chooseBestTranscript,
  type RecognitionHandle,
  type SpokenSegmentAnalysis,
} from '../services/speechRecognition';
import { AudioRecorderController, type RecordedAudioClip } from '../services/audioRecorder';
import { AudioVisualizerController } from '../services/audioVisualizer';
import { transcribeAudioWithAI, type AudioAttachment } from '../services/geminiService';
import { toast } from '../services/toast';

export interface UseVoiceCaptureOptions {
  lang?: 'en-GB' | 'en-US';
  onCompleteCapture: (transcript: string, audioClip?: RecordedAudioClip | null) => void;
  onBeforeStart?: () => void;
  onMicDenied?: () => void;
}

export function useVoiceCapture({
  lang = 'en-GB',
  onCompleteCapture,
  onBeforeStart,
  onMicDenied,
}: UseVoiceCaptureOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [bands, setBands] = useState<number[]>([]);
  const [livePreview, setLivePreview] = useState('');

  const vizRef = useRef(new AudioVisualizerController());
  const recorderRef = useRef(new AudioRecorderController());
  const recRef = useRef<RecognitionHandle | null>(null);
  const recordedClipsRef = useRef<AudioAttachment[]>([]);
  const pronunciationMetadataRef = useRef<SpokenSegmentAnalysis[]>([]);

  const isRecordingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isInitializingMicRef = useRef(false);
  const pressStartTimeRef = useRef(0);
  const isPressingRef = useRef(false);
  const isHoldingRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const pendingStopRef = useRef(false);
  const livePreviewRef = useRef('');
  const hasDetectedVoiceRef = useRef(false);
  const lastVoiceTimeRef = useRef(0);
  const recordingStartedAtRef = useRef(0);

  const updateLivePreview = useCallback((text: string) => {
    livePreviewRef.current = text;
    setLivePreview(text);
  }, []);

  const cleanupAudio = useCallback(() => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    stopSpeaking();
    vizRef.current.stopMicrophone(true);
    recorderRef.current.stop().catch(() => {});
    recRef.current?.abort();
    recRef.current = null;
    isInitializingMicRef.current = false;
    isRecordingRef.current = false;
    isStoppingRef.current = false;
    isPressingRef.current = false;
    isHoldingRef.current = false;
    pendingStopRef.current = false;
    hasDetectedVoiceRef.current = false;
    setIsRecording(false);
    setIsHolding(false);
    setIsTranscribing(false);
    setBands([]);
    updateLivePreview('');
  }, [updateLivePreview]);

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
    setIsTranscribing(false);
    setBands([]);
    updateLivePreview('');
    vizRef.current.stopMicrophone(false);
    recorderRef.current.stop().catch(() => {});
    recRef.current?.abort();
    recRef.current = null;
    playChime('tap');
  }, [updateLivePreview]);

  useEffect(() => {
    vizRef.current.prewarm().catch(() => {});
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const stopRecording = useCallback(async () => {
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
    playChime('micStop');

    try {
      // Short 180ms acoustic tail buffer so the final syllable of the user's last word is never clipped
      await new Promise((resolve) => window.setTimeout(resolve, 180));

      const activeRec = recRef.current;
      recRef.current = null;

      const [audioClip, details] = await Promise.all([
        recorderRef.current.stop().catch((e) => {
          console.warn('[useVoiceCapture] Recorder stop error:', e);
          return null;
        }),
        activeRec ? activeRec.stopWithDetails().catch(() => null) : Promise.resolve(null),
      ]);

      if (audioClip?.base64) {
        recordedClipsRef.current.push({
          base64: audioClip.base64,
          mimeType: audioClip.mimeType,
        });
      }

      // Stop visualizer loop after recorder and speech recognition have flushed
      vizRef.current.stopMicrophone(false);

      let heard = '';
      if (details) {
        heard = details.transcript;
        if (details.segments.length > 0) {
          pronunciationMetadataRef.current.push(...details.segments);
        }
      }

      const bestRaw = chooseBestTranscript(livePreviewRef.current.trim(), heard.trim());
      let finalSpoken = deduplicateSpokenText(bestRaw);

      if (finalSpoken) {
        updateLivePreview(finalSpoken);
      }

      // Only invoke AI audio transcription as a fallback when Web Speech API produced nothing at all
      if (
        !finalSpoken &&
        audioClip?.base64 &&
        (hadVoice || (audioClip.durationMs ?? 0) >= 450)
      ) {
        setIsTranscribing(true);
        try {
          const aiPromise = transcribeAudioWithAI({
            base64: audioClip.base64,
            mimeType: audioClip.mimeType,
            blob: audioClip.blob,
          });
          const timeoutPromise = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2800));
          const aiTranscript = await Promise.race([aiPromise, timeoutPromise]);

          if (aiTranscript && aiTranscript.trim().length > 0) {
            finalSpoken = chooseBestTranscript(finalSpoken, aiTranscript.trim());
            updateLivePreview(finalSpoken);
          }
        } catch (err) {
          console.warn('[useVoiceCapture] AI audio transcription fallback error:', err);
        } finally {
          setIsTranscribing(false);
        }
      }

      // If no speech was captured, do NOT send a fake hesitation message that confuses the AI!
      // Simply reset cleanly and let the user speak when ready.
      if (!finalSpoken) {
        updateLivePreview('');
        toast.info(
          "Didn't catch any speech — press and hold to speak, or click once to start and click again when done.",
          'No Speech Heard'
        );
        return;
      }

      // Commit the turn first, then clear livePreview in the exact same synchronous React batch!
      onCompleteCapture(finalSpoken, audioClip);
      updateLivePreview('');
    } finally {
      isStoppingRef.current = false;
      setIsTranscribing(false);
    }
  }, [onCompleteCapture, updateLivePreview]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isInitializingMicRef.current || isStoppingRef.current) return;
    pendingStopRef.current = false;
    isInitializingMicRef.current = true;
    isRecordingRef.current = true;
    hasDetectedVoiceRef.current = false;
    const startTs = Date.now();
    recordingStartedAtRef.current = startTs;
    lastVoiceTimeRef.current = startTs;

    stopSpeaking();
    onBeforeStart?.();

    // Instant visual & audio feedback on touch
    setIsRecording(true);
    updateLivePreview('');
    playChime('micStart');

    // Synchronously unmute any prewarmed tracks and start MediaRecorder at tick 0 if stream is live
    vizRef.current.enableTracksSync();
    const prewarmedStream = vizRef.current.getStream();
    let recorderStartedAtTickZero = false;
    if (prewarmedStream && prewarmedStream.active) {
      recorderStartedAtTickZero = true;
      recorderRef.current.start(prewarmedStream).catch(() => {
        recorderStartedAtTickZero = false;
      });
    }

    // Start SpeechRecognition IMMEDIATELY at tick 0 on user gesture
    recRef.current = isRecognitionSupported()
      ? startRecognition({
          lang,
          silenceTimeoutMs: 5000,
          initialSilenceTimeoutMs: 15000,
          onInterim: (text) => {
            if (!isRecordingRef.current && !isStoppingRef.current) return;
            updateLivePreview(text);
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
        })
      : null;

    const ok = await vizRef.current.startMicrophone((newBands) => {
      setBands(newBands);
      if (!isRecordingRef.current) return;
      const avg = newBands.length > 0 ? newBands.reduce((a, b) => a + b, 0) / newBands.length : 0;
      const now = Date.now();
      if (avg > 0.045) {
        hasDetectedVoiceRef.current = true;
        lastVoiceTimeRef.current = now;
      }
    });

    if (!ok) {
      recRef.current?.abort();
      recRef.current = null;
      isInitializingMicRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsHolding(false);
      if (onMicDenied) {
        onMicDenied();
      } else {
        toast.error(
          'Microphone permission was not granted. Please allow microphone access in your browser.',
          'Microphone Blocked'
        );
      }
      return;
    }

    if (!isRecordingRef.current) {
      isInitializingMicRef.current = false;
      return;
    }

    if (!recorderStartedAtTickZero || !recorderRef.current.isRecording()) {
      const stream = vizRef.current.getStream();
      await recorderRef.current.start(stream);
    }
    isInitializingMicRef.current = false;

    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      stopRecording();
    }
  }, [cancelRecording, lang, onBeforeStart, onMicDenied, stopRecording, updateLivePreview]);

  const QUICK_CLICK_THRESHOLD_MS = 300;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, disabled?: boolean) => {
      e.preventDefault();
      if (disabled || isStoppingRef.current) return;

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
        /* ignore */
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
    },
    [startRecording, stopRecording]
  );

  const onPointerUp = useCallback(
    (e?: React.PointerEvent<HTMLElement>) => {
      if (e) {
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          /* ignore */
        }
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

      // If held down (>= 300ms), releasing immediately stops and transcribes!
      // If clicked quickly (< 300ms), it stays listening until clicked again.
      if (heldMs >= QUICK_CLICK_THRESHOLD_MS && (isRecordingRef.current || isInitializingMicRef.current)) {
        stopRecording();
      }
    },
    [stopRecording]
  );

  return {
    isRecording,
    isHolding,
    isTranscribing,
    bands,
    livePreview,
    recordedClipsRef,
    pronunciationMetadataRef,
    startRecording,
    stopRecording,
    cancelRecording,
    cleanupAudio,
    onPointerDown,
    onPointerUp,
  };
}
