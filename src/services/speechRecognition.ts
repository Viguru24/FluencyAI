// Thin wrapper around the browser SpeechRecognition API (Chrome/Edge/Safari).
// Falls back gracefully: callers get `null` when recognition is unavailable or fails,
// so the UI can use mock data and the journey still works end-to-end.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecognition = any;

export function isRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface RecognitionHandle {
  stop: () => void;
  result: Promise<string | null>;
}

/** Start listening; resolves with the final transcript (or null). Call stop() to finish early. */
export function startRecognition(
  lang: 'en-GB' | 'en-US' = 'en-GB',
  onInterim?: (text: string) => void
): RecognitionHandle {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    return { stop: () => {}, result: Promise.resolve(null) };
  }

  const rec: AnyRecognition = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  let finalText = '';
  let interimText = '';

  const result = new Promise<string | null>((resolve) => {
    rec.onresult = (event: any) => {
      interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + ' ';
        else interimText += t;
      }
      onInterim?.((finalText + interimText).trim());
    };
    rec.onerror = () => resolve((finalText + interimText).trim() || null);
    rec.onend = () => resolve((finalText + interimText).trim() || null);
  });

  try {
    rec.start();
  } catch {
    return { stop: () => {}, result: Promise.resolve(null) };
  }

  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    result,
  };
}

/** Simple similarity score (0-100) between a target phrase and what was heard. */
export function scorePronunciation(target: string, heard: string | null): number {
  if (!heard) return 0;
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
  const t = norm(target);
  const h = new Set(norm(heard));
  if (!t.length) return 0;
  const hits = t.filter((w) => h.has(w)).length;
  return Math.round(Math.min(100, (hits / t.length) * 100));
}
