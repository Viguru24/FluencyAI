import { useState, useRef, useCallback, useEffect } from 'react';
import { stopSpeaking, playChime } from '../services/speech';
import {
  startRecognition,
  isRecognitionSupported,
  deduplicateSpokenText,
  type RecognitionHandle,
  type SpokenSegmentAnalysis,
} from '../services/speechRecognition';
import { AudioRecorderController, type RecordedAudioClip } from '../services/audioRecorder';
import { AudioVisualizerController } from '../services/audioVisualizer';
import { transcribeAudioWithAI, type AudioAttachment } from '../services/geminiService';
import { toast } from '../services/toast';

// Only treat a press as Push-To-Talk Hold if held for >= 1.2s while actively speaking
const HOLD_THRESHOLD_MS = 1200;

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
      let audioClip: RecordedAudioClip | null = null;
      try {
        audioClip = await recorderRef.current.stop();
        if (audioClip?.base64) {
          recordedClipsRef.current.push({
            base64: audioClip.base64,
            mimeType: audioClip.mimeType,
          });
        }
      } catch (e) {
        console.warn('[useVoiceCapture] Recorder stop error:', e);
      }

      // Keep stream warm between turns for zero-latency restart
      vizRef.current.stopMicrophone(false);

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

      let finalSpoken = deduplicateSpokenText(heard.trim() || livePreviewRef.current.trim());
      updateLivePreview('');

      // Only invoke AI audio transcription fallback if Web Speech API returned empty AND
      // the user recorded at least 500ms of audio where voice activity was present
      if (!finalSpoken && audioClip?.base64 && (hadVoice || (audioClip.durationMs ?? 0) >= 600)) {
        setIsTranscribing(true);
        try {
          const aiTranscript = await transcribeAudioWithAI({
            base64: audioClip.base64,
            mimeType: audioClip.mimeType,
            blob: audioClip.blob,
          });
          if (aiTranscript && aiTranscript.trim().length > 0) {
            finalSpoken = deduplicateSpokenText(aiTranscript.trim());
            console.log('[useVoiceCapture] Recovered user transcript via AI:', finalSpoken);
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
        toast.info(
          "Didn't catch any speech — tap the mic, speak clearly, and tap again to send.",
          'No Speech Heard'
        );
        return;
      }

      onCompleteCapture(finalSpoken, audioClip);
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

    // Synchronously unmute any prewarmed tracks before starting SpeechRecognition
    vizRef.current.enableTracksSync();

    // Start SpeechRecognition IMMEDIATELY at tick 0 on user gesture
    recRef.current = isRecognitionSupported()
      ? startRecognition({
          lang,
          silenceTimeoutMs: 4500,
          initialSilenceTimeoutMs: 15000,
          onInterim: (text) => {
            if (!isRecordingRef.current) return;
            updateLivePreview(text);
            hasDetectedVoiceRef.current = true;
            lastVoiceTimeRef.current = Date.now();
          },
          onSilenceTimeout: () => {
            if (!isPressingRef.current && !isHoldingRef.current && isRecordingRef.current) {
              if (livePreviewRef.current.trim().length > 0) {
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
      if (avg > 0.06) {
        hasDetectedVoiceRef.current = true;
        lastVoiceTimeRef.current = now;
      } else if (
        livePreviewRef.current.trim().length > 0 &&
        !isPressingRef.current &&
        !isHoldingRef.current &&
        now - recordingStartedAtRef.current > 2500 &&
        now - lastVoiceTimeRef.current > 4200
      ) {
        // User spoke recognized words and paused for >4.2s -> auto-complete turn
        stopRecording();
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

    if (pendingStopRef.current || !isRecordingRef.current) {
      pendingStopRef.current = false;
      isInitializingMicRef.current = false;
      stopRecording();
      return;
    }

    const stream = vizRef.current.getStream();
    await recorderRef.current.start(stream);
    isInitializingMicRef.current = false;

    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      stopRecording();
    }
  }, [cancelRecording, lang, onBeforeStart, onMicDenied, stopRecording, updateLivePreview]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, disabled?: boolean) => {
      e.preventDefault();
      if (disabled || isStoppingRef.current) return;

      // If already recording, a second tap/click finishes and sends the recording!
      if (isRecordingRef.current) {
        isPressingRef.current = false;
        if (holdTimerRef.current) {
          window.clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
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
        if (isPressingRef.current && isRecordingRef.current) {
          setIsHolding(true);
          isHoldingRef.current = true;
        }
      }, HOLD_THRESHOLD_MS);
    },
    [startRecording, stopRecording]
  );

  const onPointerUp = useCallback(
    (e?: React.PointerEvent) => {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      if (!isPressingRef.current) return;
      const duration = Date.now() - pressStartTimeRef.current;
      isPressingRef.current = false;
      const wasLongHoldWithSpeech =
        (isHoldingRef.current || duration >= HOLD_THRESHOLD_MS) &&
        livePreviewRef.current.trim().length > 0;
      setIsHolding(false);
      isHoldingRef.current = false;

      if (e) {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      // Only stop on pointer release if the user intentionally held the button for >= 1.2s AND
      // already spoke words. Otherwise keep listening in Tap-to-Talk mode!
      if (wasLongHoldWithSpeech) {
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
