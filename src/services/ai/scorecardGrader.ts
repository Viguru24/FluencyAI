// Post-Lesson Scorecard & Acoustic Pronunciation Grader
import type {
  HelpPhrase,
  LessonPlan,
  NativeLanguage,
  PhrasingUpgrade,
  PronunciationCoachingPoint,
  PronunciationFeedbackWord,
} from '../../types';
import type { SpokenSegmentAnalysis } from '../speechRecognition';
import { getLLMConfig } from '../llmConfig';
import { requestStructuredJSON, type AudioAttachment } from './aiClient';

export interface DynamicScorecardUpgrade extends PhrasingUpgrade {
  whatYouSaid: string;
  moreNaturalBritish: string;
  fluencyTip: string;
}

export interface DynamicScorecardResult {
  overall: number;
  fluency: number;
  pronunciation: number;
  listening: number;
  upgrades: DynamicScorecardUpgrade[];
  pronunciationCoachingPoints?: PronunciationCoachingPoint[];
  pronunciationFeedback?: PronunciationFeedbackWord[];
  acousticFeedback?: string;
  lowConfidenceWords?: string[];
}

export interface WrittenFollowUpPolishResult {
  polishedVersion: string;
  keyUpgradeTip: string;
}

/**
 * Instant "Polite British Polish" for Stage 3 "Write & Say" Follow-Up Challenge.
 * Uses gemini-3.1-flash-lite with a deterministic offline fallback.
 */
export async function polishWrittenFollowUp(
  scenarioTitle: string,
  userDraft: string,
  personaName: string = 'James'
): Promise<WrittenFollowUpPolishResult> {
  const cleanDraft = (userDraft || '').trim();
  const buildDeterministicFallback = (): WrittenFollowUpPolishResult => {
    if (!cleanDraft) {
      return {
        polishedVersion: `Hi ${personaName}, thanks so much for catching up earlier — I'll get those next steps sorted and keep you posted.`,
        keyUpgradeTip:
          'Uses warm British sign-offs ("catching up", "get those sorted", "keep you posted") for natural workplace rapport.',
      };
    }

    // Apply polite British workplace transformations deterministically
    let polished = cleanDraft
      .replace(/\bI want to\b/gi, "I'd love to")
      .replace(/\bplease send me\b/gi, 'could you possibly pop over')
      .replace(/\bsend me\b/gi, 'pop over')
      .replace(/\bcan you\b/gi, 'would you mind')
      .replace(/\bI will\b/gi, "I'll")
      .replace(/\bfix\b/gi, 'get that sorted');

    if (!/^(hi|hello|dear|thanks|cheers|just)/i.test(polished)) {
      polished = `Hi ${personaName}, thanks for our chat earlier — ${polished.charAt(0).toLowerCase()}${polished.slice(1)}`;
    }
    if (!/[.!?]$/.test(polished)) {
      polished += '.';
    }
    if (!/(cheers|best|thanks|posted|know)/i.test(polished) && polished.length < 180) {
      polished += ' Let me know if that sounds alright!';
    }

    return {
      polishedVersion: polished,
      keyUpgradeTip:
        'Softened direct phrasing with warm, diplomatic British workplace idioms ("thanks for our chat", "sounds alright") so your follow-up reads naturally.',
    };
  };

  const config = getLLMConfig();
  if (!config.apiKey || !cleanDraft) {
    return buildDeterministicFallback();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const prompt = `You are a British English workplace & everyday communication coach.
Scenario just completed: "${scenarioTitle}" (speaking with ${personaName}).
Learner's draft follow-up note (Slack, email, or handover message):
"${cleanDraft}"

Rewrite their draft into natural, diplomatic British workplace/everyday English (1–2 concise sentences, max 35 words) that preserves their exact meaning while sounding warm and authentic in the UK.
Also provide a 1-sentence coaching tip explaining the key tone or phrasing upgrade.

Return strictly valid JSON:
{
  "polishedVersion": "<1-2 sentence natural British English follow-up note>",
  "keyUpgradeTip": "<1 concise sentence explaining the British tone/phrasing upgrade>"
}`;

    const parsed = await requestStructuredJSON<{
      polishedVersion?: string;
      keyUpgradeTip?: string;
    }>({
      systemInstruction:
        'You are a British English communication coach (gemini-3.1-flash-lite). Return strictly valid JSON matching the schema.',
      prompt,
      temperature: 0.3,
      maxTokens: 260,
      signal: controller.signal,
    });

    if (parsed && typeof parsed.polishedVersion === 'string' && parsed.polishedVersion.trim().length > 5) {
      return {
        polishedVersion: parsed.polishedVersion.trim().replace(/^["']|["']$/g, ''),
        keyUpgradeTip:
          (parsed.keyUpgradeTip || '').trim() ||
          'Polished with natural British softening and diplomatic workplace tone.',
      };
    }
  } catch (err) {
    console.warn('[scorecardGrader] polishWrittenFollowUp fallback:', err);
  } finally {
    clearTimeout(timeoutId);
  }

  return buildDeterministicFallback();
}

/**
 * Translates a learner's native language question or phrase into 2-3 natural British English options
 * for the "How Do I Say...?" sheet, with deterministic fallback.
 */
export async function translateHowDoISay(
  nativeQuery: string,
  nativeLanguage: NativeLanguage,
  scenarioTitle: string = 'Everyday British Conversation'
): Promise<HelpPhrase[]> {
  const clean = (nativeQuery || '').trim();
  const fallbackList = (): HelpPhrase[] => [
    {
      id: `h-dyn-1-${Date.now()}`,
      keywords: [clean.toLowerCase()],
      english: 'Could you possibly run that by me one more time, please?',
      ipa: '/kʊd juː ˈpɒsəbli rʌn ðæt baɪ miː wʌn mɔː taɪm pliːz/',
      note: `Polite British way to ask someone to repeat or clarify (${nativeLanguage}: "${clean || 'Question'}")`,
    },
    {
      id: `h-dyn-2-${Date.now()}`,
      keywords: [clean.toLowerCase()],
      english: 'How does that sound to you as a next step?',
      ipa: '/haʊ dʌz ðæt saʊnd tuː juː æz ə nɛkst stɛp/',
      note: 'Warm, collaborative British phrasing to check agreement.',
    },
  ];

  const config = getLLMConfig();
  if (!config.apiKey || !clean) {
    return fallbackList();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const prompt = `The learner is in a British English roleplay ("${scenarioTitle}") and asked in ${nativeLanguage}:
"${clean}"

Provide 2 natural, polite British English ways to express this in conversation.
Return strictly valid JSON:
{
  "options": [
    {
      "english": "<natural British English phrase>",
      "ipa": "<British RP IPA transcription>",
      "note": "<short 1-sentence tip in English explaining the tone and meaning>"
    }
  ]
}`;

    const parsed = await requestStructuredJSON<{
      options?: Array<{ english?: string; ipa?: string; note?: string }>;
    }>({
      systemInstruction:
        'You are a helpful British English coach. Return strictly valid JSON with natural UK phrasing options.',
      prompt,
      temperature: 0.25,
      maxTokens: 320,
      signal: controller.signal,
    });

    if (parsed && Array.isArray(parsed.options) && parsed.options.length > 0) {
      const valid = parsed.options
        .filter((o) => typeof o.english === 'string' && o.english.trim().length > 0)
        .map((o, idx) => ({
          id: `ai-help-${Date.now()}-${idx}`,
          keywords: [clean.toLowerCase()],
          english: String(o.english).trim().replace(/^["']|["']$/g, ''),
          ipa: String(o.ipa || '/.../').trim(),
          note: String(o.note || `Natural British phrasing for "${clean}"`).trim(),
        }));
      if (valid.length > 0) return valid;
    }
  } catch (err) {
    console.warn('[scorecardGrader] translateHowDoISay fallback:', err);
  } finally {
    clearTimeout(timeoutId);
  }

  return fallbackList();
}

export async function generateGeminiScorecard(params: {
  plan: LessonPlan;
  userTurns: string[];
  phraseScores?: number[];
  defaultUpgrades?: PhrasingUpgrade[];
  audioClips?: AudioAttachment[];
  pronunciationMetadata?: SpokenSegmentAnalysis[];
  lowConfidenceWords?: string[];
}): Promise<DynamicScorecardResult | null> {
  const config = getLLMConfig();
  const {
    plan,
    userTurns,
    phraseScores = [],
    defaultUpgrades = plan.upgrades,
    audioClips = [],
    pronunciationMetadata = [],
    lowConfidenceWords = [],
  } = params;

  if (!config.apiKey || userTurns.length === 0) {
    return null;
  }

  const avgPhraseScore = phraseScores.length
    ? Math.round(phraseScores.reduce((a, b) => a + b, 0) / phraseScores.length)
    : 86;

  const lowConfItems = pronunciationMetadata.filter(
    (s) => s.isLowConfidence || (s.confidence > 0 && s.confidence < 0.75) || s.alternatives.length > 0
  );

  const phoneticNotes =
    lowConfItems.length > 0
      ? lowConfItems
          .map(
            (s) =>
              `- Spoken phrase: "${s.text}" | Acoustic confidence: ${Math.round(
                (s.confidence || 0.72) * 100
              )}% | Phonetic alternatives heard: [${s.alternatives.join(', ')}]`
          )
          .join('\n')
      : 'None detected; speech recognized cleanly.';

  const rubricSection = plan.gradingRubric
    ? `\nSPECIALIZED INDUSTRY GRADING RUBRIC:\n${plan.gradingRubric}\nGrade the user's spoken turns strictly against these industry standards.\n`
    : '';

  const prompt = `You are an expert British English language & pronunciation coach grading a student's spoken roleplay.
Scenario: "${plan.title}" (${plan.contextLabel}) with ${plan.persona.name}.
Warm-up pronunciation accuracy: ${avgPhraseScore}%.
${rubricSection}
Student's actual spoken lines:
${userTurns.map((turn, i) => `${i + 1}. "${turn}"`).join('\n')}

SpeechRecognition Acoustic Confidence & Phonetic Ambiguities (< 0.75):
${phoneticNotes}
${
  lowConfidenceWords.length > 0
    ? `Flagged browser low-confidence words (< 0.75): [${lowConfidenceWords.join(', ')}]`
    : ''
}

CRITICAL MULTIMODAL PRONUNCIATION INSTRUCTION:
Listen to the user's recorded audio clip and compare their pronunciation against natural British English phonetics. Return an overall pronunciation percentage (0–100%) and identify up to 2 specific words where their accent, vowel length, or syllable stress made the word ambiguous. Include these in the JSON scorecard under pronunciationFeedback (specifying word, issue, and a short coaching tip).

Analyze their spoken language for:
1. Authentic British English usage, polite request structures, understatement, and grammar.
2. Acoustic pronunciation: syllable stress, word linking, vowel clarity, and accent coaching.

Output a JSON object conforming strictly to this schema:
{
  "overall": <number 0-100>,
  "fluency": <number 0-100>,
  "pronunciation": <number 0-100>,
  "listening": <number 0-100>,
  "acousticFeedback": "<1-2 encouraging sentences describing their intonation, syllable stress, rhythm, or accent heard in the audio>",
  "pronunciationFeedback": [
    {
      "word": "<specific word where accent, vowel length, or syllable stress made the word ambiguous>",
      "issue": "<concise issue description: accent, vowel length, or syllable stress>",
      "tip": "<short coaching tip on natural British English phonetics>"
    }
  ],
  "pronunciationCoachingPoints": [
    {
      "wordOrPhrase": "<exact word or short phrase with lower confidence or accent challenge>",
      "confidence": <number 50-80>,
      "alternatives": ["<phonetic alternative>", "<phonetic alternative>"],
      "feedback": "<concise British pronunciation tip on mouth shape, vowel clarity, or stress>",
      "ipa": "<optional IPA transcription>"
    }
  ],
  "upgrades": [
    {
      "id": "g-up-1",
      "whatYouSaid": "<quote what user said>",
      "moreNaturalBritish": "<authentic British English phrasing>",
      "fluencyTip": "<1-2 sentence tip explaining British idiom, politeness or grammar>",
      "category": "<one of: 'Politeness' | 'Natural Idiom' | 'Grammar' | 'Fluency'>"
    }
  ]
}

Provide 2 or 3 insightful phrasing upgrades and up to 2 specific ambiguous words under pronunciationFeedback based on their actual speech and audio.
Return strictly valid JSON only.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7500);

  try {
    const parsed = await requestStructuredJSON<any>({
      systemInstruction:
        'You are an expert British English language coach. Return strictly a JSON object matching the requested schema with no commentary or markdown backticks.',
      prompt,
      temperature: 0.3,
      maxTokens: 800,
      signal: controller.signal,
      audioAttachment: audioClips.length > 0 ? audioClips[audioClips.length - 1] : undefined,
      toastOnErrorTitle: 'Scorecard Analysis Issue',
    });

    if (parsed && Array.isArray(parsed.upgrades) && parsed.upgrades.length > 0) {
      let pronunciationFeedback: PronunciationFeedbackWord[] = [];
      if (Array.isArray(parsed.pronunciationFeedback)) {
        pronunciationFeedback = parsed.pronunciationFeedback
          .slice(0, 2)
          .map((item: any) => ({
            word: String(item.word || '').replace(/^["']|["']$/g, '').trim(),
            issue: String(item.issue || 'Vowel length & syllable stress').trim(),
            tip: String(item.tip || item.coachingTip || 'Focus on British English vowel clarity and syllable stress.').trim(),
          }))
          .filter((item: PronunciationFeedbackWord) => item.word.length > 0);
      } else if (parsed.pronunciationFeedback && typeof parsed.pronunciationFeedback === 'object') {
        const wordsArr =
          parsed.pronunciationFeedback.words ||
          parsed.pronunciationFeedback.ambiguousWords ||
          [];
        if (Array.isArray(wordsArr)) {
          pronunciationFeedback = wordsArr
            .slice(0, 2)
            .map((item: any) => ({
              word: String(item.word || '').replace(/^["']|["']$/g, '').trim(),
              issue: String(item.issue || 'Vowel length & syllable stress').trim(),
              tip: String(item.tip || item.coachingTip || 'Focus on British English vowel clarity and syllable stress.').trim(),
            }))
            .filter((item: PronunciationFeedbackWord) => item.word.length > 0);
        }
      }

      if (pronunciationFeedback.length === 0 && (lowConfidenceWords.length > 0 || lowConfItems.length > 0)) {
        const wordsToUse = lowConfidenceWords.length > 0
          ? lowConfidenceWords.slice(0, 2)
          : lowConfItems.slice(0, 2).map((s) => s.text);

        pronunciationFeedback = wordsToUse.map((w) => ({
          word: w,
          issue: 'Acoustic confidence below 75% · Vowel length or syllable stress',
          tip: 'Lengthen British long vowels and soften final consonants to improve phonetic clarity.',
        }));
      }

      const coachingPoints: PronunciationCoachingPoint[] = Array.isArray(parsed.pronunciationCoachingPoints)
        ? parsed.pronunciationCoachingPoints.map((p: any) => ({
            wordOrPhrase: p.wordOrPhrase || 'Pronunciation note',
            confidence: Number(p.confidence) || 75,
            alternatives: Array.isArray(p.alternatives) ? p.alternatives : [],
            feedback: p.feedback || 'Focus on smooth vowel sounds and British syllable stress.',
            ipa: p.ipa,
          }))
        : lowConfItems.slice(0, 3).map((item) => ({
            wordOrPhrase: item.text,
            confidence: Math.round((item.confidence || 0.75) * 100),
            alternatives: item.alternatives,
            feedback: `Spoken with acoustic variance. Phonetic alternatives heard: ${
              item.alternatives.join(', ') || 'alternative sounds'
            }.`,
          }));

      return {
        overall: Math.min(100, Math.max(0, Number(parsed.overall) || 88)),
        fluency: Math.min(100, Math.max(0, Number(parsed.fluency) || 85)),
        pronunciation: Math.min(100, Math.max(0, Number(parsed.pronunciation) || avgPhraseScore)),
        listening: Math.min(100, Math.max(0, Number(parsed.listening) || 90)),
        acousticFeedback:
          parsed.acousticFeedback ||
          'Your spoken rhythm is clear and natural. With a little more elongation on British long vowels, your fluency will shine even more.',
        pronunciationFeedback,
        pronunciationCoachingPoints: coachingPoints,
        lowConfidenceWords,
        upgrades: parsed.upgrades.map((u: any, i: number) => {
          const what = u.whatYouSaid || userTurns[i] || 'Yes please';
          const more = u.moreNaturalBritish || u.moreNatural || 'Could I get that, please?';
          const tip = u.fluencyTip || u.explanation || 'British phrasing softens requests politely.';
          return {
            id: u.id || `gemini-u-${i}`,
            whatYouSaid: what,
            moreNatural: more,
            moreNaturalBritish: more,
            explanation: tip,
            fluencyTip: tip,
            category: (['Politeness', 'Natural Idiom', 'Grammar', 'Fluency'].includes(u.category)
              ? u.category
              : 'Natural Idiom') as PhrasingUpgrade['category'],
          };
        }),
      };
    }
    return null;
  } catch (err: any) {
    console.warn('[scorecardGrader] Scorecard generation fallback:', err);
    const fallbackWords = lowConfidenceWords.length > 0
      ? lowConfidenceWords.slice(0, 2)
      : lowConfItems.slice(0, 2).map((s) => s.text);

    return {
      overall: 86,
      fluency: 84,
      pronunciation: avgPhraseScore,
      listening: 88,
      acousticFeedback:
        'Great speaking practice today! Your confidence and conversational flow are developing well.',
      pronunciationFeedback: fallbackWords.map((w) => ({
        word: w,
        issue: 'Acoustic confidence below 75% · Vowel length or syllable stress',
        tip: 'Practice natural British syllable stress and vowel elongation.',
      })),
      pronunciationCoachingPoints: lowConfItems.slice(0, 3).map((item) => ({
        wordOrPhrase: item.text,
        confidence: Math.round((item.confidence || 0.75) * 100),
        alternatives: item.alternatives,
        feedback: `Focus on clean consonant transitions. Speech recognizer heard phonetic variants: ${
          item.alternatives.join(', ') || 'approximate sounds'
        }.`,
      })),
      lowConfidenceWords,
      upgrades: defaultUpgrades.map((u) => ({
        ...u,
        moreNaturalBritish: u.moreNatural,
        fluencyTip: u.explanation,
      })),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
