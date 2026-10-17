// Unified AI Client Transport (FreeLLMAPI Gateway & Direct Google Gemini)
import { getCandidateGatewayUrls, getLLMConfig, saveLLMConfig } from '../llmConfig';
import { toast } from '../toast';

export interface AudioAttachment {
  base64: string;
  mimeType: string;
}

export interface ChatMessage {
  speaker: 'ai' | 'user';
  text: string;
}

/**
 * Resiliently fetches FreeLLMAPI gateway endpoints.
 * Automatically fails over to the Vite same-origin proxy if direct loopback
 * connections are blocked by browser Cross-Origin-Resource-Policy (CORP) or Private Network Access (PNA).
 */
let cachedWorkingGatewayBase: string | null = null;

export async function fetchFreeLLMWithFallback(
  path: string,
  init: RequestInit,
  primaryBase?: string
): Promise<Response> {
  const allCandidates = getCandidateGatewayUrls(primaryBase);
  const candidates = cachedWorkingGatewayBase
    ? [cachedWorkingGatewayBase, ...allCandidates.filter((c) => c !== cachedWorkingGatewayBase)]
    : allCandidates;

  let lastError: unknown = null;
  let lastRes: Response | null = null;
  for (const base of candidates) {
    try {
      const url = `${base}${path.startsWith('/') ? path : '/' + path}`;
      const res = await fetch(url, init);
      if (res.ok) {
        cachedWorkingGatewayBase = base;
        return res;
      }
      if (res.status === 401 || res.status === 403) {
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

export function getGeminiApiKey(): string | null {
  const config = getLLMConfig();
  return config.apiKey || null;
}

export function saveGeminiApiKey(key: string): void {
  const current = getLLMConfig();
  saveLLMConfig({ ...current, apiKey: key.trim() });
}

export function isGeminiConfigured(): boolean {
  const config = getLLMConfig();
  return Boolean(config.apiKey && config.apiKey.length > 5);
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
    const responseMatch = cleaned.match(/(?:^|\r?\n)\s*(?:(?:Spoken )?Dialogue|(?:Final )?Spoken Reply|Spoken Response|James|Tutor):\s*([\s\S]*)$/i);
    if (responseMatch && responseMatch[1]?.trim()) {
      cleaned = responseMatch[1];
    } else {
      cleaned = cleaned.replace(/(?:Thinking Process|Thought Process|Reasoning Process|Chain of [Tt]hought|Internal Reasoning):[\s\S]*?(?=(?:\r?\n){2,}(?![*\d\s#-])[A-Z"']|$)/i, '');
    }
  }

  // 3. Strip standalone numbered thinking steps
  cleaned = cleaned.replace(/^\s*\d+\.\s+\*\*(?:Analyze|Determine|Formulate|Identify|Consider|Acknowledge|Evaluate|Draft|Check|Plan|Context|Persona)[^\n]*\*\*[\s\S]*?(?=(?:\r?\n){2,}(?![*\d\s#-])[A-Z"']|^\s*\d+\.|$)/gim, '');

  // 4. Strip planning bullets
  cleaned = cleaned.replace(/^\s*[*•-]\s+\*\*(?:Role|Scenario|Last interaction|Formulate|Tone|Plan)[^\n]*\*\*[\s\S]*?(?=(?:\r?\n){2,}(?![*\d\s#-])[A-Z"']|^\s*[*•-]|$)/gim, '');
  cleaned = cleaned.replace(/^\s*[*•-]\s+(?:Role|Scenario|Last interaction|Acknowledge|Maintain|Keep it concise|Start directly with dialogue)[^\n]*\n?/gim, '');

  // 5. Strip bracketed text: [...], (...), {...}
  cleaned = cleaned.replace(/\[[\s\S]*?\]/g, '');
  cleaned = cleaned.replace(/\([\s\S]*?\)/g, '');
  cleaned = cleaned.replace(/\{[\s\S]*?\}/g, '');

  // 6. Strip system markers, leaked instructions, or meta-commentary
  cleaned = cleaned.replace(/^(?:CRITICAL(?:\s+INSTRUCTION)?|SYSTEM(?:\s+INSTRUCTION)?|RULES?|NOTE|ROLEPLAY(?:\s+SCENARIO)?):[^\n]*\n?/gim, '');
  cleaned = cleaned.replace(
    /^(?:Since I am playing|As an AI|As an ESL coach|In this turn|I should acknowledge|Note to self|My response:)[^\n]*\n?/gim,
    ''
  );

  // 7. Strip persona/AI speaker prefixes
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
 * Shared JSON completion helper for both FreeLLMAPI and Direct Gemini.
 */
export async function requestStructuredJSON<T = any>(params: {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  audioAttachment?: AudioAttachment;
  toastOnErrorTitle?: string;
}): Promise<T | null> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;
  if (!apiKey) return null;

  const {
    systemInstruction,
    prompt,
    temperature = 0.25,
    maxTokens = 800,
    signal,
    audioAttachment,
    toastOnErrorTitle,
  } = params;

  let rawJson: string | null = null;

  if (config.provider === 'freellmapi') {
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
        signal,
        body: JSON.stringify({
          model: freeLLMModel,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
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
      if (toastOnErrorTitle) {
        toast.error(`Error (${response.status}): ${detailedMsg}`, toastOnErrorTitle);
      }
      throw new Error(`FreeLLMAPI status ${response.status}: ${detailedMsg}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const cleanContent = content.replace(/<(think|thought|reasoning)>[\s\S]*?<\/\1>/gi, '');
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    rawJson = jsonMatch ? jsonMatch[0] : cleanContent;
  } else {
    const parts: any[] = [];
    const directModel = config.model && config.model !== 'auto' ? config.model : 'gemini-2.5-flash';

    if (audioAttachment?.base64 && audioAttachment.base64.length > 50 && audioAttachment.base64.length < 500000) {
      parts.push({
        inlineData: {
          mimeType: audioAttachment.mimeType.split(';')[0] || 'audio/webm',
          data: audioAttachment.base64,
        },
      });
    }

    parts.push({ text: prompt });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${directModel}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
            ...(directModel.includes('2.5') || directModel.includes('2.0')
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
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
      if (toastOnErrorTitle) {
        toast.error(`Gemini Error (${response.status}): ${detailedMsg}`, toastOnErrorTitle);
      }
      throw new Error(`Gemini status ${response.status}: ${detailedMsg}`);
    }

    const data = await response.json();
    rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  if (!rawJson) return null;
  const trimmed = rawJson.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(trimmed) as T;
}
