// Gemini Service - Real-time Voice Roleplay & Dynamic British English Phrasing Scorecard
// Supports Multimodal Audio Capture (base64 inlineData -> gemini-2.5-flash) and Acoustic Pronunciation Analysis.

import type { AIPersona, LessonPlan, PhrasingUpgrade, PronunciationCoachingPoint } from '../types';
import type { SpokenSegmentAnalysis } from './speechRecognition';

export interface AudioAttachment {
  base64: string;
  mimeType: string;
}

export function getGeminiApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  const localKey = localStorage.getItem('gemini_api_key');
  if (localKey && localKey.trim().length > 0) {
    return localKey.trim();
  }
  return null;
}

export function isGeminiConfigured(): boolean {
  const key = getGeminiApiKey();
  return Boolean(key && key.length > 5);
}

export interface ChatMessage {
  speaker: 'ai' | 'user';
  text: string;
}

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
  acousticFeedback?: string;
}

/**
 * Powers James's live 5-turn responses in character using Gemini 2.5 Flash.
 * When userAudioClip is provided, sends the base64 audio inlineData alongside the conversation history
 * so Gemini can hear the learner's real acoustic speech, intonation, and hesitations directly.
 * Falls back to plan's authentic scripted turns if no key is configured or offline.
 */
export async function generateJamesReply(
  conversationHistory: ChatMessage[],
  scenarioTitle: string = 'Your First Day at a UK Office',
  fallbackReplies: string[] = [],
  persona?: AIPersona,
  userAudioClip?: AudioAttachment | null
): Promise<string> {
  const apiKey = getGeminiApiKey();
  const userTurnCount = conversationHistory.filter((m) => m.speaker === 'user').length;

  if (!apiKey) {
    const fallbackIdx = Math.min(userTurnCount, fallbackReplies.length - 1);
    return (
      fallbackReplies[fallbackIdx] ||
      "Brilliant! Lovely chatting with you today — let's have a look at your scorecard."
    );
  }

  const pName = persona?.name || 'James';
  const pRole = persona?.role || 'Team Lead, London';
  const pTone = persona?.tone || 'Warm, professional British manager';
  const isFinalTurn = userTurnCount >= 4;

  const systemPrompt = `You are ${pName}, ${pRole}.
Tone: ${pTone}.
Scenario: "${scenarioTitle}".
Rules:
1. Speak in authentic, natural, polite British English at a comfortable conversational pace.
2. Keep your response brief: 1 to 2 sentences max (under 30 words) so it sounds natural as spoken speech.
3. React directly to what the learner said. Listen to their audio tone, rhythm, and intonation if attached.
${isFinalTurn ? '4. This is the 5th and final turn: warmly thank them and wrap up so they can view their scorecard.' : '4. Keep the roleplay moving naturally.'}
5. Return ONLY the spoken dialogue. No quotes, formatting, or prefixes.`;

  try {
    const parts: any[] = [];

    // Multimodal Audio Attachment for Gemini 2.5 Flash
    if (userAudioClip && userAudioClip.base64 && userAudioClip.base64.length > 50) {
      parts.push({
        inlineData: {
          mimeType: userAudioClip.mimeType.split(';')[0] || 'audio/webm',
          data: userAudioClip.base64,
        },
      });
    }

    const conversationText = conversationHistory
      .map((t) => `${t.speaker === 'ai' ? pName : 'Learner'}: "${t.text}"`)
      .join('\n');

    parts.push({
      text: `${systemPrompt}\n\n${
        userAudioClip ? '[Audio recording of the learner speaking their latest line is attached above.]\n\n' : ''
      }Conversation so far:\n${conversationText}\n\nWhat do you say next as ${pName}?`,
    });

    const contents = [
      {
        role: 'user',
        parts,
      },
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 90,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini status ${response.status}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText && typeof candidateText === 'string') {
      return candidateText
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(new RegExp(`^${pName}:\\s*`, 'i'), '')
        .trim();
    }
    throw new Error('Empty candidate response');
  } catch (err) {
    console.warn('[geminiService] Live reply fallback used:', err);
    const fallbackIdx = Math.min(userTurnCount, fallbackReplies.length - 1);
    return (
      fallbackReplies[fallbackIdx] ||
      "Brilliant! Lovely chatting with you today — let's have a look at your scorecard."
    );
  }
}

/** Alias for generateJamesReply */
export const generateTutorReply = generateJamesReply;

/**
 * Dynamically generates the Stage 3 JSON Scorecard from the user's actual spoken transcript
 * and multimodal audio clips with Gemini 2.5 Flash.
 * Evaluates real accent, syllable stress, intonation, and lower-confidence phonetic segments.
 */
export async function generateGeminiScorecard(params: {
  plan: LessonPlan;
  userTurns: string[];
  phraseScores?: number[];
  defaultUpgrades?: PhrasingUpgrade[];
  audioClips?: AudioAttachment[];
  pronunciationMetadata?: SpokenSegmentAnalysis[];
}): Promise<DynamicScorecardResult | null> {
  const apiKey = getGeminiApiKey();
  const {
    plan,
    userTurns,
    phraseScores = [],
    defaultUpgrades = plan.upgrades,
    audioClips = [],
    pronunciationMetadata = [],
  } = params;

  if (!apiKey || userTurns.length === 0) {
    return null;
  }

  const avgPhraseScore = phraseScores.length
    ? Math.round(phraseScores.reduce((a, b) => a + b, 0) / phraseScores.length)
    : 86;

  // Filter segments with lower confidence (< 0.80) or phonetic alternatives
  const lowConfItems = pronunciationMetadata.filter(
    (s) => s.isLowConfidence || (s.confidence > 0 && s.confidence < 0.80) || s.alternatives.length > 0
  );

  const phoneticNotes = lowConfItems.length > 0
    ? lowConfItems
        .map(
          (s) =>
            `- Spoken phrase: "${s.text}" | Acoustic confidence: ${Math.round(
              (s.confidence || 0.72) * 100
            )}% | Phonetic alternatives heard by speech recognition: [${s.alternatives.join(', ')}]`
        )
        .join('\n')
    : 'None detected; speech recognized cleanly.';

  const prompt = `You are an expert British English language & pronunciation coach grading a student's spoken roleplay.
Scenario: "${plan.title}" (${plan.contextLabel}) with ${plan.persona.name}.
Warm-up pronunciation accuracy: ${avgPhraseScore}%.

Student's actual spoken lines:
${userTurns.map((turn, i) => `${i + 1}. "${turn}"`).join('\n')}

SpeechRecognition Acoustic Confidence & Phonetic Ambiguities (< 0.80):
${phoneticNotes}

${
  audioClips.length > 0
    ? `CRITICAL MULTIMODAL INSTRUCTION:
${audioClips.length} audio clip(s) of the learner speaking their turns are attached as inlineData.
Listen directly to their real recorded voice: evaluate their genuine British accent, syllable stress, intonation, vowel length, rhythm, and hesitation—even if the browser's speech-to-text auto-corrected their words.`
    : ''
}

Analyze their spoken language for:
1. Authentic British English usage, polite request structures, understatement, and grammar.
2. Acoustic pronunciation: syllable stress, word linking, vowel clarity, and accent coaching.

Output a JSON object conforming strictly to this schema:
{
  "overall": <number 65-98>,
  "fluency": <number 65-98>,
  "pronunciation": <number 65-98>,
  "listening": <number 65-98>,
  "acousticFeedback": "<1-2 encouraging sentences describing their intonation, syllable stress, rhythm, or accent heard in the audio>",
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

Provide 2 or 3 insightful phrasing upgrades and 1 to 3 targeted pronunciation coaching points based on their actual speech and audio.
Return strictly valid JSON only.`;

  try {
    const parts: any[] = [];

    // Attach up to 3 most recent audio clips as inlineData
    if (audioClips.length > 0) {
      const recentClips = audioClips.slice(-3);
      for (const clip of recentClips) {
        if (clip.base64 && clip.base64.length > 50) {
          parts.push({
            inlineData: {
              mimeType: clip.mimeType.split(';')[0] || 'audio/webm',
              data: clip.base64,
            },
          });
        }
      }
    }

    parts.push({ text: prompt });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini scorecard status ${response.status}`);
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    if (parsed && Array.isArray(parsed.upgrades) && parsed.upgrades.length > 0) {
      // Build dynamic coaching points from Gemini or fallback to lowConfItems
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
            feedback: `Spoken with acoustic variance. Phonetic alternatives heard: ${item.alternatives.join(', ') || 'alternative sounds'}.`,
          }));

      return {
        overall: Number(parsed.overall) || 88,
        fluency: Number(parsed.fluency) || 85,
        pronunciation: Number(parsed.pronunciation) || avgPhraseScore,
        listening: Number(parsed.listening) || 90,
        acousticFeedback:
          parsed.acousticFeedback ||
          'Your spoken rhythm is clear and natural. With a little more elongation on British long vowels, your fluency will shine even more.',
        pronunciationCoachingPoints: coachingPoints,
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
  } catch (err) {
    console.warn('[geminiService] Scorecard generation fallback:', err);
    return {
      overall: 86,
      fluency: 84,
      pronunciation: avgPhraseScore,
      listening: 88,
      acousticFeedback:
        'Great speaking practice today! Your confidence and conversational flow are developing well.',
      pronunciationCoachingPoints: lowConfItems.slice(0, 3).map((item) => ({
        wordOrPhrase: item.text,
        confidence: Math.round((item.confidence || 0.75) * 100),
        alternatives: item.alternatives,
        feedback: `Focus on clean consonant transitions. Speech recognizer heard phonetic variants: ${item.alternatives.join(', ') || 'approximate sounds'}.`,
      })),
      upgrades: defaultUpgrades.map((u) => ({
        ...u,
        moreNaturalBritish: u.moreNatural,
        fluencyTip: u.explanation,
      })),
    };
  }
}
