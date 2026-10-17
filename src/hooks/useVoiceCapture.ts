import { useState, useRef, useCallback, useEffect } from 'react';
import { stopSpeaking, playChime } from '../services/speech';
import {
  startRecognition,
  isRecognitionSupported,
  type RecognitionHandle,
  type SpokenSegmentAnalysis,
} from '../services/speechRecognition';
import { AudioRecorderController, type RecordedAudioClip } from '../services/audioRecorder';
import { AudioVisualizerController } from '../services/audioVisualizer';
import type { AudioAttachment } from '../services/geminiService';

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
  const pressStartTimeRef = useRef(0);
  const isPressingRef = useRef(false);
  const isHoldingRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const pendingStopRef = useRef(false);
  const livePreviewRef = useRef('');

  const updateLivePreview = useCallback((text: string) => {
    livePreviewRef.current = text;
    setLivePreview(text);
  }, []);

  const cleanupAudio = useCallback(() => {
    stopSpeaking();
    vizRef.current.stopMicrophone();
    recorderRef.current.stop().catch(() => {});
    recRef.current?.stop();
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsHolding(false);
    updateLivePreview('');
  }, [updateLivePreview]);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const stopRecording = useCallback(async () => {
    if (!isRecordingRef.current) {
      pendingStopRef.current = true;
      return;
    }

    isRecordingRef.current = false;
    setIsRecording(false);
    setIsHolding(false);
    isHoldingRef.current = false;
    isPressingRef.current = false;
    setBands([]);
    playChime('micStop');

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

    const finalSpoken = livePreviewRef.current.trim() || heard.trim();
    updateLivePreview('');

    if (finalSpoken) {
      onCompleteCapture(finalSpoken, audioClip);
    }
  }, [onCompleteCapture, updateLivePreview]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    pendingStopRef.current = false;
    stopSpeaking();
    onBeforeStart?.();

    // Instant visual & audio feedback on touch
    isRecordingRef.current = true;
    setIsRecording(true);
    updateLivePreview('');
    playChime('micStart');

    const ok = await vizRef.current.startMicrophone(setBands);
    if (!ok) {
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

    if (pendingStopRef.current || !isRecordingRef.current) {
      pendingStopRef.current = false;
      vizRef.current.stopMicrophone();
      isRecordingRef.current = false;
      setIsRecording(false);
      return;
    }

    const stream = vizRef.current.getStream();
    await recorderRef.current.start(stream);

    recRef.current = isRecognitionSupported()
      ? startRecognition({
          lang,
          silenceTimeoutMs: 0,
          onInterim: (text) => updateLivePreview(text),
        })
      : null;

    if (pendingStopRef.current) {
      pendingStopRef.current = false;
      stopRecording();
    }
  }, [lang, onBeforeStart, onMicDenied, stopRecording, updateLivePreview]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, disabled?: boolean) => {
      e.preventDefault();
      if (disabled) return;

      if (isRecordingRef.current) {
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
