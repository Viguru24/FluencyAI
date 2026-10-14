// Gemini AI Voice & Pedagogical Grading Tutor Service
// Interacts with the Gemini API (gemini-2.5-flash) for live British English roleplay and dynamic scorecard analysis.

import type { PhrasingUpgrade } from '../types';

export const JAMES_SYSTEM_INSTRUCTION =
  'You are James, a friendly, supportive Team Lead at a London office welcoming a new colleague on their first day. Speak in natural, polite British English at a B1 CEFR level (2-3 short sentences max per turn). Never break character during the roleplay—if the user makes a grammar slip, keep the conversation flowing naturally, but silently log the mistake for the final scorecard.';

export interface ChatMessage {
  speaker: 'ai' | 'user';
  text: string;
}

export interface ScorecardAnalysisResponse {
  fluencyScore: number;
  grammarUpgrades: PhrasingUpgrade[];
  phrasesToReview: string[];
}

export function getGeminiApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  const envKey =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (import.meta as any).env?.GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  const localKey = localStorage.getItem('gemini_api_key');
  if (localKey && localKey.trim().length > 0) {
    return localKey.trim();
  }
  return null;
}

export function saveGeminiApiKey(key: string): void {
  if (key && key.trim()) {
    localStorage.setItem('gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('gemini_api_key');
  }
}

/**
 * Generate James's next spoken reply using Gemini 2.5 Flash.
 * Falls back to sensible scenario progression if API key is not configured or network fails.
 */
export async function generateTutorReply(
  conversationHistory: ChatMessage[],
  scenarioTitle: string = 'Your First Day at a UK Office',
  fallbackReplies: string[] = []
): Promise<string> {
  const apiKey = getGeminiApiKey();

  // If no API key or empty conversation, provide smooth scripted fallback
  if (!apiKey) {
    console.info('[GeminiTutor] No Gemini API key detected (set VITE_GEMINI_API_KEY). Using scenario fallback.');
    const userTurnCount = conversationHistory.filter((m) => m.speaker === 'user').length;
    const fallbackIdx = Math.min(userTurnCount, fallbackReplies.length - 1);
    return fallbackReplies[fallbackIdx] || 'Splendid! Lovely chatting with you today.';
  }

  try {
    // Map conversation turns into Gemini contents format
    // Ensure contents start with user role or wrap appropriately
    const contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];

    // Provide initial prompt context if conversation started with AI greeting
    let hasAddedPrompt = false;

    for (let i = 0; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];
      if (i === 0 && msg.speaker === 'ai') {
        contents.push({
          role: 'user',
          parts: [
            {
              text: `[Context: We are doing a workplace roleplay: "${scenarioTitle}". You begin as James by welcoming me to the office.]`,
            },
          ],
        });
        contents.push({
          role: 'model',
          parts: [{ text: msg.text }],
        });
        hasAddedPrompt = true;
      } else {
        if (contents.length === 0 && msg.speaker === 'ai') {
          contents.push({
            role: 'user',
            parts: [{ text: `[Roleplay: ${scenarioTitle}]` }],
          });
        }
        contents.push({
          role: msg.speaker === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }
    }

    if (!hasAddedPrompt && contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello James, I am ready for my first day!' }],
      });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: JAMES_SYSTEM_INSTRUCTION }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 120,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[GeminiTutor] API responded with ${response.status}:`, errText);
      throw new Error(`Gemini API error ${response.status}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText && candidateText.trim()) {
      return candidateText.trim();
    }
    throw new Error('No candidate text received from Gemini');
  } catch (err) {
    console.warn('[GeminiTutor] generateTutorReply fallback triggered:', err);
    const userTurnCount = conversationHistory.filter((m) => m.speaker === 'user').length;
    const fallbackIdx = Math.min(userTurnCount, fallbackReplies.length - 1);
    return fallbackReplies[fallbackIdx] || 'Splendid! Lovely to have you on the team — speak soon!';
  }
}

/**
 * Analyze user turns and return a structured JSON scorecard
 * (fluencyScore, grammarUpgrades, and phrasesToReview).
 */
export async function generateScorecardAnalysis(
  userTurns: string[],
  scenarioTitle: string = 'Your First Day at a UK Office',
  defaultUpgrades: PhrasingUpgrade[] = []
): Promise<ScorecardAnalysisResponse> {
  const apiKey = getGeminiApiKey();

  // If no API key or empty turns, fallback to curated upgrades
  if (!apiKey || userTurns.length === 0) {
    return {
      fluencyScore: Math.min(94, Math.max(70, 75 + userTurns.length * 3)),
      grammarUpgrades: defaultUpgrades.length > 0 ? defaultUpgrades.slice(0, 3) : [],
      phrasesToReview: [
        'Could I get… please?',
        'Would you mind walking me through it?',
        'I’m keen to hit the ground running.',
      ],
    };
  }

  const prompt = `You are an expert British English language coach evaluating an English student's real spoken roleplay turns in the scenario: "${scenarioTitle}".
The student was conversing with James, Team Lead in London.

Here are the user's actual spoken turns during the roleplay:
${userTurns.map((turn, i) => `Turn ${i + 1}: "${turn}"`).join('\n')}

Analyze their speech for naturalness, politeness, and common non-native slips (e.g. abrupt phrasing like "I want", omitting "please", "explain me", missing prepositions, or direct translations).

Return a JSON object conforming strictly to this format:
{
  "fluencyScore": <number between 50 and 98 based on coherence and effort>,
  "grammarUpgrades": [
    {
      "id": "upgrade-1",
      "whatYouSaid": "<exact or close quote of what user said>",
      "moreNatural": "<how a native Londoner/British colleague would say it>",
      "explanation": "<short supportive explanation of why this sounds more natural>",
      "category": "<one of: 'Politeness' | 'Natural Idiom' | 'Grammar' | 'Fluency'>"
    }
  ],
  "phrasesToReview": [
    "<2-4 essential natural British phrases to practice>"
  ]
}`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: 'You are a warm, encouraging British English pronunciation & phrasing coach. Always provide structured JSON without markdown formatting.',
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 800,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}`);
    }

    const data = await response.json();
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('No scorecard content from Gemini');

    // Strip markdown code block fences if present
    rawText = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(rawText);

    const fluencyScore =
      typeof parsed.fluencyScore === 'number'
        ? Math.max(50, Math.min(100, Math.round(parsed.fluencyScore)))
        : 82;

    const grammarUpgrades: PhrasingUpgrade[] = Array.isArray(parsed.grammarUpgrades)
      ? parsed.grammarUpgrades.map((u: Partial<PhrasingUpgrade>, i: number) => ({
          id: u.id || `gemini-u-${i}`,
          whatYouSaid: u.whatYouSaid || userTurns[i] || 'Example phrase',
          moreNatural: u.moreNatural || 'Natural alternative',
          explanation: u.explanation || 'Sounds more natural in British conversation.',
          category: (['Politeness', 'Natural Idiom', 'Grammar', 'Fluency'].includes(u.category as string)
            ? u.category
            : 'Fluency') as PhrasingUpgrade['category'],
        }))
      : defaultUpgrades;

    const phrasesToReview: string[] = Array.isArray(parsed.phrasesToReview)
      ? parsed.phrasesToReview
      : ['Could I get… please?', 'Would you mind walking me through it?'];

    return {
      fluencyScore,
      grammarUpgrades: grammarUpgrades.length > 0 ? grammarUpgrades : defaultUpgrades,
      phrasesToReview,
    };
  } catch (err) {
    console.warn('[GeminiTutor] Scorecard analysis error, falling back to local analysis:', err);
    return {
      fluencyScore: Math.min(94, Math.max(70, 75 + userTurns.length * 3)),
      grammarUpgrades: defaultUpgrades.length > 0 ? defaultUpgrades.slice(0, 3) : [],
      phrasesToReview: [
        'Could I get… please?',
        'Would you mind walking me through it?',
        'I’m keen to hit the ground running.',
      ],
    };
  }
}
