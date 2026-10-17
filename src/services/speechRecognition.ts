// Web SpeechRecognition Service - Robust Voice Recognition for Non-Native Language Learners
// Supports Chrome, Edge, Safari with pause-tolerant continuous capture, interim results,
// silence detection (6s timeout), and word-level acoustic confidence & phonetic alternative scoring.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NativeLanguage } from '../types';
import { diagnosticLogger } from './diagnosticLogger';

type AnyRecognition = any;

export const NATIVE_LANG_TO_BCP47: Record<NativeLanguage, string> = {
  German: 'de-DE',
  Spanish: 'es-ES',
  French: 'fr-FR',
  Portuguese: 'pt-BR',
  Mandarin: 'zh-CN',
  Japanese: 'ja-JP',
  Arabic: 'ar-SA',
  Vietnamese: 'vi-VN',
};

export function getBcp47ForNativeLanguage(lang: NativeLanguage): string {
  return NATIVE_LANG_TO_BCP47[lang] || 'en-GB';
}

export function isRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface SpokenSegmentAnalysis {
  text: string;
  confidence: number;
  alternatives: string[];
  isLowConfidence: boolean;
  isAmbiguous: boolean;
}

export interface WordConfidenceInfo {
  word: string;
  confidence: number;
  alternatives: string[];
  isLowConfidence: boolean;
}

export interface RecognitionDetails {
  transcript: string;
  confidence: number;
  segments: SpokenSegmentAnalysis[];
  lowConfidenceWords: WordConfidenceInfo[];
  allWords: WordConfidenceInfo[];
  rawResults?: any;
}

export interface RecognitionOptions {
  lang?: string;
  onInterim?: (text: string) => void;
  onStatusChange?: (status: 'listening' | 'heard' | 'error' | 'stopped', details?: string) => void;
  silenceTimeoutMs?: number; // Defaults to 6000ms (6s pause tolerance for ESL learners)
  onSilenceTimeout?: () => void;
  onSilenceStop?: () => void;
  onSegmentAnalysis?: (segments: SpokenSegmentAnalysis[]) => void;
  onSpeechResults?: (results: any) => void;
}

export interface RecognitionHandle {
  stop: () => Promise<string | null>;
  stopWithDetails: () => Promise<RecognitionDetails | null>;
  getLatestTranscript: () => string;
  getPronunciationMetadata: () => SpokenSegmentAnalysis[];
  resetSilenceTimer: () => void;
  pauseSilenceTimer: (paused: boolean) => void;
}

/**
 * Merges accumulated transcript with current cycle transcript, eliminating accidental duplicate text
 * from Web Speech API restarts, audio buffer flushes, and interim-to-final transitions.
 */
export function mergeTranscripts(accumulated: string, current: string): string {
  const acc = (accumulated || '').trim();
  const curr = (current || '').trim();

  if (!acc) return curr;
  if (!curr) return acc;

  const accLower = acc.toLowerCase();
  const currLower = curr.toLowerCase();

  // 1. Exact identical match
  if (accLower === currLower) {
    return curr;
  }

  // 2. Current cycle already contains accumulated text from beginning (e.g. Chrome continuous buffer)
  if (currLower.startsWith(accLower)) {
    return curr;
  }

  // 3. Current cycle is completely contained within accumulated text
  if (accLower.includes(currLower)) {
    return acc;
  }

  // 4. Accumulated text is completely contained within current cycle
  if (currLower.includes(accLower)) {
    return curr;
  }

  // 5. Overlapping word boundary detection (e.g. acc ends with words that curr starts with)
  const accWords = acc.split(/\s+/);
  const currWords = curr.split(/\s+/);

  const maxOverlap = Math.min(accWords.length, currWords.length);
  for (let len = maxOverlap; len > 0; len--) {
    const accEnd = accWords.slice(accWords.length - len).map((w) => w.toLowerCase()).join(' ');
    const currStart = currWords.slice(0, len).map((w) => w.toLowerCase()).join(' ');
    if (accEnd === currStart) {
      const nonOverlappingCurr = currWords.slice(len).join(' ');
      return nonOverlappingCurr ? `${acc} ${nonOverlappingCurr}`.trim() : acc;
    }
  }

  return `${acc} ${curr}`.trim();
}

/**
 * Removes immediate consecutive duplicate phrases or sentences.
 * E.g. "Could I have a flat white? Could I have a flat white?" -> "Could I have a flat white?"
 */
export function deduplicateSpokenText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  const words = cleaned.split(/\s+/);
  // Check if string is two identical halves
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(' ');
    const secondHalf = words.slice(half).join(' ');
    if (firstHalf.toLowerCase().replace(/[^a-z0-9]/g, '') === secondHalf.toLowerCase().replace(/[^a-z0-9]/g, '')) {
      return firstHalf;
    }
  }

  // Check for repeated trailing multi-word chunks
  for (let n = Math.min(10, Math.floor(words.length / 2)); n >= 2; n--) {
    const endChunk = words.slice(words.length - n).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).join(' ');
    const prevChunk = words.slice(words.length - 2 * n, words.length - n).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).join(' ');
    if (endChunk && endChunk === prevChunk) {
      cleaned = words.slice(0, words.length - n).join(' ');
      break;
    }
  }

  return cleaned;
}

/**
 * Start listening with SpeechRecognition engineered for non-native ESL learners:
 * - continuous = true, interimResults = true, maxAlternatives = 3
 * - Pause-tolerant session accumulation across browser auto-stops
 * - 6-second silence timeout
 * - Captures confidence scores (< 0.80) and phonetic alternatives for pronunciation coaching
 */
export function startRecognition(
  options: RecognitionOptions | string = 'en-GB',
  legacyOnInterim?: (text: string) => void
): RecognitionHandle {
  const opts: RecognitionOptions =
    typeof options === 'string'
      ? { lang: options, onInterim: legacyOnInterim }
      : options;

  const lang = opts.lang || 'en-GB';
  const onInterim = opts.onInterim;
  const onStatusChange = opts.onStatusChange;
  const silenceTimeoutMs = opts.silenceTimeoutMs ?? 6000;
  const onSilenceTimeout = opts.onSilenceTimeout || opts.onSilenceStop;
  const onSegmentAnalysis = opts.onSegmentAnalysis;

  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;

  if (!Ctor) {
    diagnosticLogger.warn('STT', 'SpeechRecognition is not supported in this browser environment');
    onStatusChange?.('error', 'Speech recognition not supported in this browser');
    return {
      stop: async () => null,
      stopWithDetails: async () => null,
      getLatestTranscript: () => '',
      getPronunciationMetadata: () => [],
      resetSilenceTimer: () => {},
      pauseSilenceTimer: () => {},
    };
  }

  let accumulatedFinalText = '';
  let latestTranscript = '';
  let latestRawResults: any = null;
  let isStopped = false;
  let isSilenceTimerPaused = false;
  let rec: AnyRecognition = null;
  let silenceTimerId: number | null = null;
  const recordedSegments: SpokenSegmentAnalysis[] = [];

  const clearSilenceTimer = () => {
    if (silenceTimerId !== null) {
      window.clearTimeout(silenceTimerId);
      silenceTimerId = null;
    }
  };

  const scheduleSilenceTimer = (customMs?: number) => {
    clearSilenceTimer();
    if (isStopped || isSilenceTimerPaused) return;

    // Arm silence timeout (either silenceTimeoutMs or custom duration)
    const delay = customMs ?? (silenceTimeoutMs > 0 ? silenceTimeoutMs : 6000);
    if (delay > 0) {
      silenceTimerId = window.setTimeout(() => {
        if (!isStopped && !isSilenceTimerPaused) {
          console.log('[SpeechRecognition] Silence timeout reached. Auto-completing learner turn.');
          onSilenceTimeout?.();
        }
      }, delay);
    }
  };

  const isMobileDevice = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const initRecognition = () => {
    if (isStopped) return;

    try {
      rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = true;
      // On mobile devices (especially Android Chrome), continuous mode is unstable and often causes
      // SpeechRecognition to abort immediately or fail to fire onresult.
      // Non-continuous mode is rock-solid on mobile and auto-restarts seamlessly via onend.
      rec.continuous = !isMobileDevice();
      rec.maxAlternatives = 3;

      rec.onstart = () => {
        onStatusChange?.('listening', 'Microphone active');
      };

      rec.onresult = (event: any) => {
        let currentCycleText = '';
        latestRawResults = event.results;
        opts.onSpeechResults?.(event.results);

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (!item || !item[0]) continue;

          const topAlt = item[0];
          const transcript = (topAlt.transcript || '').trim();
          const confidence = typeof topAlt.confidence === 'number' ? topAlt.confidence : 1.0;

          // Capture phonetic alternatives (up to maxAlternatives = 3)
          const alternatives: string[] = [];
          for (let a = 1; a < item.length; a++) {
            const altText = item[a]?.transcript?.trim();
            if (altText && altText !== transcript && !alternatives.includes(altText)) {
              alternatives.push(altText);
            }
          }

          currentCycleText += (currentCycleText ? ' ' : '') + transcript;

          // If final result, record pronunciation metadata for the segment (< 0.75 threshold)
          if (item.isFinal && transcript) {
            const isLowConfidence = confidence > 0 && confidence < 0.75;
            const isAmbiguous = alternatives.length > 0;

            const existingIdx = recordedSegments.findIndex((s) => s.text === transcript);
            if (existingIdx >= 0) {
              recordedSegments[existingIdx] = {
                text: transcript,
                confidence,
                alternatives,
                isLowConfidence,
                isAmbiguous,
              };
            } else {
              recordedSegments.push({
                text: transcript,
                confidence,
                alternatives,
                isLowConfidence,
                isAmbiguous,
              });
            }
          }
        }

        const combined = deduplicateSpokenText(mergeTranscripts(accumulatedFinalText, currentCycleText));

        if (combined) {
          latestTranscript = combined;
          onInterim?.(combined);
          onStatusChange?.('heard', combined);
          onSegmentAnalysis?.(recordedSegments);
          scheduleSilenceTimer();
        }
      };

      rec.onerror = (event: any) => {
        const err = event?.error;
        console.warn('[SpeechRecognition] Error event:', err);

        // Benign errors: 'no-speech' happens when the user is thinking/pausing mid-sentence.
        // DO NOT stop or clear transcript on 'no-speech'
        if (err === 'no-speech') {
          return;
        }

        clearSilenceTimer();
        let errorMsg = `Speech recognition error: ${err}`;
        if (err === 'not-allowed') {
          errorMsg = 'Microphone permission denied. Please allow microphone access in your browser settings.';
        } else if (err === 'audio-capture') {
          errorMsg = 'Microphone is busy or blocked by another audio process.';
        } else if (err === 'service-not-allowed') {
          errorMsg = 'Speech recognition service is disabled or unavailable on this device.';
        } else if (err === 'network') {
          errorMsg = 'Network error connecting to speech recognition service.';
        }
        diagnosticLogger.warn('STT', `SpeechRecognition onerror: ${err}`, { errorMsg });
        onStatusChange?.('error', errorMsg);
      };

      rec.onend = () => {
        // If recognition ended without manual user stop (e.g. Chrome 3-second auto cutoff),
        // save what was accumulated so far and restart seamlessly to maintain Pause-Tolerant mode.
        if (!isStopped) {
          accumulatedFinalText = deduplicateSpokenText(latestTranscript);
          diagnosticLogger.log('STT', 'SpeechRecognition session ended, re-initializing', { accumulated: accumulatedFinalText });
          setTimeout(() => {
            if (!isStopped) initRecognition();
          }, 80);
        }
      };

      rec.start();
      scheduleSilenceTimer();
      diagnosticLogger.log('STT', 'SpeechRecognition started', { lang, continuous: rec.continuous });
    } catch (e: any) {
      diagnosticLogger.error('STT', 'Failed to start SpeechRecognition', e?.message || e);
      console.warn('[SpeechRecognition] Failed to start:', e);
      onStatusChange?.('error', e?.message || 'Failed to start');
    }
  };

  initRecognition();

  const extractLowConfidenceWords = (): WordConfidenceInfo[] => {
    const words: WordConfidenceInfo[] = [];
    const seenWords = new Set<string>();

    for (const segment of recordedSegments) {
      const segWords = segment.text.split(/\s+/).filter((w) => w.length > 1);
      for (const w of segWords) {
        const cleanWord = w.toLowerCase().replace(/[^a-z']/g, '');
        if (!cleanWord || seenWords.has(cleanWord)) continue;
        seenWords.add(cleanWord);

        // If whole segment is low confidence or has alternatives, attribute to key words
        if (segment.isLowConfidence || segment.isAmbiguous) {
          words.push({
            word: cleanWord,
            confidence: segment.confidence > 0 ? segment.confidence : 0.72,
            alternatives: segment.alternatives,
            isLowConfidence: segment.isLowConfidence,
          });
        }
      }
    }
    return words;
  };

  const extractAllWords = (): WordConfidenceInfo[] => {
    const words: WordConfidenceInfo[] = [];
    const seenWords = new Set<string>();

    for (const segment of recordedSegments) {
      const segWords = segment.text.split(/\s+/).filter((w) => w.length > 1);
      for (const w of segWords) {
        const cleanWord = w.toLowerCase().replace(/[^a-z']/g, '');
        if (!cleanWord || seenWords.has(cleanWord)) continue;
        seenWords.add(cleanWord);

        words.push({
          word: cleanWord,
          confidence: segment.confidence > 0 ? segment.confidence : 0.85,
          alternatives: segment.alternatives,
          isLowConfidence: Boolean(segment.isLowConfidence || segment.isAmbiguous),
        });
      }
    }
    return words;
  };

  const getDetails = (): RecognitionDetails => {
    const text = deduplicateSpokenText(latestTranscript.trim());
    let totalConf = 0;
    let counted = 0;

    for (const s of recordedSegments) {
      if (s.confidence > 0) {
        totalConf += s.confidence;
        counted++;
      }
    }

    const avgConfidence = counted > 0 ? totalConf / counted : 0.85;

    return {
      transcript: text,
      confidence: avgConfidence,
      segments: [...recordedSegments],
      lowConfidenceWords: extractLowConfidenceWords(),
      allWords: extractAllWords(),
      rawResults: latestRawResults,
    };
  };

  return {
    getLatestTranscript: () => deduplicateSpokenText(latestTranscript.trim()),
    getPronunciationMetadata: () => [...recordedSegments],
    resetSilenceTimer: () => {
      scheduleSilenceTimer();
    },
    pauseSilenceTimer: (paused: boolean) => {
      isSilenceTimerPaused = paused;
      if (paused) {
        clearSilenceTimer();
      } else {
        scheduleSilenceTimer();
      }
    },
    stop: async () => {
      isStopped = true;
      clearSilenceTimer();
      if (rec) {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      onStatusChange?.('stopped');

      // Allow 200ms for final audio buffers to flush
      await new Promise((r) => setTimeout(r, 200));
      return deduplicateSpokenText(latestTranscript.trim()) || null;
    },
    stopWithDetails: async () => {
      isStopped = true;
      clearSilenceTimer();
      if (rec) {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      onStatusChange?.('stopped');

      await new Promise((r) => setTimeout(r, 200));
      return getDetails();
    },
  };
}

/**
 * Intelligent pronunciation and phrase comparison for non-native English learners.
 * Handles:
 * - Curly vs straight apostrophes: "I’m" vs "I'm"
 * - Contractions expansion: "I'm" <=> "I am", "we've" <=> "we have"
 * - Punctuation stripping
 * - Partial/phonetic overlap: e.g. "unkeen" matches root "keen"
 */
export function scorePronunciation(target: string, heard: string | null): number {
  if (!heard || !heard.trim()) return 0;

  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[\u2018\u2019']/g, "'") // curly apostrophes -> straight '
      .replace(/\bi'm\b/g, 'i am')
      .replace(/\bi’m\b/g, 'i am')
      .replace(/\byou're\b/g, 'you are')
      .replace(/\bwe're\b/g, 'we are')
      .replace(/\bthey're\b/g, 'they are')
      .replace(/\bcan't\b/g, 'cannot')
      .replace(/\bwon't\b/g, 'will not')
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  };

  const targetTokens = normalize(target);
  const heardTokens = normalize(heard);

  if (targetTokens.length === 0) return 0;
  if (heardTokens.length === 0) return 0;

  let totalMatchScore = 0;

  for (const t of targetTokens) {
    // 1. Exact token match
    if (heardTokens.includes(t)) {
      totalMatchScore += 1.0;
      continue;
    }

    // 2. Substring/phonetic close match (e.g. "unkeen" contains "keen", "get" vs "getting")
    const closeHit = heardTokens.some((h) => {
      if (h.length >= 3 && t.length >= 3) {
        return h.includes(t) || t.includes(h);
      }
      return false;
    });

    if (closeHit) {
      totalMatchScore += 0.75;
    }
  }

  const score = Math.round((totalMatchScore / targetTokens.length) * 100);
  return Math.min(100, Math.max(10, score));
}

/**
 * Extracts word-level confidence scores from SpeechRecognitionResult array.
 * If any recognized word has a confidence score below 0.75, it is flagged with isLowConfidence = true.
 */
export function extractWordsFromSpeechResults(eventResults: any): WordConfidenceInfo[] {
  const words: WordConfidenceInfo[] = [];
  if (!eventResults) return words;

  for (let i = 0; i < eventResults.length; i++) {
    const item = eventResults[i];
    if (!item || !item[0]) continue;
    const topAlt = item[0];
    const transcript = (topAlt.transcript || '').trim();
    const confidence =
      typeof topAlt.confidence === 'number' && topAlt.confidence > 0
        ? topAlt.confidence
        : 0.72;

    const alternatives: string[] = [];
    for (let a = 1; a < item.length; a++) {
      const altText = item[a]?.transcript?.trim();
      if (altText && altText !== transcript && !alternatives.includes(altText)) {
        alternatives.push(altText);
      }
    }

    const isLowConfidence = confidence < 0.75;
    const tokens = transcript.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const cleanWord = token.toLowerCase().replace(/[^a-z']/g, '');
      if (!cleanWord) continue;
      words.push({
        word: cleanWord,
        confidence: Math.round(confidence * 100) / 100,
        alternatives,
        isLowConfidence,
      });
    }
  }
  return words;
}

