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
  let cleaned = raw
    // Strip <think> and reasoning XML tags
    .replace(/<(think|thought|reasoning|reflection|system|instruction|prompt)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(think|thought|reasoning|reflection|system|instruction|prompt)[^>]*>[\s\S]*$/gi, '')
    .replace(/<\/?(?:think|thought|reasoning|reflection|system|instruction|prompt|s|im_start|im_end)[^>]*>/gi, '');

  // Strip explicit Thinking Process blocks (e.g. "Thinking Process: ...")
  if (/(?:Thinking Process|Thought Process|Reasoning Process|Chain of [Tt]hought|Internal Reasoning):/i.test(cleaned)) {
    const responseMatch = cleaned.match(/(?:^|\r?\n)\s*(?:(?:Spoken )?Dialogue|(?:Final )?Spoken Reply|Spoken Response|James|Tutor):\s*([\s\S]*)$/i);
    if (responseMatch && responseMatch[1]?.trim()) {
      cleaned = responseMatch[1];
    } else {
      cleaned = cleaned.replace(/(?:Thinking Process|Thought Process|Reasoning Process|Chain of [Tt]hought|Internal Reasoning):[\s\S]*?(?=(?:\r?\n){2,}(?![*\d\s#-])[A-Z"']|$)/i, '');
    }
  }

  // Strip standalone numbered thinking steps e.g. "1. **Analyze...**"
  cleaned = cleaned.replace(/^\s*\d+\.\s+\*\*(?:Analyze|Determine|Formulate|Identify|Consider|Acknowledge|Evaluate|Draft|Check|Plan|Context|Persona)[^\n]*\*\*[\s\S]*?(?=(?:\r?\n){2,}(?![*\d\s#-])[A-Z"']|^\s*\d+\.|$)/gim, '');

  // Strip planning bullets like "* Role: James...", "* Start directly with dialogue..."
  cleaned = cleaned.replace(/^\s*[*•-]\s+\*\*(?:Role|Scenario|Last interaction|Formulate|Tone|Plan)[^\n]*\*\*[\s\S]*?(?=(?:\r?\n){2,}(?![*\d\s#-])[A-Z"']|^\s*[*•-]|$)/gim, '');
  cleaned = cleaned.replace(/^\s*[*•-]\s+(?:Role|Scenario|Last interaction|Acknowledge|Maintain|Keep it concise|Start directly with dialogue)[^\n]*\n?/gim, '');

  return cleaned
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

export const ROBOTIC_VOICE_REGEX = /george|hazel|david\s*desktop|david\b|zira|mark\s*desktop|richard|cortana|sapi/i;

/**
 * Detects legacy, offline robotic Windows SAPI voices that sound metallic and unnatural.
 */
export function isRoboticVoice(voice: SpeechSynthesisVoice | { name: string; localService?: boolean }): boolean {
  const name = voice.name;
  if (ROBOTIC_VOICE_REGEX.test(name)) return true;
  // Local Windows SAPI voice without natural/neural/enhanced indicators
  if (voice.localService && !/natural|neural|online|enhanced|premium|cloud/i.test(name)) {
    return true;
  }
  return false;
}

/**
 * Scores voices to prioritize realistic human-like Neural British voices (Ryan, Sonia, Google Cloud)
 * while heavily rejecting robotic offline SAPI voices (Microsoft George, Hazel, David).
 */
export function scoreVoice(
  voice: SpeechSynthesisVoice,
  selectedVoiceName: string | null,
  personaName?: string,
  accent?: 'UK' | 'US'
): number {
  // 1. Robotic SAPI voices get disqualifying negative score
  if (isRoboticVoice(voice)) {
    return -100000;
  }

  let score = 0;
  const name = voice.name;
  const lang = voice.lang.replace('_', '-').toLowerCase();

  // 2. User's manually selected neural voice gets top priority
  if (selectedVoiceName && name === selectedVoiceName) {
    score += 10000;
  }

  const pLower = (personaName || '').toLowerCase();
  const isFemalePersona = /emma|barista|woman|female/i.test(pLower);
  const isPatel = /patel|doctor/i.test(pLower);

  const isEdgeNatural = /natural|neural|online/i.test(name);
  const isRyan = /ryan/i.test(name) && isEdgeNatural;
  const isSonia = /sonia/i.test(name) && isEdgeNatural;
  const isLibbyMaisie = /libby|maisie/i.test(name) && isEdgeNatural;
  const isThomasOliver = /thomas|oliver/i.test(name) && isEdgeNatural;

  const isGoogleMale = /google uk english male/i.test(name);
  const isGoogleFemale = /google uk english female/i.test(name);
  const isGoogleUK = /google/i.test(name) && lang.startsWith('en-gb');
  const isAppleEnhanced = /enhanced|premium/i.test(name) && lang.startsWith('en');

  // Persona-specific neural voice matching
  if (isFemalePersona) {
    // Emma (Female Barista / Recruiter / Interlocutor): Prioritize Sonia & female neural
    if (isSonia) score += 6000;
    else if (isLibbyMaisie) score += 5500;
    else if (isGoogleFemale) score += 5200;
    else if (/female|woman|jenny|aria/i.test(name) && isEdgeNatural) score += 4500;
    else if (isRyan) score += 3200;
    else if (isGoogleMale) score += 3000;
  } else if (isPatel) {
    // Dr. Patel (Senior NHS Consultant): Prioritize Ryan / Sonia / Google UK
    if (isRyan) score += 6000;
    else if (isSonia) score += 5800;
    else if (isGoogleMale || isGoogleFemale) score += 5500;
    else if (isThomasOliver) score += 5200;
    else if (isEdgeNatural) score += 4800;
  } else {
    // James (AI British Coach): Prioritize Microsoft Ryan Online (Natural) or Google UK Male
    if (isRyan) score += 6000;
    else if (isGoogleMale) score += 5600;
    else if (isThomasOliver) score += 5200;
    else if (isSonia) score += 4500;
    else if (isGoogleFemale) score += 4200;
    else if (isEdgeNatural) score += 4000;
  }

  // Cloud Neural & Enhanced bonuses
  if (!voice.localService) score += 2000;
  if (isEdgeNatural) score += 1500;
  if (isGoogleUK) score += 1200;
  if (isAppleEnhanced) score += 1500;

  // British English accent bonus
  if (accent === 'US') {
    if (lang === 'en-us') score += 1000;
  } else {
    if (lang === 'en-gb') score += 1000;
    else if (lang.startsWith('en-gb')) score += 800;
    else if (/british|united kingdom|uk\b/i.test(name)) score += 600;
  }

  // General English fallback
  if (lang.startsWith('en')) score += 200;

  return score;
}

/**
 * Re-queries localStorage for the active TTS voice and immediately sanitizes any robotic SAPI voice.
 */
export function getSelectedTTSVoice(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY_SELECTED_VOICE);
  if (stored) {
    if (ROBOTIC_VOICE_REGEX.test(stored)) {
      console.warn(`[speechService] Sanitized robotic TTS voice preference from localStorage: ${stored}`);
      localStorage.removeItem(STORAGE_KEY_SELECTED_VOICE);
      return null;
    }
  }
  return stored;
}

export function setSelectedTTSVoice(voiceName: string): void {
  if (typeof window === 'undefined') return;
  if (voiceName) {
    if (ROBOTIC_VOICE_REGEX.test(voiceName)) {
      console.warn(`[speechService] Rejected setting robotic TTS voice: ${voiceName}`);
      return;
    }
    localStorage.setItem(STORAGE_KEY_SELECTED_VOICE, voiceName);
  } else {
    localStorage.removeItem(STORAGE_KEY_SELECTED_VOICE);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fluency_tts_voice_changed'));
  }
}

let voicesLoadedPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/**
 * Asynchronously ensures voices are loaded before synthesis to prevent silent robotic fallback.
 */
export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  const immediate = window.speechSynthesis.getVoices();
  if (immediate && immediate.length > 0) {
    return Promise.resolve(immediate);
  }

  if (voicesLoadedPromise) {
    return voicesLoadedPromise;
  }

  voicesLoadedPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let resolved = false;

    const onVoicesChanged = () => {
      if (resolved) return;
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        resolved = true;
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        voicesLoadedPromise = null;
        resolve(v);
      }
    };

    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      voicesLoadedPromise = null;
      resolve(window.speechSynthesis.getVoices() || []);
    }, 350);
  });

  return voicesLoadedPromise;
}

/**
 * Selects the absolute best neural voice for the speaking persona,
 * prioritizing Microsoft Ryan / Sonia / Google UK and never allowing robotic SAPI voices.
 */
export function selectBestVoiceForPersona(
  allVoices: SpeechSynthesisVoice[],
  personaName?: string,
  accent?: 'UK' | 'US',
  overrideVoiceName?: string
): SpeechSynthesisVoice | null {
  if (!allVoices || allVoices.length === 0) return null;

  // Explicitly re-query localStorage for persistent neural voice lock
  const selectedVoiceName = overrideVoiceName || getSelectedTTSVoice();

  const englishOnly = allVoices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('en') ||
      /british|united kingdom|english|ryan|sonia|libby|maisie|thomas|oliver|google/i.test(v.name)
  );

  const candidatePool = englishOnly.length > 0 ? englishOnly : allVoices;

  // Strictly filter out robotic SAPI voices (Microsoft George, Hazel, David)
  const nonRobotic = candidatePool.filter((v) => !isRoboticVoice(v));
  const usablePool = nonRobotic.length > 0 ? nonRobotic : candidatePool;

  const sorted = [...usablePool].sort(
    (a, b) =>
      scoreVoice(b, selectedVoiceName, personaName, accent) -
      scoreVoice(a, selectedVoiceName, personaName, accent)
  );

  return sorted[0] || null;
}

/**
 * Initializes and locks a premium neural voice into localStorage if none is set.
 */
export function ensureNeuralVoiceSelected(voices?: SpeechSynthesisVoice[]): string | null {
  if (typeof window === 'undefined') return null;
  const current = getSelectedTTSVoice();

  const allVoices =
    voices && voices.length > 0
      ? voices
      : typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis.getVoices()
      : [];

  if (allVoices.length === 0) {
    return current;
  }

  // If a valid neural voice is already set, keep it
  if (current) {
    const matched = allVoices.find((v) => v.name === current);
    if (matched && !isRoboticVoice(matched)) {
      return current;
    }
  }

  // Lock to the best British neural voice (Ryan or Sonia)
  const bestVoice = selectBestVoiceForPersona(allVoices, 'James', 'UK');
  if (bestVoice) {
    localStorage.setItem(STORAGE_KEY_SELECTED_VOICE, bestVoice.name);
    return bestVoice.name;
  }

  return null;
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
    const isRobotic = isRoboticVoice(v);
    const isNeural = !v.localService || /natural|neural|google|enhanced|premium/i.test(v.name);
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

// Background auto-initialization of voices and neural lock
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  ensureVoicesLoaded().then((voices) => {
    ensureNeuralVoiceSelected(voices);
  });
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    const v = window.speechSynthesis.getVoices();
    ensureNeuralVoiceSelected(v);
  });
}

/**
 * High-quality British Neural Voice Synthesis.
 * Automatically selects Edge/Google Online Natural voices, explicitly re-queries
 * localStorage for fluency_selected_tts_voice, strips symbols, and prevents robotic SAPI fallback.
 */
export function speakEnglish(
  rawText: string,
  options?: {
    rate?: number; // 0.92 for clear/natural, 1.0 for standard
    pitch?: number;
    accent?: 'UK' | 'US';
    voiceName?: string;
    personaName?: string;
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

  // 2. Clean the text thoroughly (no asterisks, emojis, reasoning tags, or stage directions)
  const text = cleanTextForSpeech(rawText);
  if (!text) {
    options?.onEnd?.();
    return;
  }

  const executeSynthesis = (allVoices: SpeechSynthesisVoice[]) => {
    // Explicitly re-query localStorage for persistent neural voice lock
    const selectedVoiceName = options?.voiceName || getSelectedTTSVoice();

    // Select best neural voice matched to persona and accent
    const chosenVoice = selectBestVoiceForPersona(
      allVoices,
      options?.personaName,
      options?.accent || 'UK',
      selectedVoiceName || undefined
    );

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
  };

  const immediateVoices = window.speechSynthesis.getVoices();
  if (immediateVoices && immediateVoices.length > 0) {
    executeSynthesis(immediateVoices);
  } else {
    // If voices are still loading in the browser, wait briefly for neural voices to avoid SAPI fallback
    ensureVoicesLoaded().then((loadedVoices) => {
      executeSynthesis(loadedVoices);
    });
  }
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
