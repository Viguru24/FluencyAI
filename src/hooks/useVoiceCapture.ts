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

const HOLD_THRESHOLD_MS = 280;

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
    stopSpeaking();
    vizRef.current.stopMicrophone(true);
    recorderRef.current.stop().catch(() => {});
    recRef.current?.stop();
    isInitializingMicRef.current = false;
    isRecordingRef.current = false;
    isStoppingRef.current = false;
    hasDetectedVoiceRef.current = false;
    setIsRecording(false);
    setIsHolding(false);
    updateLivePreview('');
  }, [updateLivePreview]);

  useEffect(() => {
    // Pre-warm microphone stream in the background if available
    vizRef.current.prewarm().catch(() => {});
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const stopRecording = useCallback(async () => {
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

      let finalSpoken = deduplicateSpokenText(livePreviewRef.current.trim() || heard.trim());
      updateLivePreview('');

      if (!finalSpoken && audioClip?.base64) {
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
        }
      }

      // If user said nothing / silence / hesitation, don't ignore them — let tutor respond and guide them!
      if (!finalSpoken) {
        finalSpoken = '(Silence / hesitated)';
      }

      onCompleteCapture(finalSpoken, audioClip);
    } finally {
      isStoppingRef.current = false;
    }
  }, [onCompleteCapture, updateLivePreview]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isInitializingMicRef.current) return;
    pendingStopRef.current = false;
    isInitializingMicRef.current = true;
    hasDetectedVoiceRef.current = false;
    lastVoiceTimeRef.current = Date.now();
    stopSpeaking();
    onBeforeStart?.();

    // Instant visual & audio feedback on touch
    setIsRecording(true);
    updateLivePreview('');
    playChime('micStart');

    // CRITICAL: Start SpeechRecognition IMMEDIATELY at tick 0 on user gesture!
    // Never await getUserMedia or MediaRecorder before starting speech recognition.
    recRef.current = isRecognitionSupported()
      ? startRecognition({
          lang,
          silenceTimeoutMs: 2300,
          onInterim: (text) => {
            updateLivePreview(text);
            hasDetectedVoiceRef.current = true;
            lastVoiceTimeRef.current = Date.now();
          },
          onSilenceTimeout: () => {
            if (!isPressingRef.current && !isHoldingRef.current && isRecordingRef.current) {
              stopRecording();
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
        hasDetectedVoiceRef.current = true;
        lastVoiceTimeRef.current = now;
      } else if (
        hasDetectedVoiceRef.current &&
        !isPressingRef.current &&
        !isHoldingRef.current &&
        now - recordingStartedAtRef.current > 1200 &&
        now - lastVoiceTimeRef.current > 2000
      ) {
        hasDetectedVoiceRef.current = false;
        stopRecording();
      } else if (
        !hasDetectedVoiceRef.current &&
        !isPressingRef.current &&
        !isHoldingRef.current &&
        now - recordingStartedAtRef.current > 5500
      ) {
        // User started recording but stayed silent for 5.5s -> auto-finish and let tutor prompt them
        stopRecording();
      }
    });
    if (!ok) {
      recRef.current?.stop();
      recRef.current = null;
      isInitializingMicRef.current = false;
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsHolding(false);
      if (onMicDenied) {
        onMicDenied();
      } else {
        alert('Microphone permission was not granted. Please allow microphone access in your browser.');
      }
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

    const stream = vizRef.current.getStream();
    await recorderRef.current.start(stream);
    recordingStartedAtRef.current = Date.now();
    isInitializingMicRef.current = false;
    isRecordingRef.current = true;

    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      stopRecording();
    }
  }, [lang, onBeforeStart, onMicDenied, stopRecording, updateLivePreview]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, disabled?: boolean) => {
      e.preventDefault();
      if (disabled) return;

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
    },
    [stopRecording]
  );

  return {
    isRecording,
    isHolding,
    bands,
    livePreview,
    recordedClipsRef,
    pronunciationMetadataRef,
    startRecording,
    stopRecording,
    cleanupAudio,
    onPointerDown,
    onPointerUp,
  };
}
