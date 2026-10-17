import { scorePronunciation } from './speechRecognition';

export interface SpeechEvaluationResult {
  score: number;
  passed: boolean;
  normalizedTarget: string;
  normalizedSpoken: string;
}

const CONTRACTION_MAP: Record<string, string> = {
  "i'm": 'i am',
  "i'll": 'i will',
  "i've": 'i have',
  "i'd": 'i would',
  "we're": 'we are',
  "we'll": 'we will',
  "we've": 'we have',
  "you're": 'you are',
  "you'll": 'you will',
  "you've": 'you have',
  "they're": 'they are',
  "they'll": 'they will',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "couldn't": 'could not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "let's": 'let us',
};

export function normalizeSpeechText(text: string): string {
  let cleaned = text
    .toLowerCase()
    .replace(/[\u2018\u2019`]/g, "'")
    .trim();

  for (const [contraction, expanded] of Object.entries(CONTRACTION_MAP)) {
    const regex = new RegExp(`\\b${contraction}\\b`, 'g');
    cleaned = cleaned.replace(regex, expanded);
  }

  return cleaned
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Evaluates spoken transcript against target text with contraction & phonetic normalization.
 * Returns a rich result object with `score` (0-100) and `passed` (>= 75%).
 */
export function evaluateAndNormalizeSpeech(
  target: string,
  spoken: string,
  passThreshold = 75
): SpeechEvaluationResult {
  const normalizedTarget = normalizeSpeechText(target);
  const normalizedSpoken = normalizeSpeechText(spoken);

  const rawScore = scorePronunciation(target, spoken);
  const normScore = scorePronunciation(normalizedTarget, normalizedSpoken);
  const score = Math.max(rawScore, normScore);

  return {
    score,
    passed: score >= passThreshold,
    normalizedTarget,
    normalizedSpoken,
  };
}
