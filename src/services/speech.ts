// Web Speech API Voice Synthesis & Recognition Service

// Keep reference to prevent garbage collection while speaking
let currentUtterance: SpeechSynthesisUtterance | null = null;

// Preferred voices cache
let englishVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const updateVoices = () => {
    const all = window.speechSynthesis.getVoices();
    englishVoices = all.filter(v => v.lang.startsWith('en'));
  };
  updateVoices();
  window.speechSynthesis.onvoiceschanged = updateVoices;
}

export function isCurrentlySpeaking(): boolean {
  return currentUtterance !== null;
}

export function speakEnglish(
  text: string,
  options?: {
    rate?: number; // 0.75 for slow/clear, 1.0 for standard
    pitch?: number;
    accent?: 'US' | 'UK';
    onStart?: () => void;
    onEnd?: () => void;
  }
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    options?.onEnd?.();
    return;
  }

  // Stop any currently playing audio
  window.speechSynthesis.cancel();

  if (englishVoices.length === 0) {
    const all = window.speechSynthesis.getVoices();
    englishVoices = all.filter((v) => v.lang.toLowerCase().startsWith('en'));
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 0.85; // default 0.85x cadence
  utterance.pitch = options?.pitch ?? 1.0;
  utterance.lang = options?.accent === 'UK' ? 'en-GB' : 'en-US';

  // Find preferred voice (e.g. en-GB British or en-US American)
  const isUK = options?.accent === 'UK' || !options?.accent;
  const voice =
    englishVoices.find((v) => {
      const l = v.lang.replace('_', '-').toLowerCase();
      if (isUK) {
        return (
          l === 'en-gb' ||
          l.startsWith('en-gb') ||
          /british|united kingdom|uk\b|george|hazel|daniel|arthur|oliver|kate|serena/i.test(v.name)
        );
      }
      return l === 'en-us' || l.startsWith('en-us') || /united states|us\b/i.test(v.name);
    }) ||
    englishVoices.find((v) => (isUK ? v.lang.toLowerCase().includes('gb') : v.lang.toLowerCase().includes('us'))) ||
    englishVoices.find((v) => v.lang.startsWith('en')) ||
    englishVoices[0];

  if (voice) {
    utterance.voice = voice;
  }

  utterance.onstart = () => {
    currentUtterance = utterance;
    options?.onStart?.();
  };

  utterance.onend = () => {
    currentUtterance = null;
    options?.onEnd?.();
  };

  utterance.onerror = (e) => {
    console.warn('Speech error:', e);
    currentUtterance = null;
    options?.onEnd?.();
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

// Gentle audio chimes using Web Audio API (Offline-ready, no network required)
export function playChime(type: 'success' | 'tap' | 'streak') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;

    if (type === 'success') {
      // Pleasant two-tone chime (C5 -> G5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.setValueAtTime(783.99, now + 0.12); // G5

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);
    } else if (type === 'streak') {
      // Celebratory uplifting arpeggio (C5 -> E5 -> G5 -> C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.1, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.35);
      });
    } else {
      // Subtle tap sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.frequency.setValueAtTime(400, now);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch {
    // Audio context not allowed until user gesture or unsupported
  }
}

export interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
}

// Re-export speech recognition & audio recording capabilities
export * from './speechRecognition';
export * from './audioRecorder';

