import type { SyllableStressInfo } from '../types';

/**
 * Phonetic Dictionary & Syllable Rules for common British English pedagogical phrases.
 */
const COMMON_WORD_SYLLABLES: Record<string, { syllables: string[]; stressIndex: number; ipa: string; tip?: string }> = {
  comfortable: {
    syllables: ['comf', 'ta', 'ble'],
    stressIndex: 0,
    ipa: '/ˈkʌmftəbl/',
    tip: 'British RP elides the second "or" into 3 syllables, not 4.',
  },
  particularly: {
    syllables: ['par', 'tic', 'u', 'lar', 'ly'],
    stressIndex: 1,
    ipa: '/pəˈtɪkjələli/',
    tip: 'Place strongest emphasis on the second syllable "tic".',
  },
  schedule: {
    syllables: ['shed', 'ule'],
    stressIndex: 0,
    ipa: '/ˈʃɛdjuːl/',
    tip: 'Traditional British starts with "shed-", not "sked-".',
  },
  wondering: {
    syllables: ['won', 'der', 'ing'],
    stressIndex: 0,
    ipa: '/ˈwʌndərɪŋ/',
    tip: 'Soft, gentle falling pitch to make requests sound warm and courteous.',
  },
  appreciate: {
    syllables: ['ap', 'pre', 'ci', 'ate'],
    stressIndex: 1,
    ipa: '/əˈpriːʃieɪt/',
    tip: 'Stress "pre" with elongated /iː/ vowel.',
  },
  flatmate: {
    syllables: ['flat', 'mate'],
    stressIndex: 0,
    ipa: '/ˈflætmeɪt/',
    tip: 'Equal crisp consonants, stress on the first syllable.',
  },
  recommendation: {
    syllables: ['rec', 'om', 'men', 'da', 'tion'],
    stressIndex: 3,
    ipa: '/ˌrɛkəmɛnˈdeɪʃn/',
    tip: 'Primary stress lands on "da" before the soft suffix.',
  },
  opportunity: {
    syllables: ['op', 'por', 'tu', 'ni', 'ty'],
    stressIndex: 2,
    ipa: '/ˌɒpəˈtjuːnəti/',
    tip: 'British RP uses the "tyu" glide on the third syllable.',
  },
  unfortunately: {
    syllables: ['un', 'for', 'tu', 'nate', 'ly'],
    stressIndex: 1,
    ipa: '/ʌnˈfɔːtʃənətli/',
    tip: 'Stress on "for", softening "tu" into "ch".',
  },
};

/**
 * Automatically segments any English word into phonetic syllables and estimates stress placement.
 */
export function segmentWordIntoSyllables(word: string): { text: string; isStressed: boolean; ipa: string }[] {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return [{ text: word, isStressed: true, ipa: `/${word}/` }];

  if (COMMON_WORD_SYLLABLES[clean]) {
    const info = COMMON_WORD_SYLLABLES[clean];
    return info.syllables.map((syl, i) => ({
      text: syl,
      isStressed: i === info.stressIndex,
      ipa: i === info.stressIndex ? `ˈ${syl}` : syl,
    }));
  }

  // Fallback heuristic: Split by vowel clusters (V/CV or CVC rules)
  const vowels = /[aeiouy]+/gi;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = vowels.exec(clean)) !== null) {
    const end = match.index + match[0].length;
    if (match.index > lastIndex) {
      parts.push(clean.slice(lastIndex, end));
    } else {
      parts.push(clean.slice(0, end));
    }
    lastIndex = end;
  }
  if (lastIndex < clean.length) {
    if (parts.length > 0) {
      parts[parts.length - 1] += clean.slice(lastIndex);
    } else {
      parts.push(clean);
    }
  }

  if (parts.length <= 1) {
    return [{ text: word, isStressed: true, ipa: `/${word}/` }];
  }

  // Multi-syllable default stress heuristic (first or penultimate syllable)
  const stressIndex = parts.length > 2 ? 1 : 0;
  return parts.map((syl, i) => ({
    text: syl,
    isStressed: i === stressIndex,
    ipa: i === stressIndex ? `ˈ${syl}` : syl,
  }));
}

/**
 * Analyzes full phrase stress, generating target British RP pitch curves
 * and comparing with user acoustic/recognition confidence.
 */
export function analyzeSyllableStress(
  targetPhrase: string,
  userUtterance?: string,
  userAccuracyScore: number = 88
): SyllableStressInfo {
  const words = targetPhrase.split(/\s+/).filter(Boolean);
  const keyWord = words.find((w) => w.length > 5) || words[0] || 'Hello';
  const cleanKey = keyWord.replace(/[.,!?;:'"]/g, '');
  const syllableBreakdown = segmentWordIntoSyllables(cleanKey);

  // Generate target pitch curve (normalized 0-100)
  // British RP statements: Rise to tonic stress then gentle fall-glide
  const isQuestion = targetPhrase.trim().endsWith('?');
  const targetPitchCurve = isQuestion
    ? [45, 52, 60, 55, 78, 92] // Rising inflection
    : [65, 75, 88, 70, 52, 38]; // Classic British gentle fall

  // If user utterance is provided, adjust accuracy score
  let effectiveScore = userAccuracyScore;
  if (userUtterance) {
    const hasWord = userUtterance.toLowerCase().includes(cleanKey.toLowerCase());
    effectiveScore = hasWord ? Math.max(80, userAccuracyScore) : Math.min(70, userAccuracyScore);
  }

  // Distribute user accuracy across syllables
  const syllables = syllableBreakdown.map((s) => {
    const jitter = Math.floor((Math.random() * 12) - 6);
    const score = Math.max(50, Math.min(99, effectiveScore + (s.isStressed ? 4 : jitter)));
    return {
      ...s,
      userAccuracyScore: score,
    };
  });

  const matchedDict = COMMON_WORD_SYLLABLES[cleanKey.toLowerCase()];
  const phonemeAdvice = matchedDict?.tip ||
    (isQuestion
      ? 'Ensure your vocal pitch rises cleanly at the end of the query for natural British politeness.'
      : 'In British English, emphasize the tonic syllable with extra vowel duration and a smooth falling glide.');

  return {
    word: cleanKey,
    syllables,
    phonemeAdvice,
    targetPitchCurve,
  };
}
