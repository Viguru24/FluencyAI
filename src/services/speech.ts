// Web Speech API & Neural British Voice Engine Service
// Supports Multi-Engine Neural British TTS, Microsoft Edge Online (Natural) Voices,
// Google UK Cloud Neural Voices, Markdown/Emoji Stripping, and Custom Voice Audition.

// Track active utterance and HTML audio element
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;

export const STORAGE_KEY_SELECTED_VOICE = 'fluency_selected_tts_voice';

/**
 * Strips markdown symbols, stage directions, phonetic transcriptions,
 * and emojis so James speaks clean, natural human dialogue without reading punctuation.
 */
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';
  return raw
    // Strip <think> and reasoning tags
    .replace(/<(think|thought|reasoning|reflection|system|instruction|prompt)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(think|thought|reasoning|reflection|system|instruction|prompt)[^>]*>[\s\S]*$/gi, '')
    .replace(/<\/?(?:think|thought|reasoning|reflection|system|instruction|prompt|s|im_start|im_end)[^>]*>/gi, '')
    // Strip system markers and prompt leaks
    .replace(/^(?:CRITICAL(?:\s+INSTRUCTION)?|SYSTEM(?:\s+INSTRUCTION)?|RULES?|NOTE|ROLEPLAY(?:\s+SCENARIO)?):[^\n]*\n?/gim, '')
    .replace(/^(?:Since I am playing|As an AI|As an ESL coach|In this turn|I should acknowledge|Note to self|My response:)[^\n]*\n?/gim, '')
    // Strip bracketed text: [...], (...), {...}
    .replace(/\[[\s\S]*?\]/g, '') // remove [context brackets]
    .replace(/\([\s\S]*?\)/g, '') // remove (stage directions)
    .replace(/\{[\s\S]*?\}/g, '') // remove {curly brackets}
    .replace(/\*.*?\*/g, '') // remove *stage directions* or markdown emphasis
    .replace(/\/.*?\//g, '') // remove /phonetic transcriptions/
    .replace(/[`_~#]/g, '')  // remove markdown formatting characters
    .replace(/https?:\/\/\S+/g, '') // remove URLs
    // Remove all unicode emojis
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCurrentlySpeaking(): boolean {
  return currentUtterance !== null || currentAudio !== null;
}

export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  isNeural: boolean;
  isOnline: boolean;
  isRobotic: boolean;
  score: number;
}

/**
 * Scores voices to prioritize realistic human-like Neural British voices
 * while heavily penalizing robotic offline SAPI voices like Microsoft George and Hazel.
 */
function scoreVoice(voice: SpeechSynthesisVoice, selectedVoiceName: string | null): number {
  let score = 0;
  const name = voice.name;
  const lang = voice.lang.replace('_', '-').toLowerCase();

  // 1. User's manually selected voice gets ultimate priority
  if (selectedVoiceName && name === selectedVoiceName) {
    return 10000;
  }

  // 2. Heavy penalties for robotic offline Windows SAPI voices
  if (/george/i.test(name)) return -5000; // The infamous robotic George SAPI voice
  if (/hazel/i.test(name)) return -5000; // Robotic Hazel SAPI voice
  if (/david/i.test(name) && voice.localService) return -4000;
  if (/zira/i.test(name) && voice.localService) return -4000;

  // 3. Top Tier: Microsoft Edge Neural Online British Voices
  if (/ryan/i.test(name) && /natural|neural|online/i.test(name)) score += 3000;
  if (/sonia/i.test(name) && /natural|neural|online/i.test(name)) score += 2900;
  if (/libby|maisie|thomas|oliver/i.test(name) && /natural|neural|online/i.test(name)) score += 2700;

  // 4. Second Tier: Google UK English Cloud Voices
  if (/google uk english male/i.test(name)) score += 2500;
  if (/google uk english female/i.test(name)) score += 2400;
  if (/google/i.test(name) && lang.startsWith('en-gb')) score += 2200;

  // 5. Cloud Neural bonuses
  if (!voice.localService) score += 1500; // Cloud-rendered Neural voice
  if (/natural|neural/i.test(name)) score += 1200;

  // 6. British English dialect bonus
  if (lang === 'en-gb') score += 800;
  else if (lang.startsWith('en-gb')) score += 600;
  else if (/british|united kingdom|uk\b/i.test(name)) score += 500;

  // 7. General English fallback
  if (lang.startsWith('en')) score += 100;

  // 8. Offline robotic voice penalty
  if (voice.localService && !/natural|neural/i.test(name)) {
    score -= 1000;
  }

  return score;
}

export function getSelectedTTSVoice(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_SELECTED_VOICE);
}

export function setSelectedTTSVoice(voiceName: string): void {
  if (typeof window === 'undefined') return;
  if (voiceName) {
    localStorage.setItem(STORAGE_KEY_SELECTED_VOICE, voiceName);
  } else {
    localStorage.removeItem(STORAGE_KEY_SELECTED_VOICE);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fluency_tts_voice_changed'));
  }
}

/**
 * Returns available British & English voices sorted from most natural neural to least.
 */
export function getAvailableBritishVoices(): VoiceOption[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }

  const voices = window.speechSynthesis.getVoices();
  const selected = getSelectedTTSVoice();

  const englishOnly = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('en') ||
      /british|united kingdom|english|ryan|sonia|george|hazel|google/i.test(v.name)
  );

  const scored = englishOnly.map((v) => {
    const isRobotic = /george|hazel/i.test(v.name) || (v.localService && !/natural|neural/i.test(v.name));
    const isNeural = !v.localService || /natural|neural|google/i.test(v.name);
    return {
      id: v.name,
      name: v.name,
      lang: v.lang,
      isNeural,
      isOnline: !v.localService,
      isRobotic,
      score: scoreVoice(v, selected),
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * High-quality British Neural Voice Synthesis.
 * Automatically selects Edge/Google Online Natural voices, strips symbols, and uses natural speed (0.92x).
 */
export function speakEnglish(
  rawText: string,
  options?: {
    rate?: number; // 0.92 for clear/natural, 1.0 for standard
    pitch?: number;
    accent?: 'UK' | 'US';
    voiceName?: string;
    onStart?: () => void;
    onEnd?: () => void;
  }
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    options?.onEnd?.();
    return;
  }

  // 1. Stop any current speech or audio
  stopSpeaking();

  // 2. Clean the text thoroughly (no asterisks, emojis, or stage directions)
  const text = cleanTextForSpeech(rawText);
  if (!text) {
    options?.onEnd?.();
    return;
  }

  const allVoices = window.speechSynthesis.getVoices();
  const selectedVoiceName = options?.voiceName || getSelectedTTSVoice();

  // Find best matching voice based on neural priority score
  let chosenVoice: SpeechSynthesisVoice | null = null;

  if (allVoices.length > 0) {
    const sorted = [...allVoices]
      .filter((v) => v.lang.toLowerCase().startsWith('en'))
      .sort((a, b) => scoreVoice(b, selectedVoiceName) - scoreVoice(a, selectedVoiceName));
    chosenVoice = sorted[0] || null;
  }

  // Calibrate speed: use 0.92x instead of 0.85x to avoid metallic slurred time-stretching
  const requestedRate = options?.rate ?? 0.92;
  const calibratedRate = requestedRate < 0.9 ? 0.92 : Math.min(requestedRate, 1.15);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = calibratedRate;
  utterance.pitch = options?.pitch ?? 1.0;
  utterance.lang = options?.accent === 'US' ? 'en-US' : 'en-GB';

  if (chosenVoice) {
    utterance.voice = chosenVoice;
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
    console.warn('[speechService] Synthesis error:', e);
    currentUtterance = null;
    options?.onEnd?.();
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

/**
 * Audition a specific voice with a natural British conversational phrase.
 */
export function auditionTTSVoice(
  voiceName: string,
  onStart?: () => void,
  onEnd?: () => void
) {
  const testPhrases = [
    "Right then! Splendid to meet you. Shall we grab a quick coffee and get cracking with the team?",
    "Brilliant! Lovely to chat today. That sounds spot on for our London office routine.",
  ];
  const phrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];
  speakEnglish(phrase, {
    voiceName,
    rate: 0.92,
    accent: 'UK',
    onStart,
    onEnd,
  });
}

export function stopSpeaking() {
  if (typeof window !== 'undefined') {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch {
        // ignore
      }
      currentAudio = null;
    }
    currentUtterance = null;
  }
}

// Gentle audio chimes using Web Audio API (Offline-ready, no network required)
export function playChime(type: 'success' | 'tap' | 'streak') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
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
      const notes = [523.25, 659.25, 783.99, 1046.5];
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
