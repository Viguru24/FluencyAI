import { ALL_PERSONAS, getActivePersona } from '../data/personas';

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
 * Scores voices to prioritize realistic human-like Neural British voices (Ryan, Sonia, Thomas, Emily)
 * with strict gender and regional accent matching, while penalizing robotic offline SAPI voices.
 */
export function scoreVoice(
  voice: SpeechSynthesisVoice,
  selectedVoiceName: string | null,
  personaName?: string,
  accent?: 'UK' | 'US',
  preferences?: string[],
  gender?: 'male' | 'female'
): number {
  let score = 0;
  const name = voice.name;
  const lang = voice.lang.replace('_', '-').toLowerCase();

  // 1. Robotic SAPI voices get disqualifying negative score
  if (isRoboticVoice(voice)) {
    score -= 40000;
  }

  // 2. User's manually selected neural voice gets top priority only if valid for this persona
  if (selectedVoiceName && name.toLowerCase() === selectedVoiceName.toLowerCase()) {
    score += 15000;
  }

  // Detect voice gender
  const isVoiceFemale = /(?:female|woman|sonia|libby|maisie|emily|moira|serena|kate|hazel|zira|fiona|orla|stephanie|aria|jenny|clara|victoria)/i.test(name);
  const isVoiceMale = /(?:male|man\b|ryan|thomas|george|david|daniel|mark|guy|oliver\b|connor|richard)/i.test(name);

  // Detect persona requirements
  const pLower = (personaName || '').toLowerCase();
  const isEmma = /emma|academic|literature/i.test(pLower);
  const isOliver = /oliver|ollie|tech|founder/i.test(pLower);
  const isAoife = /aoife|irish|dublin|hospitality/i.test(pLower);
  const isJames = /james|corporate|mentor|broadcaster/i.test(pLower) || (!isEmma && !isOliver && !isAoife && !/barista|sarah|maya/i.test(pLower));

  const personaIsFemale = gender === 'female' || isEmma || isAoife || /barista|woman|female|sarah|maya|recruiter/i.test(pLower);
  const personaIsMale = gender === 'male' || (!personaIsFemale && (isJames || isOliver || /david|carlos|patel|doctor|male/i.test(pLower)));

  // Strict Gender Alignment: never allow male voices for female personas and vice versa
  if (personaIsFemale) {
    if (isVoiceFemale) score += 10000;
    else if (isVoiceMale) score -= 30000;
  } else if (personaIsMale) {
    if (isVoiceMale) score += 10000;
    else if (isVoiceFemale) score -= 30000;
  }

  // Preference list matching from persona definitions
  if (preferences && preferences.length > 0) {
    for (let i = 0; i < preferences.length; i++) {
      const pref = preferences[i].toLowerCase();
      if (name.toLowerCase().includes(pref) || lang.includes(pref)) {
        score += (preferences.length - i) * 2500;
        break;
      }
    }
  }

  // Persona-specific matching
  if (isAoife) {
    // Irish female voice top priority (Emily in Edge, Moira in iOS/macOS, Orla in Windows)
    if (/emily|moira|orla|irish|ireland|dublin/i.test(name) || lang === 'en-ie') {
      score += 16000;
    } else if (/maisie|sonia|libby/i.test(name)) {
      score += 7000;
    } else if (/google.*female/i.test(name)) {
      score += 6500;
    }
  } else if (isEmma) {
    // Oxford academic British female voice (Sonia in Edge, Serena/Kate in macOS, Google Female in Chrome)
    if (/sonia/i.test(name)) {
      score += 14000;
    } else if (/libby|serena|kate/i.test(name)) {
      score += 10000;
    } else if (/google.*female/i.test(name)) {
      score += 8000;
    } else if (/hazel/i.test(name)) {
      score += 4000;
    }
  } else if (isOliver) {
    // Manchester modern tech male voice (Thomas in Edge, Oliver in macOS, Google Male in Chrome)
    if (/thomas/i.test(name)) {
      score += 14000;
    } else if (/oliver/i.test(name) && !isVoiceFemale) {
      score += 11000;
    } else if (/google.*male/i.test(name)) {
      score += 8500;
    } else if (/ryan/i.test(name)) {
      score += 5500;
    }
  } else if (isJames) {
    // London RP mentor male voice (Ryan in Edge, Daniel in macOS, Google Male in Chrome)
    if (/ryan/i.test(name)) {
      score += 14000;
    } else if (/daniel/i.test(name)) {
      score += 9000;
    } else if (/google.*male/i.test(name)) {
      score += 8500;
    } else if (/george/i.test(name)) {
      score += 3000;
    }
  }

  // Cloud Neural & Enhanced bonuses
  if (!voice.localService) score += 3000;
  if (/natural|neural|online/i.test(name)) score += 2500;
  if (/enhanced|premium/i.test(name)) score += 2000;
  if (/google/i.test(name) && lang.startsWith('en')) score += 1500;

  // Regional Accent bonus
  if (accent === 'US') {
    if (lang === 'en-us') score += 1500;
  } else {
    if (lang === 'en-gb') score += 1500;
    else if (lang === 'en-ie' && isAoife) score += 4000;
    else if (lang.startsWith('en-gb') || lang.startsWith('en-ie')) score += 1000;
    else if (/british|united kingdom|uk\b/i.test(name)) score += 800;
  }

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
 * prioritizing Microsoft Ryan / Sonia / Thomas / Emily / Google UK with strict gender fidelity.
 */
export function selectBestVoiceForPersona(
  allVoices: SpeechSynthesisVoice[],
  personaName?: string,
  accent?: 'UK' | 'US',
  overrideVoiceName?: string,
  preferences?: string[],
  gender?: 'male' | 'female'
): SpeechSynthesisVoice | null {
  if (!allVoices || allVoices.length === 0) return null;

  // 1. Direct override if caller requested a specific voice by name
  if (overrideVoiceName) {
    const directMatch = allVoices.find(
      (v) => v.name.toLowerCase() === overrideVoiceName.toLowerCase()
    );
    if (directMatch) return directMatch;
  }

  // 2. Resolve persona configuration
  const pLower = (personaName || '').toLowerCase();
  const matchedPersona =
    ALL_PERSONAS[pLower as keyof typeof ALL_PERSONAS] ||
    Object.values(ALL_PERSONAS).find(
      (p) => p.name.toLowerCase() === pLower || pLower.includes(p.name.toLowerCase())
    );

  const effectiveGender = gender || matchedPersona?.gender;
  const effectivePreferences =
    preferences && preferences.length > 0
      ? preferences
      : matchedPersona?.ttsVoicePreference;

  // Only consider global stored voice if we are synthesizing James or no persona specified
  const isJamesOrUnspecified = !personaName || /james|broadcaster|mentor/i.test(pLower);
  const selectedVoiceName = isJamesOrUnspecified ? getSelectedTTSVoice() : null;

  const englishOnly = allVoices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('en') ||
      /british|united kingdom|ireland|irish|english|ryan|sonia|libby|maisie|thomas|oliver|emily|moira|google/i.test(v.name)
  );

  const candidatePool = englishOnly.length > 0 ? englishOnly : allVoices;
  const nonRobotic = candidatePool.filter((v) => !isRoboticVoice(v));
  const usablePool = nonRobotic.length > 0 ? nonRobotic : candidatePool;

  const sorted = [...usablePool].sort(
    (a, b) =>
      scoreVoice(b, selectedVoiceName, personaName, accent, effectivePreferences, effectiveGender) -
      scoreVoice(a, selectedVoiceName, personaName, accent, effectivePreferences, effectiveGender)
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

  const activePersona = getActivePersona();
  const bestVoice = selectBestVoiceForPersona(
    allVoices,
    activePersona.name,
    activePersona.accent,
    undefined,
    activePersona.ttsVoicePreference,
    activePersona.gender
  );
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
      /british|united kingdom|ireland|english|ryan|sonia|thomas|libby|emily|george|hazel|google/i.test(v.name)
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
      score: scoreVoice(v, selected, 'James', 'UK'),
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

export interface SpeakOptions {
  rate?: number; // speech speed rate (0.80 - 1.30)
  pitch?: number; // speech pitch (0.70 - 1.45)
  accent?: 'UK' | 'US';
  voiceName?: string;
  personaName?: string;
  gender?: 'male' | 'female';
  voicePreferences?: string[];
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * High-quality British & Regional Neural Voice Synthesis.
 * Automatically selects Edge/Google Online Natural voices matched to persona identity,
 * cadence, and gender.
 */
export function speakEnglish(
  rawText: string,
  options?: SpeakOptions
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
    // Resolve target persona (fallback to active coach if not specified)
    const activePersona = getActivePersona();
    const pLower = (options?.personaName || activePersona.name).toLowerCase();
    const matchedPersona =
      ALL_PERSONAS[pLower as keyof typeof ALL_PERSONAS] ||
      Object.values(ALL_PERSONAS).find(
        (p) => p.name.toLowerCase() === pLower || pLower.includes(p.name.toLowerCase())
      ) ||
      activePersona;

    const personaName = options?.personaName || matchedPersona.name;
    const accent = options?.accent || matchedPersona.accent || 'UK';
    const preferences = options?.voicePreferences || matchedPersona.ttsVoicePreference;
    const gender = options?.gender || matchedPersona.gender;

    // Select best voice matched to persona identity
    const chosenVoice = selectBestVoiceForPersona(
      allVoices,
      personaName,
      accent,
      options?.voiceName,
      preferences,
      gender
    );

    // Speed & pitch calibration: respect persona-specific pitch & rate calibrations
    const baseRate = options?.rate ?? matchedPersona.rate ?? 0.94;
    const calibratedRate = Math.max(0.80, Math.min(baseRate, 1.30));

    const basePitch = options?.pitch ?? matchedPersona.pitch ?? 1.0;
    const calibratedPitch = Math.max(0.70, Math.min(basePitch, 1.45));

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = calibratedRate;
    utterance.pitch = calibratedPitch;
    utterance.lang = accent === 'US' ? 'en-US' : (chosenVoice?.lang || 'en-GB');

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

// Shared Web Audio API context for zero-latency, click-free silky sound synthesis
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Silky, studio-grade audio chimes using Web Audio API (Offline-ready, zero network latency)
export function playChime(type: 'success' | 'tap' | 'streak' | 'micStart' | 'micStop') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'micStart') {
      // Silky ascending harmonic bloom (warm fifth/ninth shimmer: F4 -> C5 -> G5)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.22);
      filter.connect(ctx.destination);

      const partials = [
        { freqStart: 440, freqEnd: 587.33, delay: 0, dur: 0.28, amp: 0.09, wave: 'sine' as OscillatorType },
        { freqStart: 659.25, freqEnd: 880, delay: 0.035, dur: 0.32, amp: 0.065, wave: 'sine' as OscillatorType },
        { freqStart: 880, freqEnd: 1174.66, delay: 0.06, dur: 0.34, amp: 0.03, wave: 'triangle' as OscillatorType },
      ];

      partials.forEach(({ freqStart, freqEnd, delay, dur, amp, wave }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freqStart, now + delay);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + delay + 0.14);

        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.linearRampToValueAtTime(amp, now + delay + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);

        osc.connect(gain);
        gain.connect(filter);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.02);
      });
    } else if (type === 'micStop') {
      // Silky warm resolving cadence (gentle descending harmonic settle)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.exponentialRampToValueAtTime(1100, now + 0.24);
      filter.connect(ctx.destination);

      const partials = [
        { freqStart: 783.99, freqEnd: 523.25, delay: 0, dur: 0.24, amp: 0.08, wave: 'sine' as OscillatorType },
        { freqStart: 1174.66, freqEnd: 783.99, delay: 0.025, dur: 0.26, amp: 0.045, wave: 'sine' as OscillatorType },
      ];

      partials.forEach(({ freqStart, freqEnd, delay, dur, amp, wave }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freqStart, now + delay);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + delay + 0.13);

        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.linearRampToValueAtTime(amp, now + delay + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);

        osc.connect(gain);
        gain.connect(filter);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.02);
      });
    } else if (type === 'success') {
      // Pleasant warm two-tone harmonic chime (C5 -> G5)
      const notes = [
        { freq: 523.25, delay: 0, dur: 0.32, amp: 0.09 },
        { freq: 783.99, delay: 0.09, dur: 0.48, amp: 0.1 },
      ];
      notes.forEach(({ freq, delay, dur, amp }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.linearRampToValueAtTime(amp, now + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.02);
      });
    } else if (type === 'streak') {
      // Celebratory uplifting arpeggio (C5 -> E5 -> G5 -> C6)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * 0.075;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.085, start + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.36);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.38);
      });
    } else {
      // Soft, tactile glass droplet tap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.065);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
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
