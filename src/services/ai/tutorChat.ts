// Live Multi-Turn Tutor Conversation Engine
import type { AIPersona, CEFRLevel } from '../../types';
import { getLLMConfig } from '../llmConfig';
import { toast } from '../toast';
import { getGamificationState, TIERS_CONFIG, type GamificationTier } from '../../store/rewardSystem';
import {
  cleanAiReply,
  fetchFreeLLMWithFallback,
  filterTextForTTS,
  type AudioAttachment,
  type ChatMessage,
} from './aiClient';

export async function generateJamesReply(
  conversationHistory: ChatMessage[],
  scenarioTitle: string = 'Your First Day at a UK Office',
  fallbackReplies: string[] = [],
  persona?: AIPersona,
  userAudioClip?: AudioAttachment | null,
  userLevel?: CEFRLevel,
  gamificationContext?: {
    currentTier?: string;
    streakDays?: number;
    pronunciationAvg?: number;
    unlockedPerks?: string[];
  }
): Promise<string> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;
  const userTurnCount = conversationHistory.filter((m) => m.speaker === 'user').length;
  const pName = persona?.name || 'James';
  const pRole = persona?.role || 'Team Lead, London';
  const pTone = persona?.tone || 'Warm, professional British manager';

  if (!apiKey) {
    toast.warning(
      `No API Key found. ${pName} is using offline scripted replies. Open Profile & Settings to connect FreeLLMAPI or Gemini.`,
      'AI Brain in Mock Mode'
    );
    const fallbackIdx = Math.min(userTurnCount, fallbackReplies.length - 1);
    const chosenFallback =
      fallbackReplies[fallbackIdx] ||
      "Brilliant! Lovely chatting with you today — let's have a look at your scorecard.";
    return filterTextForTTS(chosenFallback, pName);
  }

  let levelInstruction = 'Speak in natural, polite British English at an intermediate B1 level.';
  if (userLevel === 'A1' || userLevel === 'A2') {
    levelInstruction = `Speak in very simple, accessible British English calibrated for a ${userLevel} CEFR learner. Use short sentences (1-2 sentences), clear high-frequency vocabulary, zero confusing idioms, and a gentle, welcoming pace.`;
  } else if (userLevel === 'B1') {
    levelInstruction = 'Speak in clear, polite British English at a B1 CEFR level (2-3 short sentences max, standard workplace vocabulary, and accessible idioms).';
  } else if (userLevel === 'B2') {
    levelInstruction = 'Speak in engaging, authentic British English at a B2 CEFR level (natural phrasal verbs, workplace idioms, and varied professional vocabulary).';
  } else if (userLevel === 'C1') {
    levelInstruction = 'Speak in sophisticated, fluent British English at a C1 CEFR level (rich authentic idioms, British understatement, clinical or business precision, and industry-specific terminology).';
  }

  const gamification = gamificationContext || getGamificationState();
  const currentTierKey = (gamification.currentTier || 'bronze') as GamificationTier;
  const tierDef = TIERS_CONFIG[currentTierKey] || TIERS_CONFIG.bronze;
  const streak = gamification.streakDays || 5;
  const pronAvg = gamification.pronunciationAvg || 88;
  const perks = gamification.unlockedPerks?.length ? gamification.unlockedPerks.join(', ') : 'Standard Practice';

  const gamificationPrompt = `LEARNER REWARD & FLUENCY PROGRESS PROFILE:
- Fluency Tier: ${tierDef.name} (${tierDef.shortName}, CEFR Benchmark: ${tierDef.cefrEquivalent})
- Daily Speaking Habit Streak: ${streak} consecutive days
- Rolling Pronunciation Accuracy Average: ${pronAvg}%
- Unlocked Capabilities: ${perks}
ROLEPLAY GUIDELINE:
You are naturally aware of the learner's commitment (${streak}-day streak, ${pronAvg}% pronunciation average, and ${tierDef.name} rank). Naturally reflect this level of fluency in your speech complexity, and occasionally offer encouraging British feedback acknowledging their dedication or clean pronunciation without breaking character or sounding repetitive.`;

  const systemPrompt = `CRITICAL INSTRUCTION: You are ${pName} (${pRole}). Tone: ${pTone}. You are participating in a live British English voice roleplay: "${scenarioTitle}".
${levelInstruction}
${gamificationPrompt}
STRICT OUTPUT RULES:
1. Output ONLY your direct spoken dialogue in character.
2. NEVER output internal thinking, reasoning steps, chain-of-thought, or analysis (such as "Thinking Process:", "1. Analyze:", or planning bullets).
3. NEVER include labels or prefixes like "${pName}:" or "Dialogue:". Start immediately with your spoken words.
4. Keep your response strictly between 1 to 3 short, natural sentences (maximum 40 words).
5. Acknowledge what the user just said with warmth or context-appropriate British professionalism, and end with a single, natural follow-up question or response to keep the simulation moving forward.`;

  try {
    if (config.provider === 'freellmapi') {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      for (let i = 0; i < conversationHistory.length; i++) {
        const msg = conversationHistory[i];
        if (i === 0 && msg.speaker === 'ai') {
          messages.push({
            role: 'user',
            content: `[Roleplay Scenario: "${scenarioTitle}". You are ${pName} (${pRole}).]`,
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

      const freeLLMModel =
        config.model && config.model !== 'auto' && config.model !== 'gemini-2.5-flash' && config.model !== 'gemini-2.0-flash'
          ? config.model
          : 'gemini-3.1-flash-lite';

      const response = await fetchFreeLLMWithFallback(
        '/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: freeLLMModel,
            messages,
            temperature: 0.75,
            max_tokens: 600,
          }),
        },
        config.baseUrl
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

        toast.error(`FreeLLMAPI Error (${response.status}): ${detailedMsg}`, 'FreeLLMAPI Router Issue');
        throw new Error(`FreeLLMAPI status ${response.status}: ${detailedMsg}`);
      }

      const data = await response.json();
      const replyText = data?.choices?.[0]?.message?.content;
      if (replyText && typeof replyText === 'string') {
        const cleaned = cleanAiReply(replyText, pName);
        if (cleaned) return cleaned;
      }
      throw new Error('FreeLLMAPI returned an empty reply');
    } else {
      const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

      for (let i = 0; i < conversationHistory.length; i++) {
        const msg = conversationHistory[i];
        const isUser = msg.speaker === 'user';
        const isLatest = i === conversationHistory.length - 1;

        if (i === 0 && !isUser) {
          contents.push({
            role: 'user',
            parts: [{ text: `[Roleplay Scenario: "${scenarioTitle}". You are ${pName} (${pRole}).]` }],
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

      const directModel = config.model && config.model !== 'auto' ? config.model : 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${directModel}:generateContent?key=${encodeURIComponent(
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
            maxOutputTokens: 600,
            ...(directModel.includes('2.5') || directModel.includes('2.0')
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
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

        toast.error(`Gemini API Error (${response.status}): ${detailedMsg}`, 'AI Brain Connection Issue');
        throw new Error(`Gemini status ${response.status}: ${detailedMsg}`);
      }

      const data = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText && typeof candidateText === 'string') {
        const cleaned = cleanAiReply(candidateText, pName);
        if (cleaned) return cleaned;
      }
      throw new Error('Gemini returned an empty reply');
    }
  } catch (err: any) {
    console.warn('[tutorChat] Live reply fallback used due to error:', err);
    if (!err?.message?.includes('status')) {
      toast.error(
        `Network / Connection Error: ${err?.message || 'Check your internet or FreeLLMAPI gateway'}`,
        'AI Request Failed'
      );
    }
    const fallbackIdx = Math.min(userTurnCount, fallbackReplies.length - 1);
    const chosenFallback =
      fallbackReplies[fallbackIdx] ||
      "Brilliant! Lovely chatting with you today — let's have a look at your scorecard.";
    return filterTextForTTS(chosenFallback, pName);
  }
}

export const generateTutorReply = generateJamesReply;
