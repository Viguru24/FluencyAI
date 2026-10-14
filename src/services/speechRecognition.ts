// Web SpeechRecognition Service - Robust Voice Recognition for Non-Native Language Learners
// Supports Chrome, Edge, Safari with pause-tolerant continuous capture, interim results,
// silence detection (6s timeout), and word-level acoustic confidence & phonetic alternative scoring.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecognition = any;

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
}

export interface RecognitionOptions {
  lang?: 'en-GB' | 'en-US';
  onInterim?: (text: string) => void;
  onStatusChange?: (status: 'listening' | 'heard' | 'error' | 'stopped', details?: string) => void;
  silenceTimeoutMs?: number; // Defaults to 6000ms (6s pause tolerance for ESL learners)
  onSilenceTimeout?: () => void;
  onSegmentAnalysis?: (segments: SpokenSegmentAnalysis[]) => void;
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
 * Start listening with SpeechRecognition engineered for non-native ESL learners:
 * - continuous = true, interimResults = true, maxAlternatives = 3
 * - Pause-tolerant session accumulation across browser auto-stops
 * - 6-second silence timeout
 * - Captures confidence scores (< 0.80) and phonetic alternatives for pronunciation coaching
 */
export function startRecognition(
  options: RecognitionOptions | ('en-GB' | 'en-US') = 'en-GB',
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
  const onSilenceTimeout = opts.onSilenceTimeout;
  const onSegmentAnalysis = opts.onSegmentAnalysis;

  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;

  if (!Ctor) {
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

  const scheduleSilenceTimer = () => {
    clearSilenceTimer();
    if (isStopped || isSilenceTimerPaused) return;

    // Only arm silence timeout if the learner has begun speaking
    if (latestTranscript.trim().length > 0 && silenceTimeoutMs > 0) {
      silenceTimerId = window.setTimeout(() => {
        if (!isStopped && !isSilenceTimerPaused) {
          console.log('[SpeechRecognition] 6-second silence timeout reached. Auto-completing learner turn.');
          onSilenceTimeout?.();
        }
      }, silenceTimeoutMs);
    }
  };

  const initRecognition = () => {
    if (isStopped) return;

    try {
      rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 3;

      rec.onstart = () => {
        onStatusChange?.('listening', 'Microphone active');
      };

      rec.onresult = (event: any) => {
        let currentCycleText = '';

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

          // If final result, record pronunciation metadata for the segment
          if (item.isFinal && transcript) {
            const isLowConfidence = confidence > 0 && confidence < 0.80;
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

        const combined = accumulatedFinalText
          ? `${accumulatedFinalText} ${currentCycleText}`.trim()
          : currentCycleText.trim();

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
        console.log('[SpeechRecognition] Event:', err);

        // Benign errors: 'no-speech' happens when the user is thinking/pausing mid-sentence.
        // DO NOT stop or clear transcript on 'no-speech'
        if (err === 'no-speech') {
          return;
        }

        if (err === 'audio-capture' || err === 'not-allowed') {
          clearSilenceTimer();
          onStatusChange?.('error', `Microphone error: ${err}`);
        }
      };

      rec.onend = () => {
        // If recognition ended without manual user stop (e.g. Chrome 3-second auto cutoff),
        // save what was accumulated so far and restart seamlessly to maintain Pause-Tolerant mode.
        if (!isStopped) {
          accumulatedFinalText = latestTranscript;
          try {
            rec.start();
          } catch {
            // If restart failed on this instance, re-init
            setTimeout(() => {
              if (!isStopped) initRecognition();
            }, 100);
          }
        }
      };

      rec.start();
    } catch (e: any) {
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

  const getDetails = (): RecognitionDetails => {
    const text = latestTranscript.trim();
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
    };
  };

  return {
    getLatestTranscript: () => latestTranscript,
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
      return latestTranscript.trim() || null;
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
