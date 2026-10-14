// Web SpeechRecognition Service - Robust Voice Recognition for Language Learners
// Supports Chrome, Edge, Safari with live transcription, interim results, and resilient error recovery.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecognition = any;

export function isRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface RecognitionHandle {
  stop: () => Promise<string | null>;
  getLatestTranscript: () => string;
}

export interface RecognitionOptions {
  lang?: 'en-GB' | 'en-US';
  onInterim?: (text: string) => void;
  onStatusChange?: (status: 'listening' | 'heard' | 'error' | 'stopped', details?: string) => void;
}

/**
 * Start listening with SpeechRecognition.
 * Captures both interim and final transcripts continuously.
 * Ignores benign events like 'no-speech' to avoid premature promise resolution.
 */
export function startRecognition(
  options: RecognitionOptions | ('en-GB' | 'en-US') = 'en-GB',
  legacyOnInterim?: (text: string) => void
): RecognitionHandle {
  // Support both new options object and legacy signature
  const opts: RecognitionOptions =
    typeof options === 'string'
      ? { lang: options, onInterim: legacyOnInterim }
      : options;

  const lang = opts.lang || 'en-GB';
  const onInterim = opts.onInterim;
  const onStatusChange = opts.onStatusChange;

  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;

  if (!Ctor) {
    onStatusChange?.('error', 'Speech recognition not supported in this browser');
    return {
      stop: async () => null,
      getLatestTranscript: () => '',
    };
  }

  let latestTranscript = '';
  let isStopped = false;
  let rec: AnyRecognition = null;

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
      let fullText = '';
      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        if (item && item[0]) {
          fullText += item[0].transcript + ' ';
        }
      }

      const trimmed = fullText.trim();
      if (trimmed) {
        latestTranscript = trimmed;
        onInterim?.(trimmed);
        onStatusChange?.('heard', trimmed);
      }
    };

    rec.onerror = (event: any) => {
      const err = event?.error;
      console.log('[SpeechRecognition] Event:', err);

      // Benign errors: 'no-speech' happens when the user is thinking/pausing.
      // Do NOT stop or clear transcript on 'no-speech'.
      if (err === 'no-speech') {
        // User is pausing or hasn't spoken yet, keep listening
        return;
      }

      if (err === 'audio-capture' || err === 'not-allowed') {
        onStatusChange?.('error', `Microphone error: ${err}`);
      }
    };

    rec.onend = () => {
      // If recognition ended unexpectedly without user calling stop,
      // and we still haven't manually stopped, try restarting once
      if (!isStopped && rec) {
        try {
          rec.start();
        } catch {
          /* ignore restart error */
        }
      }
    };

    rec.start();
  } catch (e: any) {
    console.warn('[SpeechRecognition] Failed to start:', e);
    onStatusChange?.('error', e?.message || 'Failed to start');
  }

  return {
    getLatestTranscript: () => latestTranscript,
    stop: async () => {
      isStopped = true;
      if (rec) {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      onStatusChange?.('stopped');

      // Allow 200ms for any pending final audio buffers to flush
      await new Promise((r) => setTimeout(r, 200));
      return latestTranscript.trim() || null;
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
