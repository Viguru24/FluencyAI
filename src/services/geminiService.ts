// Gemini Service - Real-time Voice Roleplay & Dynamic British English Phrasing Scorecard
import type { AIPersona, LessonPlan, PhrasingUpgrade } from '../types';

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
}

/**
 * Powers James's live 5-turn responses in character using Gemini 2.5 Flash.
 * Falls back to plan's authentic scripted turns if no key is configured or offline.
 */
export async function generateJamesReply(
  conversationHistory: ChatMessage[],
  scenarioTitle: string = 'Your First Day at a UK Office',
  fallbackReplies: string[] = [],
  persona?: AIPersona
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
3. React directly to what the learner said.
${isFinalTurn ? '4. This is the 5th and final turn: warmly thank them and wrap up so they can view their scorecard.' : '4. Keep the roleplay moving naturally.'}
5. Return ONLY the spoken dialogue. No quotes, formatting, or prefixes.`;

  try {
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `${systemPrompt}\n\nConversation so far:\n${conversationHistory
              .map((t) => `${t.speaker === 'ai' ? pName : 'Learner'}: "${t.text}"`)
              .join('\n')}\n\nWhat do you say next as ${pName}?`,
          },
        ],
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
 * Dynamically generates the Stage 3 JSON Scorecard (whatYouSaid, moreNaturalBritish, and fluencyTip)
 * from the user's actual spoken transcript.
 */
export async function generateGeminiScorecard(params: {
  plan: LessonPlan;
  userTurns: string[];
  phraseScores?: number[];
  defaultUpgrades?: PhrasingUpgrade[];
}): Promise<DynamicScorecardResult | null> {
  const apiKey = getGeminiApiKey();
  const { plan, userTurns, phraseScores = [], defaultUpgrades = plan.upgrades } = params;

  if (!apiKey || userTurns.length === 0) {
    return null;
  }

  const avgPhraseScore = phraseScores.length
    ? Math.round(phraseScores.reduce((a, b) => a + b, 0) / phraseScores.length)
    : 86;

  const prompt = `You are an expert British English language coach grading a student's spoken roleplay.
Scenario: "${plan.title}" (${plan.contextLabel}) with ${plan.persona.name}.
Warm-up pronunciation accuracy: ${avgPhraseScore}%.

Student's actual spoken lines:
${userTurns.map((turn, i) => `${i + 1}. "${turn}"`).join('\n')}

Analyze their speech for natural British English usage, polite request structures, understatement, and grammar.
Output a JSON object with this exact schema:
{
  "overall": <number 65-98>,
  "fluency": <number 65-98>,
  "pronunciation": <number 65-98>,
  "listening": <number 65-98>,
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

Provide 2 or 3 insightful upgrades based on their actual words.
Return strictly valid JSON only.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
      return {
        overall: Number(parsed.overall) || 88,
        fluency: Number(parsed.fluency) || 85,
        pronunciation: Number(parsed.pronunciation) || avgPhraseScore,
        listening: Number(parsed.listening) || 90,
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
      upgrades: defaultUpgrades.map((u) => ({
        ...u,
        moreNaturalBritish: u.moreNatural,
        fluencyTip: u.explanation,
      })),
    };
  }
}
