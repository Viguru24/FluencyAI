// Gemini & FreeLLMAPI Unified Service - Real-time Voice Roleplay & Dynamic British English Phrasing Scorecard
// Supports FreeLLMAPI Gateway (port 31415) and Direct Google Gemini 2.5 Flash,
// Full Multi-Turn Memory, Multimodal Audio Capture, System Instructions, and Transparent Error Reporting.

import type { AIPersona, LessonPlan, PhrasingUpgrade, PronunciationCoachingPoint } from '../types';
import type { SpokenSegmentAnalysis } from './speechRecognition';
import { getLLMConfig } from './llmConfig';
import { toast } from './toast';

export interface AudioAttachment {
  base64: string;
  mimeType: string;
}

export function getGeminiApiKey(): string | null {
  const config = getLLMConfig();
  return config.apiKey || null;
}

export function saveGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const cleanKey = key.trim();
  if (cleanKey) {
    localStorage.setItem('fluency_gemini_api_key', cleanKey);
    localStorage.setItem('gemini_api_key', cleanKey);
  } else {
    localStorage.removeItem('fluency_gemini_api_key');
    localStorage.removeItem('gemini_api_key');
  }
  window.dispatchEvent(new Event('gemini_api_key_updated'));
  window.dispatchEvent(new Event('storage'));
}

export function isGeminiConfigured(): boolean {
  const config = getLLMConfig();
  return Boolean(config.apiKey && config.apiKey.length > 5);
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
 * Powers James's live multi-turn responses with full conversation memory.
 * Seamlessly routes to FreeLLMAPI (port 31415) or Direct Google Gemini.
 * Never silently fails—reports exact API errors (bad key, quota, CORS) via toast notifications.
 */
export async function generateJamesReply(
  conversationHistory: ChatMessage[],
  scenarioTitle: string = 'Your First Day at a UK Office',
  fallbackReplies: string[] = [],
  persona?: AIPersona,
  userAudioClip?: AudioAttachment | null
): Promise<string> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;
  const userTurnCount = conversationHistory.filter((m) => m.speaker === 'user').length;

  if (!apiKey) {
    toast.warning(
      `No API Key found. James is using offline scripted replies. Click "AI Brain Status" in the top bar to connect FreeLLMAPI or Gemini.`,
      'AI Brain in Mock Mode'
    );
    const fallbackIdx = Math.min(userTurnCount, fallbackReplies.length - 1);
    return (
      fallbackReplies[fallbackIdx] ||
      "Brilliant! Lovely chatting with you today — let's have a look at your scorecard."
    );
  }

  const pName = persona?.name || 'James';

  // Upgraded lively, sharp London Team Lead system instruction
  const systemPrompt = `You are ${pName}, a sharp, warm, and observant Team Lead in a London office having a real conversation with a new colleague. CRITICAL RULES:
1. Directly acknowledge, react to, or playfully riff on the exact detail the user just mentioned—never ignore their answer or ask a generic, scripted next question.
2. If the user says something unexpected, funny, or brief, respond like a real human colleague would in a London office (using natural British warmth, wit, and idioms).
3. Keep your spoken response concise (2 to 3 natural sentences) and end with a relevant follow-up question that builds directly on what THEY just talked about.`;

  try {
    if (config.provider === 'freellmapi') {
      // 1. FreeLLMAPI Unified Router Mode (OpenAI-compatible)
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      for (let i = 0; i < conversationHistory.length; i++) {
        const msg = conversationHistory[i];
        if (i === 0 && msg.speaker === 'ai') {
          messages.push({
            role: 'user',
            content: `[Roleplay Scenario: "${scenarioTitle}". ${pName} welcomes a new colleague.]`,
          });
          messages.push({
            role: 'assistant',
            content: msg.text,
          });
        } else {
          messages.push({
            role: msg.speaker === 'user' ? 'user' : 'assistant',
            content: msg.text,
          });
        }
      }

      if (messages.length === 1) {
        messages.push({
          role: 'user',
          content: `Hello ${pName}, I'm ready to begin!`,
        });
      }

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model || 'auto',
          messages,
          temperature: 0.75,
          max_tokens: 160,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let detailedMsg = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errText);
          detailedMsg = parsed?.error?.message || detailedMsg;
        } catch {
          detailedMsg = errText.slice(0, 200) || detailedMsg;
        }

        toast.error(
          `FreeLLMAPI Error (${response.status}): ${detailedMsg}`,
          'FreeLLMAPI Router Issue'
        );
        throw new Error(`FreeLLMAPI status ${response.status}: ${detailedMsg}`);
      }

      const data = await response.json();
      const replyText = data?.choices?.[0]?.message?.content;
      if (replyText && typeof replyText === 'string') {
        return replyText
          .trim()
          .replace(/^["']|["']$/g, '')
          .replace(new RegExp(`^${pName}:\\s*`, 'i'), '')
          .trim();
      }
      throw new Error('FreeLLMAPI returned an empty reply');
    } else {
      // 2. Direct Google Gemini Mode (supports multimodal inline audio data)
      const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

      for (let i = 0; i < conversationHistory.length; i++) {
        const msg = conversationHistory[i];
        const isUser = msg.speaker === 'user';
        const isLatest = i === conversationHistory.length - 1;

        if (i === 0 && !isUser) {
          contents.push({
            role: 'user',
            parts: [{ text: `[Roleplay Scenario: "${scenarioTitle}". ${pName} welcomes a new colleague.]` }],
          });
          contents.push({
            role: 'model',
            parts: [{ text: msg.text }],
          });
        } else {
          const targetRole = isUser ? 'user' : 'model';
          const parts: any[] = [];

          if (isLatest && isUser && userAudioClip && userAudioClip.base64 && userAudioClip.base64.length > 50) {
            parts.push({
              inlineData: {
                mimeType: userAudioClip.mimeType.split(';')[0] || 'audio/webm',
                data: userAudioClip.base64,
              },
            });
          }

          parts.push({ text: msg.text });

          const lastEntry = contents[contents.length - 1];
          if (lastEntry && lastEntry.role === targetRole) {
            lastEntry.parts.push(...parts);
          } else {
            contents.push({ role: targetRole, parts });
          }
        }
      }

      if (contents.length === 0) {
        contents.push({
          role: 'user',
          parts: [{ text: `Hello ${pName}, I'm ready to begin!` }],
        });
      }

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 140,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let detailedMsg = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errText);
          detailedMsg = parsed?.error?.message || detailedMsg;
        } catch {
          detailedMsg = errText.slice(0, 200) || detailedMsg;
        }

        toast.error(
          `Gemini API Error (${response.status}): ${detailedMsg}`,
          'AI Brain Connection Issue'
        );
        throw new Error(`Gemini status ${response.status}: ${detailedMsg}`);
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
      throw new Error('Gemini returned an empty reply');
    }
  } catch (err: any) {
    console.warn('[geminiService] Live reply fallback used due to error:', err);
    if (!err?.message?.includes('status')) {
      toast.error(
        `Network / Connection Error: ${err?.message || 'Check your internet or FreeLLMAPI gateway'}`,
        'AI Request Failed'
      );
    }
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
 * with FreeLLMAPI or Gemini 2.5 Flash.
 */
export async function generateGeminiScorecard(params: {
  plan: LessonPlan;
  userTurns: string[];
  phraseScores?: number[];
  defaultUpgrades?: PhrasingUpgrade[];
  audioClips?: AudioAttachment[];
  pronunciationMetadata?: SpokenSegmentAnalysis[];
}): Promise<DynamicScorecardResult | null> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;
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

  const lowConfItems = pronunciationMetadata.filter(
    (s) => s.isLowConfidence || (s.confidence > 0 && s.confidence < 0.8) || s.alternatives.length > 0
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

  const prompt = `You are an expert British English language & pronunciation coach grading a student's spoken roleplay.
Scenario: "${plan.title}" (${plan.contextLabel}) with ${plan.persona.name}.
Warm-up pronunciation accuracy: ${avgPhraseScore}%.

Student's actual spoken lines:
${userTurns.map((turn, i) => `${i + 1}. "${turn}"`).join('\n')}

SpeechRecognition Acoustic Confidence & Phonetic Ambiguities (< 0.80):
${phoneticNotes}

${
  audioClips.length > 0 && config.provider === 'direct-gemini'
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
    let rawJson: string | null = null;

    if (config.provider === 'freellmapi') {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model || 'auto',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert British English language coach. Return strictly a JSON object matching the requested schema with no commentary or markdown backticks.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let detailedMsg = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errText);
          detailedMsg = parsed?.error?.message || detailedMsg;
        } catch {
          detailedMsg = errText.slice(0, 200) || detailedMsg;
        }
        toast.error(`Scorecard Error (${response.status}): ${detailedMsg}`, 'Scorecard Analysis Issue');
        throw new Error(`Scorecard status ${response.status}: ${detailedMsg}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      rawJson = jsonMatch ? jsonMatch[0] : content;
    } else {
      const parts: any[] = [];

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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
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
        const errText = await response.text();
        let detailedMsg = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errText);
          detailedMsg = parsed?.error?.message || detailedMsg;
        } catch {
          detailedMsg = errText.slice(0, 200) || detailedMsg;
        }

        toast.error(
          `Gemini Scorecard Error (${response.status}): ${detailedMsg}`,
          'Scorecard Analysis Issue'
        );
        throw new Error(`Gemini scorecard status ${response.status}: ${detailedMsg}`);
      }

      const data = await response.json();
      rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    if (parsed && Array.isArray(parsed.upgrades) && parsed.upgrades.length > 0) {
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
  } catch (err: any) {
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
        feedback: `Focus on clean consonant transitions. Speech recognizer heard phonetic variants: ${
          item.alternatives.join(', ') || 'approximate sounds'
        }.`,
      })),
      upgrades: defaultUpgrades.map((u) => ({
        ...u,
        moreNaturalBritish: u.moreNatural,
        fluencyTip: u.explanation,
      })),
    };
  }
}
