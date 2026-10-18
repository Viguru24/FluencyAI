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
  silenceTimeoutMs?: number; // Post-speech silence timeout (defaults to 4500ms for ESL learners)
  initialSilenceTimeoutMs?: number; // Max wait before any speech is heard (defaults to 15000ms)
  onSilenceTimeout?: () => void;
  onSilenceStop?: () => void;
  onSegmentAnalysis?: (segments: SpokenSegmentAnalysis[]) => void;
  onSpeechResults?: (results: any) => void;
}

export interface RecognitionHandle {
  stop: () => Promise<string | null>;
  stopWithDetails: () => Promise<RecognitionDetails | null>;
  abort: () => void;
  getLatestTranscript: () => string;
  getPronunciationMetadata: () => SpokenSegmentAnalysis[];
  resetSilenceTimer: () => void;
  pauseSilenceTimer: (paused: boolean) => void;
}

/**
 * Merges accumulated transcript (from previous recognition cycle before a pause)
 * with current cycle transcript, eliminating accidental boundary duplicates without
 * ever swallowing new words that happen to appear earlier in the sentence.
 */
export function mergeTranscripts(accumulated: string, current: string): string {
  const acc = (accumulated || '').trim();
  const curr = (current || '').trim();

  if (!acc) return curr;
  if (!curr) return acc;

  const normalizeToken = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
  const accWords = acc.split(/\s+/).filter(Boolean);
  const currWords = curr.split(/\s+/).filter(Boolean);

  if (accWords.length === 0) return curr;
  if (currWords.length === 0) return acc;

  const accNorm = accWords.map(normalizeToken);
  const currNorm = currWords.map(normalizeToken);

  // 1. Exact identical word sequence
  if (accNorm.length === currNorm.length && accNorm.every((w, i) => w === currNorm[i])) {
    return curr;
  }

  // 2. Current cycle starts with all of accumulated words (e.g. cumulative buffer on mobile)
  if (
    currNorm.length > accNorm.length &&
    accNorm.every((w, i) => w === currNorm[i])
  ) {
    return curr;
  }

  // 3. Word-boundary suffix/prefix overlap (e.g. acc ends with the exact words curr starts with)
  const maxOverlap = Math.min(accWords.length, currWords.length);
  for (let len = maxOverlap; len > 0; len--) {
    let matches = true;
    for (let i = 0; i < len; i++) {
      const aWord = accNorm[accNorm.length - len + i];
      const cWord = currNorm[i];
      if (!aWord || aWord !== cWord) {
        matches = false;
        break;
      }
    }
    // Avoid merging on a single common 1-2 letter word (like "I", "a", "to") unless acc only has 1 word
    if (matches && (len >= 2 || accWords.length === 1 || accNorm[accNorm.length - 1].length >= 4)) {
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
  // Check if string is two identical halves (at least 3 words per half so "no no" or "yes yes" isn't mangled)
  if (words.length >= 6 && words.length % 2 === 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(' ');
    const secondHalf = words.slice(half).join(' ');
    if (firstHalf.toLowerCase().replace(/[^a-z0-9]/g, '') === secondHalf.toLowerCase().replace(/[^a-z0-9]/g, '')) {
      return firstHalf;
    }
  }

  // Check for repeated trailing multi-word chunks (3+ words)
  for (let n = Math.min(10, Math.floor(words.length / 2)); n >= 3; n--) {
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
 * - Separate initial wait timeout (15s) vs post-speech pause timeout (4.5s+)
 * - Waits for final audio buffer flush on stop() so the last spoken words are never cut off
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
  // Ensure post-speech silence timeout is at least 3800ms so learners are never cut off mid-sentence
  const rawSilenceMs = opts.silenceTimeoutMs ?? 4500;
  const silenceTimeoutMs = rawSilenceMs > 0 ? Math.max(3800, rawSilenceMs) : 0;
  const initialSilenceTimeoutMs = opts.initialSilenceTimeoutMs ?? 15000;
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
      abort: () => {},
      getLatestTranscript: () => '',
      getPronunciationMetadata: () => [],
      resetSilenceTimer: () => {},
      pauseSilenceTimer: () => {},
    };
  }

  let accumulatedFinalText = '';
  let latestTranscript = '';
  let peakTranscript = '';
  let bestUnfinalizedText = '';
  let lastFinalCount = 0;
  let latestRawResults: any = null;
  let isStopping = false;
  let isFinalized = false;
  let hasFatalError = false;
  let hasHeardSpeech = false;
  let isRecRunning = false;
  let isSilenceTimerPaused = false;
  let rec: AnyRecognition = null;
  let silenceTimerId: number | null = null;
  let restartTimerId: number | null = null;
  let onEndFlushResolver: (() => void) | null = null;
  let consecutiveErrors = 0;
  const recordedSegments: SpokenSegmentAnalysis[] = [];

  const clearSilenceTimer = () => {
    if (silenceTimerId !== null) {
      window.clearTimeout(silenceTimerId);
      silenceTimerId = null;
    }
  };

  const clearRestartTimer = () => {
    if (restartTimerId !== null) {
      window.clearTimeout(restartTimerId);
      restartTimerId = null;
    }
  };

  const scheduleSilenceTimer = (customMs?: number) => {
    clearSilenceTimer();
    if (isStopping || isFinalized || isSilenceTimerPaused) return;

    // Before the user has spoken any words, use initialSilenceTimeoutMs (15s) so we NEVER
    // cut them off while they are preparing to speak or while the browser speech socket connects!
    const defaultDelay = hasHeardSpeech ? silenceTimeoutMs : initialSilenceTimeoutMs;
    const delay = customMs ?? defaultDelay;

    if (delay > 0) {
      silenceTimerId = window.setTimeout(() => {
        if (!isStopping && !isFinalized && !isSilenceTimerPaused) {
          console.log(
            `[SpeechRecognition] Silence timeout reached (${delay}ms, hasHeardSpeech=${hasHeardSpeech}).`
          );
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
    if (isStopping || isFinalized || hasFatalError) return;

    try {
      rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = !isMobileDevice();
      rec.maxAlternatives = 3;
      bestUnfinalizedText = '';
      lastFinalCount = 0;

      rec.onstart = () => {
        isRecRunning = true;
        consecutiveErrors = 0;
        if (!isStopping && !isFinalized) {
          onStatusChange?.('listening', 'Microphone active');
        }
      };

      rec.onresult = (event: any) => {
        if (isFinalized) return;

        let cycleFinalText = '';
        let cycleInterimText = '';
        let finalCount = 0;
        let allFinal = true;

        latestRawResults = event.results;
        opts.onSpeechResults?.(event.results);

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (!item || !item[0]) continue;

          const topAlt = item[0];
          const transcript = (topAlt.transcript || '').trim();
          const hasValidConf = typeof topAlt.confidence === 'number' && topAlt.confidence > 0;
          const confidence = hasValidConf ? topAlt.confidence : 0.9;

          const alternatives: string[] = [];
          for (let a = 1; a < item.length; a++) {
            const altText = item[a]?.transcript?.trim();
            if (altText && altText !== transcript && !alternatives.includes(altText)) {
              alternatives.push(altText);
            }
          }

          if (item.isFinal) {
            finalCount++;
            if (transcript) {
              cycleFinalText += (cycleFinalText ? ' ' : '') + transcript;
            }
          } else {
            allFinal = false;
            if (transcript) {
              cycleInterimText += (cycleInterimText ? ' ' : '') + transcript;
            }
          }

          if (item.isFinal && transcript) {
            // Only flag low confidence when the browser actually returned a positive confidence score < 0.72
            const isLowConfidence = hasValidConf && confidence < 0.72;
            const isAmbiguous = isLowConfidence && alternatives.length > 0;

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

        // Protect unfinalized interim speech from being dropped when Chrome resets an uncommitted buffer
        if (finalCount > lastFinalCount) {
          lastFinalCount = finalCount;
          bestUnfinalizedText = cycleInterimText;
        } else if (cycleInterimText) {
          if (
            !bestUnfinalizedText ||
            cycleInterimText.length >= bestUnfinalizedText.length ||
            !bestUnfinalizedText.toLowerCase().startsWith(cycleInterimText.toLowerCase())
          ) {
            bestUnfinalizedText = cycleInterimText;
          }
        }

        const effectiveInterim = cycleInterimText || bestUnfinalizedText;
        const currentCycleText = mergeTranscripts(cycleFinalText, effectiveInterim);
        let combined = deduplicateSpokenText(mergeTranscripts(accumulatedFinalText, currentCycleText));

        // Never allow latestTranscript to shrink to a strict prefix of what was already heard in this turn
        if (
          peakTranscript &&
          combined &&
          peakTranscript.length > combined.length &&
          peakTranscript.toLowerCase().startsWith(combined.toLowerCase())
        ) {
          combined = peakTranscript;
        } else if (
          combined &&
          (!peakTranscript ||
            combined.length >= peakTranscript.length ||
            !peakTranscript.toLowerCase().startsWith(combined.toLowerCase()))
        ) {
          peakTranscript = combined;
        }

        if (combined) {
          hasHeardSpeech = true;
          latestTranscript = combined;
          onInterim?.(combined);
          if (!isStopping) {
            onStatusChange?.('heard', combined);
            onSegmentAnalysis?.(recordedSegments);
            scheduleSilenceTimer();
          } else if (allFinal && onEndFlushResolver) {
            // Final result arrived during stopAndFlush -> settle promptly
            const resolveFlush = onEndFlushResolver;
            window.setTimeout(() => {
              if (onEndFlushResolver === resolveFlush) {
                onEndFlushResolver = null;
                resolveFlush();
              }
            }, 80);
          }
        }
      };

      rec.onerror = (event: any) => {
        const err = event?.error;
        if (err === 'no-speech') {
          // Benign: user is thinking or pausing between phrases
          return;
        }
        if (err === 'aborted' && (isStopping || isFinalized)) {
          return;
        }

        console.warn('[SpeechRecognition] Error event:', err);
        consecutiveErrors++;

        if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') {
          hasFatalError = true;
          clearSilenceTimer();
          clearRestartTimer();
        } else if (consecutiveErrors >= 3) {
          hasFatalError = true;
          clearSilenceTimer();
          clearRestartTimer();
        }

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
        if (hasFatalError) {
          onStatusChange?.('error', errorMsg);
        }
      };

      rec.onend = () => {
        isRecRunning = false;

        if (onEndFlushResolver) {
          const resolveFlush = onEndFlushResolver;
          onEndFlushResolver = null;
          resolveFlush();
          return;
        }

        // If recognition ended without manual user stop (e.g. pause between sentences),
        // save what was accumulated so far and restart seamlessly.
        if (!isStopping && !isFinalized && !hasFatalError) {
          accumulatedFinalText = deduplicateSpokenText(latestTranscript);
          diagnosticLogger.log('STT', 'SpeechRecognition session ended, re-initializing', {
            accumulated: accumulatedFinalText,
          });
          clearRestartTimer();
          restartTimerId = window.setTimeout(() => {
            restartTimerId = null;
            if (!isStopping && !isFinalized && !hasFatalError) {
              initRecognition();
            }
          }, 50);
        }
      };

      rec.start();
      isRecRunning = true;
      scheduleSilenceTimer();
      diagnosticLogger.log('STT', 'SpeechRecognition started', { lang, continuous: rec.continuous });
    } catch (e: any) {
      isRecRunning = false;
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
      if (!segment.isLowConfidence) continue;
      const segWords = segment.text.split(/\s+/).filter((w) => w.length > 1);
      for (const w of segWords) {
        const cleanWord = w.toLowerCase().replace(/[^a-z']/g, '');
        if (!cleanWord || seenWords.has(cleanWord)) continue;
        seenWords.add(cleanWord);

        words.push({
          word: cleanWord,
          confidence: segment.confidence > 0 ? segment.confidence : 0.7,
          alternatives: segment.alternatives,
          isLowConfidence: true,
        });
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
          confidence: segment.confidence > 0 ? segment.confidence : 0.9,
          alternatives: segment.alternatives,
          isLowConfidence: Boolean(segment.isLowConfidence),
        });
      }
    }
    return words;
  };

  const getDetails = (): RecognitionDetails => {
    const text = deduplicateSpokenText((latestTranscript || peakTranscript).trim());
    let totalConf = 0;
    let counted = 0;

    for (const s of recordedSegments) {
      if (s.confidence > 0) {
        totalConf += s.confidence;
        counted++;
      }
    }

    const avgConfidence = counted > 0 ? totalConf / counted : 0.88;

    return {
      transcript: text,
      confidence: avgConfidence,
      segments: [...recordedSegments],
      lowConfidenceWords: extractLowConfidenceWords(),
      allWords: extractAllWords(),
      rawResults: latestRawResults,
    };
  };

  const stopAndFlush = async (): Promise<void> => {
    if (isFinalized) return;
    isStopping = true;
    clearSilenceTimer();
    clearRestartTimer();

    if (rec && isRecRunning) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          onEndFlushResolver = null;
          resolve();
        };

        onEndFlushResolver = finish;
        // If transcript was already captured live while speaking, only wait 100ms for any final syllable
        // If no speech heard yet, wait up to 450ms for pending network packet
        const hasExistingSpeech = Boolean((latestTranscript || peakTranscript).trim());
        const maxWaitMs = hasExistingSpeech ? 100 : 450;
        window.setTimeout(finish, maxWaitMs);

        try {
          rec.stop();
        } catch {
          finish();
        }
      });
    } else if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }

    isFinalized = true;
    onStatusChange?.('stopped');
  };

  return {
    getLatestTranscript: () => deduplicateSpokenText((latestTranscript || peakTranscript).trim()),
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
    abort: () => {
      isStopping = true;
      isFinalized = true;
      clearSilenceTimer();
      clearRestartTimer();
      if (onEndFlushResolver) {
        const resolveFlush = onEndFlushResolver;
        onEndFlushResolver = null;
        resolveFlush();
      }
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
      onStatusChange?.('stopped');
    },
    stop: async () => {
      await stopAndFlush();
      return deduplicateSpokenText((latestTranscript || peakTranscript).trim()) || null;
    },
    stopWithDetails: async () => {
      await stopAndFlush();
      return getDetails();
    },
  };
}

/**
 * Selects or merges the most complete transcript between browser Web Speech API
 * and multimodal AI audio transcription so partial browser fragments (e.g. "no I'd" or "rather have")
 * are upgraded to the full spoken sentence ("No, I'd rather have a Guinness.").
 */
export function chooseBestTranscript(webSpeech: string, aiSpeech: string): string {
  const web = deduplicateSpokenText((webSpeech || '').trim());
  const ai = deduplicateSpokenText((aiSpeech || '').trim());

  if (!web) return ai;
  if (!ai) return web;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9'\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

  const webWords = norm(web);
  const aiWords = norm(ai);

  if (aiWords.length === 0) return web;
  if (webWords.length === 0) return ai;

  // If AI transcript has more or equal words, check if Web Speech caught a leading word before MediaRecorder started
  if (aiWords.length >= webWords.length) {
    const aiSet = new Set(aiWords);
    const allWebWordsInAi = webWords.every((w) => aiSet.has(w));
    if (allWebWordsInAi) {
      return ai;
    }
    // If webSpeech starts with words not in aiSpeech, merge them at word boundaries
    return deduplicateSpokenText(mergeTranscripts(web, ai));
  }

  // If Web Speech has more words than AI, check if AI has trailing words that Web Speech cut off
  const webSet = new Set(webWords);
  const allAiWordsInWeb = aiWords.every((w) => webSet.has(w));
  if (allAiWordsInWeb) {
    return web;
  }

  return deduplicateSpokenText(mergeTranscripts(web, ai));
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
 * Extracts word-level confidence scores from FINALIZED SpeechRecognitionResult items.
 * Interim results (isFinal === false) always report confidence = 0 in Chrome and must be skipped
 * so normal words are never falsely flagged as <75% confidence.
 */
export function extractWordsFromSpeechResults(eventResults: any): WordConfidenceInfo[] {
  const words: WordConfidenceInfo[] = [];
  if (!eventResults) return words;

  for (let i = 0; i < eventResults.length; i++) {
    const item = eventResults[i];
    if (!item || !item[0] || !item.isFinal) continue;
    const topAlt = item[0];
    const transcript = (topAlt.transcript || '').trim();
    const hasPositiveConf = typeof topAlt.confidence === 'number' && topAlt.confidence > 0;
    const confidence = hasPositiveConf ? topAlt.confidence : 0.9;

    const alternatives: string[] = [];
    for (let a = 1; a < item.length; a++) {
      const altText = item[a]?.transcript?.trim();
      if (altText && altText !== transcript && !alternatives.includes(altText)) {
        alternatives.push(altText);
      }
    }

    const isLowConfidence = hasPositiveConf && confidence < 0.72;
    const tokens = transcript.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const cleanWord = token.toLowerCase().replace(/[^a-z']/g, '');
      if (!cleanWord || cleanWord.length <= 1) continue;
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

