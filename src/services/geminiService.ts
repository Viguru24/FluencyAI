// Gemini & FreeLLMAPI Unified Service - Real-time Voice Roleplay & Dynamic British English Phrasing Scorecard
// Supports FreeLLMAPI Gateway (port 31415) and Direct Google Gemini 2.5 Flash,
// Full Multi-Turn Memory, Multimodal Audio Capture, System Instructions, and Transparent Error Reporting.

import type { AIPersona, CEFRLevel, LessonPlan, PhrasingUpgrade, PlacementAssessmentResult, PronunciationCoachingPoint, PronunciationFeedbackWord } from '../types';
import type { SpokenSegmentAnalysis } from './speechRecognition';
import { getCandidateGatewayUrls, getLLMConfig } from './llmConfig';
import { toast } from './toast';

/**
 * Resiliently fetches FreeLLMAPI gateway endpoints.
 * Automatically fails over to the Vite same-origin proxy if direct loopback
 * connections are blocked by browser Cross-Origin-Resource-Policy (CORP) or Private Network Access (PNA).
 */
async function fetchFreeLLMWithFallback(
  path: string,
  init: RequestInit,
  primaryBase?: string
): Promise<Response> {
  const candidates = getCandidateGatewayUrls(primaryBase);
  let lastError: unknown = null;
  let lastRes: Response | null = null;
  for (const base of candidates) {
    try {
      const url = `${base}${path.startsWith('/') ? path : '/' + path}`;
      const res = await fetch(url, init);
      if (res.ok || res.status === 401 || res.status === 403) {
        return res;
      }
      lastRes = res;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastRes) return lastRes;
  throw lastError || new Error('Failed to connect to FreeLLMAPI gateway');
}

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
  pronunciationFeedback?: PronunciationFeedbackWord[];
  acousticFeedback?: string;
  lowConfidenceWords?: string[];
}

/**
 * Regex filter before sending text to TTS or displaying in transcript:
 * Strips accidental <think> tags, system markers, bracketed text, reasoning loops,
 * and speaker prefixes to eliminate prompt leaks and thinking loops.
 */
export function filterTextForTTS(rawText: string, personaName: string = 'James'): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let cleaned = rawText;

  // 1. Strip reasoning and thinking XML tags (<think>...</think>, <thought>...</thought>, unclosed tags)
  cleaned = cleaned.replace(/<(think|thought|reasoning|reflection|system|instruction|prompt)[^>]*>[\s\S]*?<\/\1>/gi, '');
  cleaned = cleaned.replace(/<(think|thought|reasoning|reflection|system|instruction|prompt)[^>]*>[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/<\/?(?:think|thought|reasoning|reflection|system|instruction|prompt|s|im_start|im_end)[^>]*>/gi, '');

  // 2. Strip explicit Thinking Process blocks (e.g. "Thinking Process: ...")
  if (/(?:Thinking Process|Thought Process|Reasoning Process|Chain of [Tt]hought|Internal Reasoning):/i.test(cleaned)) {
    // Look for explicit response marker on its own line: e.g. "\n\nDialogue: ...", "\nJames: ..."
    const responseMatch = cleaned.match(/(?:^|\r?\n)\s*(?:(?:Spoken )?Dialogue|(?:Final )?Spoken Reply|Spoken Response|James|Tutor):\s*([\s\S]*)$/i);
    if (responseMatch && responseMatch[1]?.trim()) {
      cleaned = responseMatch[1];
    } else {
      // Strip everything from the header through all numbered/bulleted thinking steps until clean text
      cleaned = cleaned.replace(/(?:Thinking Process|Thought Process|Reasoning Process|Chain of [Tt]hought|Internal Reasoning):[\s\S]*?(?=(?:\r?\n){2,}(?![*\d\s#\-])[A-Z"']|$)/i, '');
    }
  }

  // 3. Strip standalone numbered thinking steps e.g. "1. **Analyze the User's Input:** ... 2. **Determine the Context:** ..."
  cleaned = cleaned.replace(/^\s*\d+\.\s+\*\*(?:Analyze|Determine|Formulate|Identify|Consider|Acknowledge|Evaluate|Draft|Check|Plan|Context|Persona)[^\n]*\*\*[\s\S]*?(?=(?:\r?\n){2,}(?![*\d\s#\-])[A-Z"']|^\s*\d+\.|$)/gim, '');

  // 4. Strip planning bullets like "* Role: James...", "* Scenario: ...", "* Start directly with dialogue..."
  cleaned = cleaned.replace(/^\s*[*•-]\s+\*\*(?:Role|Scenario|Last interaction|Formulate|Tone|Plan)[^\n]*\*\*[\s\S]*?(?=(?:\r?\n){2,}(?![*\d\s#\-])[A-Z"']|^\s*[*•-]|$)/gim, '');
  cleaned = cleaned.replace(/^\s*[*•-]\s+(?:Role|Scenario|Last interaction|Acknowledge|Maintain|Keep it concise|Start directly with dialogue)[^\n]*\n?/gim, '');

  // 5. Strip bracketed text: [...], (...), {...} (e.g. stage directions, [chuckles], [Note: ...], etc.)
  cleaned = cleaned.replace(/\[[\s\S]*?\]/g, '');
  cleaned = cleaned.replace(/\([\s\S]*?\)/g, '');
  cleaned = cleaned.replace(/\{[\s\S]*?\}/g, '');

  // 6. Strip system markers, leaked instructions, or meta-commentary
  cleaned = cleaned.replace(/^(?:CRITICAL(?:\s+INSTRUCTION)?|SYSTEM(?:\s+INSTRUCTION)?|RULES?|NOTE|ROLEPLAY(?:\s+SCENARIO)?):[^\n]*\n?/gim, '');
  cleaned = cleaned.replace(
    /^(?:Since I am playing|As an AI|As an ESL coach|In this turn|I should acknowledge|Note to self|My response:)[^\n]*\n?/gim,
    ''
  );

  // 7. Strip persona/AI speaker prefixes e.g. "James: ", "Dr. Patel: ", "Sarah: ", "Emma: "
  cleaned = cleaned.replace(new RegExp(`^(?:${personaName}|Assistant|AI|Roleplay|System|Tutor):\\s*`, 'i'), '');

  // 8. Strip code fences, markdown actions e.g. *smiles*, and outer quotes
  cleaned = cleaned.trim().replace(/^```[a-z]*\n?([\s\S]*?)\n?```$/i, '$1').trim();
  cleaned = cleaned.replace(/\*[^*]*\*/g, '');
  cleaned = cleaned.replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim();

  // 9. Secondary check for speaker prefixes after quote stripping
  cleaned = cleaned.replace(new RegExp(`^(?:${personaName}|Assistant|AI|Tutor):\\s*`, 'i'), '').trim();
  cleaned = cleaned.replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim();

  // 10. Normalize multiple whitespaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

export const cleanAiReply = filterTextForTTS;
export const cleanTextForTTS = filterTextForTTS;

/**
 * Powers live multi-turn responses with full conversation memory,
 * dynamic persona simulation (Dr. Patel, Sarah, Emma, James),
 * and automatic vocabulary complexity calibration based on user's CEFR level.
 * Seamlessly routes to FreeLLMAPI (port 31415) or Direct Google Gemini.
 */
export async function generateJamesReply(
  conversationHistory: ChatMessage[],
  scenarioTitle: string = 'Your First Day at a UK Office',
  fallbackReplies: string[] = [],
  persona?: AIPersona,
  userAudioClip?: AudioAttachment | null,
  userLevel?: CEFRLevel
): Promise<string> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;
  const userTurnCount = conversationHistory.filter((m) => m.speaker === 'user').length;
  const pName = persona?.name || 'James';
  const pRole = persona?.role || 'Team Lead, London';
  const pTone = persona?.tone || 'Warm, professional British manager';

  if (!apiKey) {
    toast.warning(
      `No API Key found. ${pName} is using offline scripted replies. Click "AI Brain Status" in the top bar to connect FreeLLMAPI or Gemini.`,
      'AI Brain in Mock Mode'
    );
    const fallbackIdx = Math.min(userTurnCount, fallbackReplies.length - 1);
    const chosenFallback =
      fallbackReplies[fallbackIdx] ||
      "Brilliant! Lovely chatting with you today — let's have a look at your scorecard.";
    return filterTextForTTS(chosenFallback, pName);
  }

  // Adjust vocabulary complexity based on learner's assessed CEFR level
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

  // Hardened Anti-Leak System Instruction & Strict Output Constraints
  const systemPrompt = `CRITICAL INSTRUCTION: You are ${pName} (${pRole}). Tone: ${pTone}. You are participating in a live British English voice roleplay: "${scenarioTitle}".
${levelInstruction}
STRICT OUTPUT RULES:
1. Output ONLY your direct spoken dialogue in character.
2. NEVER output internal thinking, reasoning steps, chain-of-thought, or analysis (such as "Thinking Process:", "1. Analyze:", or planning bullets).
3. NEVER include labels or prefixes like "${pName}:" or "Dialogue:". Start immediately with your spoken words.
4. Keep your response strictly between 1 to 3 short, natural sentences (maximum 40 words).
5. Acknowledge what the user just said with warmth or context-appropriate British professionalism, and end with a single, natural follow-up question or response to keep the simulation moving forward.`;

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

      const response = await fetchFreeLLMWithFallback(
        '/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: config.model || 'auto',
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

        toast.error(
          `FreeLLMAPI Error (${response.status}): ${detailedMsg}`,
          'FreeLLMAPI Router Issue'
        );
        throw new Error(`FreeLLMAPI status ${response.status}: ${detailedMsg}`);
      }

      const data = await response.json();
      const replyText = data?.choices?.[0]?.message?.content;
      if (replyText && typeof replyText === 'string') {
        const cleaned = cleanAiReply(replyText, pName);
        if (cleaned) {
          return cleaned;
        }
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

        toast.error(
          `Gemini API Error (${response.status}): ${detailedMsg}`,
          'AI Brain Connection Issue'
        );
        throw new Error(`Gemini status ${response.status}: ${detailedMsg}`);
      }

      const data = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText && typeof candidateText === 'string') {
        const cleaned = cleanAiReply(candidateText, pName);
        if (cleaned) {
          return cleaned;
        }
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
    const chosenFallback =
      fallbackReplies[fallbackIdx] ||
      "Brilliant! Lovely chatting with you today — let's have a look at your scorecard.";
    return filterTextForTTS(chosenFallback, pName);
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
  lowConfidenceWords?: string[];
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
    lowConfidenceWords = [],
  } = params;

  if (!apiKey || userTurns.length === 0) {
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

  try {
    let rawJson: string | null = null;

    if (config.provider === 'freellmapi') {
      const response = await fetchFreeLLMWithFallback(
        '/chat/completions',
        {
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
        toast.error(`Scorecard Error (${response.status}): ${detailedMsg}`, 'Scorecard Analysis Issue');
        throw new Error(`Scorecard status ${response.status}: ${detailedMsg}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const cleanContent = content.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '');
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      rawJson = jsonMatch ? jsonMatch[0] : cleanContent;
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

      // If Gemini did not identify 2 ambiguous words, backfill from low-confidence words detected by speech recognition
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
    console.warn('[geminiService] Scorecard generation fallback:', err);
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
  }
}

/**
 * Interactive 3-turn CEFR Placement Assessment Evaluator.
 * Analyzes the user's 3 spoken placement responses across:
 * - Turn 1: Basic personal introductions, daily routines (A1/A2 foundation)
 * - Turn 2: Past narrative, overcoming challenges (B1/B2 competence)
 * - Turn 3: Complex perspective, technology impact, conditional reasoning (B2/C1 nuance)
 * Uses FreeLLMAPI / Gemini 2.5 Flash with strict CEFR benchmarks,
 * with an offline pedagogical analyzer fallback.
 */
export async function evaluatePlacementAssessment(
  userTurns: string[]
): Promise<PlacementAssessmentResult> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;

  const turn1 = userTurns[0] || '';
  const turn2 = userTurns[1] || '';
  const turn3 = userTurns[2] || '';

  // Heuristic pedagogical fallback
  const computeFallbackAssessment = (): PlacementAssessmentResult => {
    const combined = `${turn1} ${turn2} ${turn3}`.trim();
    const words = combined.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Detect connectors and complex clauses
    const connectors = [
      'because', 'although', 'however', 'furthermore', 'whereas',
      'therefore', 'while', 'since', 'despite', 'in order to', 'as well as'
    ];
    const complexConnectorsFound = connectors.filter((c) =>
      new RegExp(`\\b${c}\\b`, 'i').test(combined)
    );

    // Detect conditionals and advanced modals
    const modalsAndConditionals = ['would', 'could', 'should', 'might', 'have been', 'had been', 'if'];
    const modalsFound = modalsAndConditionals.filter((m) =>
      new RegExp(`\\b${m}\\b`, 'i').test(combined)
    );

    let level: CEFRLevel = 'B1';
    let title = 'B1 — Intermediate';
    let fluencyScore = 75;
    let grammarScore = 76;
    let summary = 'You communicate clearly in everyday conversations and can describe past experiences and opinions effectively.';
    const strengths: string[] = ['Good functional vocabulary', 'Clear turn-taking and communicative intent'];
    const recommendations: string[] = ['Work on using more complex sentence connectors', 'Incorporate more authentic British idioms'];

    if (wordCount >= 65 && complexConnectorsFound.length >= 2 && modalsFound.length >= 2) {
      level = 'C1';
      title = 'C1 — Advanced Spoken Fluency';
      fluencyScore = 92;
      grammarScore = 90;
      summary = 'Exceptional spoken command. You express complex thoughts, hypotheses, and professional perspectives with natural rhythm and rich lexical variety.';
      strengths.push('Sophisticated sentence structures', 'Natural topic elaboration and nuanced vocabulary');
      recommendations.length = 0;
      recommendations.push('Refine subtle British understatement and executive tone', 'Master specialized industry idioms');
    } else if (wordCount >= 38 || (complexConnectorsFound.length >= 1 && modalsFound.length >= 1)) {
      level = 'B2';
      title = 'B2 — Upper Intermediate';
      fluencyScore = 84;
      grammarScore = 82;
      summary = 'Strong conversational ability. You handle narrative questions and abstract topics smoothly with good grammatical consistency and clear expression.';
      strengths.push('Solid grasp of past tenses and connectors', 'Effective self-expression across varied topics');
      recommendations.length = 0;
      recommendations.push('Practice complex conditional clauses (e.g. "If I had known, I would have...")', 'Expand your repertoire of natural British phrasal verbs');
    } else if (wordCount >= 18) {
      level = 'B1';
      title = 'B1 — Intermediate';
      fluencyScore = 74;
      grammarScore = 72;
      summary = 'Good communicative foundation. You answer direct questions clearly and express personal routines and challenges with recognizable confidence.';
      strengths.push('Clear message delivery', 'Good basic vocabulary for daily life and work');
      recommendations.push('Practice linking ideas with "although", "whereas", and "furthermore"', 'Focus on past tense regularity and preposition accuracy');
    } else if (wordCount >= 8) {
      level = 'A2';
      title = 'A2 — Elementary';
      fluencyScore = 65;
      grammarScore = 64;
      summary = 'You can communicate basic facts and familiar information with simple sentence structures. With regular speaking practice, you will build conversational stamina quickly.';
      strengths.push('Willingness to speak and share basic details', 'Good understanding of everyday prompts');
      recommendations.length = 0;
      recommendations.push('Build confidence combining two thoughts with "and", "but", and "because"', 'Expand high-frequency workplace vocabulary');
    } else {
      level = 'A1';
      title = 'A1 — Beginner';
      fluencyScore = 55;
      grammarScore = 58;
      summary = 'Welcome! You are starting your English journey. We will keep vocabulary simple, focus on high-frequency everyday phrases, and build your confidence step by step.';
      strengths.push('Great initial effort taking the speaking assessment', 'Familiarity with basic English greetings');
      recommendations.length = 0;
      recommendations.push('Master key polite phrases ("Could I have...", "Please", "Thank you")', 'Practice short 3-word sentences daily');
    }

    return {
      level,
      title,
      summary,
      fluencyScore,
      grammarScore,
      strengths,
      recommendations,
      assessedAt: new Date().toISOString(),
    };
  };

  if (!apiKey || userTurns.length === 0 || userTurns.every((t) => t.trim().length === 0)) {
    return computeFallbackAssessment();
  }

  const prompt = `You are a Senior British English CEFR Examiner (Cambridge & IELTS oral assessment specialist).
Evaluate this new student's 3 spoken placement assessment answers and assign their exact CEFR level (A1, A2, B1, B2, or C1).

Student's 3 spoken placement responses:
1. Question 1 (Personal intro & daily life): "${turn1}"
2. Question 2 (Past challenge & resolution): "${turn2}"
3. Question 3 (Perspective on AI & technology impact): "${turn3}"

CEFR Grading Criteria:
- A1 (Beginner): Very brief utterances, isolated words, basic present tense fragments, significant hesitations.
- A2 (Elementary): Simple sentences on familiar topics, basic past/present, limited connectors (and, but).
- B1 (Intermediate): Connected narrative flow, clear description of past events/plans, standard workplace vocabulary, understandable grammar with minor slips.
- B2 (Upper Intermediate): Spontaneous fluid speech, good lexical range, effective connectors (however, although, whereas), confident abstract reasoning.
- C1 (Advanced): Highly articulate, complex clauses, natural British idioms, subtle nuance, precise arguments.

Return strictly valid JSON conforming to this schema:
{
  "level": "A1" | "A2" | "B1" | "B2" | "C1",
  "title": "<e.g., 'B2 — Upper Intermediate'>",
  "summary": "<2-3 encouraging sentences summarizing their spoken fluency, vocabulary breadth, and sentence structure>",
  "fluencyScore": <number between 50 and 98>,
  "grammarScore": <number between 50 and 98>,
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "recommendations": ["<practical coaching recommendation 1>", "<practical coaching recommendation 2>"]
}`;

  try {
    let rawJson: string | null = null;

    if (config.provider === 'freellmapi') {
      const response = await fetchFreeLLMWithFallback(
        '/chat/completions',
        {
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
                content: 'You are an expert Cambridge/IELTS CEFR examiner. Output only strictly valid JSON matching the requested schema with no commentary or markdown backticks.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.2,
          }),
        },
        config.baseUrl
      );

      if (!response.ok) {
        throw new Error(`FreeLLMAPI error ${response.status}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const cleanContent = content.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '');
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      rawJson = jsonMatch ? jsonMatch[0] : cleanContent;
    } else {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini error ${response.status}`);
      }

      const data = await response.json();
      rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    if (!rawJson) return computeFallbackAssessment();

    const parsed = JSON.parse(rawJson);
    const validLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const level: CEFRLevel = validLevels.includes(parsed.level) ? parsed.level : 'B1';

    return {
      level,
      title: parsed.title || `${level} — Assessed Level`,
      summary: parsed.summary || 'Solid speaking performance across the placement assessment.',
      fluencyScore: typeof parsed.fluencyScore === 'number' ? Math.max(50, Math.min(100, Math.round(parsed.fluencyScore))) : 80,
      grammarScore: typeof parsed.grammarScore === 'number' ? Math.max(50, Math.min(100, Math.round(parsed.grammarScore))) : 78,
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : ['Clear message delivery', 'Good communicative intent'],
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0 ? parsed.recommendations : ['Focus on sentence linking', 'Practice natural British idioms'],
      assessedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[geminiService] Placement evaluation fallback used:', e);
    return computeFallbackAssessment();
  }
}

