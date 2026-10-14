// LLM Configuration & Unified FreeLLMAPI Router Management
// Default: FreeLLMAPI Gateway on http://127.0.0.1:31415/v1 (Unified Key)

export type LLMProvider = 'freellmapi' | 'direct-gemini';

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const STORAGE_KEY_LLM_CONFIG = 'fluency_llm_config';
export const DEFAULT_FREELLM_BASE_URL = 'http://127.0.0.1:31415/v1';
export const DEFAULT_MODEL = 'auto';

export const AVAILABLE_MODELS = [
  { id: 'auto', label: 'Auto (Recommended - FreeLLMAPI Routing)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemma-4-31b-it', label: 'Gemma 4 31B IT' },
];

export function getLLMConfig(): LLMConfig {
  let saved: Partial<LLMConfig> = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LLM_CONFIG);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      console.warn('Failed reading fluency_llm_config from localStorage', e);
    }
  }

  // Check environment variables
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envKey = (import.meta as any).env?.VITE_FREELLM_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  const legacyKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') || '' : '';

  const apiKey = (saved.apiKey !== undefined ? saved.apiKey : envKey || legacyKey).trim();
  const baseUrl = (saved.baseUrl || DEFAULT_FREELLM_BASE_URL).trim().replace(/\/+$/, '');
  const provider: LLMProvider = saved.provider === 'direct-gemini' ? 'direct-gemini' : 'freellmapi';
  const model = saved.model || DEFAULT_MODEL;

  return {
    provider,
    baseUrl,
    apiKey,
    model,
  };
}

export function saveLLMConfig(config: LLMConfig): void {
  const normalized: LLMConfig = {
    ...config,
    baseUrl: config.baseUrl.trim().replace(/\/+$/, ''),
    apiKey: config.apiKey.trim(),
  };

  try {
    localStorage.setItem(STORAGE_KEY_LLM_CONFIG, JSON.stringify(normalized));
    if (normalized.apiKey) {
      localStorage.setItem('gemini_api_key', normalized.apiKey);
    }
  } catch (e) {
    console.warn('Failed saving fluency_llm_config', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fluency_llm_config_changed', { detail: normalized }));
  }
}

export interface GatewayTestResult {
  ok: boolean;
  status?: number;
  message: string;
  models?: string[];
  latencyMs?: number;
}

/**
 * Pings http://127.0.0.1:31415/v1/models (or sends a 1-token test message)
 * with Authorization: Bearer ${apiKey} and confirms the router is responding.
 */
export async function testGatewayConnection(config?: LLMConfig): Promise<GatewayTestResult> {
  const conf = config || getLLMConfig();
  const cleanBase = conf.baseUrl.trim().replace(/\/+$/, '');
  const start = performance.now();

  if (!conf.apiKey) {
    return {
      ok: false,
      message: 'API Key is empty. Please enter your unified FreeLLMAPI key.',
    };
  }

  if (conf.provider === 'freellmapi') {
    try {
      // 1. Try pinging /models endpoint
      const modelsUrl = `${cleanBase}/models`;
      const res = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${conf.apiKey.trim()}`,
        },
      });

      const latencyMs = Math.round(performance.now() - start);

      if (res.ok) {
        let models: string[] = [];
        try {
          const data = await res.json();
          if (Array.isArray(data?.data)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            models = data.data.map((m: any) => m.id || m.name).filter(Boolean);
          }
        } catch {
          // ignore JSON parse issue if models endpoint returned raw text
        }
        return {
          ok: true,
          status: res.status,
          latencyMs,
          message: `Connected successfully (${latencyMs}ms)! FreeLLMAPI router online.`,
          models: models.length > 0 ? models : undefined,
        };
      }

      // If 401 or 403, key is rejected by the router
      if (res.status === 401 || res.status === 403) {
        let errDetail = 'Invalid API key';
        try {
          const errData = await res.json();
          errDetail = errData?.error?.message || errDetail;
        } catch {
          // ignore
        }
        return {
          ok: false,
          status: res.status,
          message: `Authentication error (${res.status}): ${errDetail}. Verify your unified key.`,
        };
      }

      // Fallback: If /models isn't enabled or returns 404/405, send a 1-token test chat message
      const chatUrl = `${cleanBase}/chat/completions`;
      const chatRes = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${conf.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: conf.model || 'auto',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });

      const chatLatencyMs = Math.round(performance.now() - start);

      if (chatRes.ok) {
        return {
          ok: true,
          status: chatRes.status,
          latencyMs: chatLatencyMs,
          message: `Connected successfully (${chatLatencyMs}ms)! FreeLLMAPI chat completions ready.`,
        };
      }

      let chatErr = chatRes.statusText;
      try {
        const d = await chatRes.json();
        chatErr = d?.error?.message || chatErr;
      } catch {
        // ignore
      }

      return {
        ok: false,
        status: chatRes.status,
        message: `Router returned error ${chatRes.status}: ${chatErr}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Could not reach ${cleanBase}: ${msg}. Ensure your FreeLLMAPI gateway is running on port 31415.`,
      };
    }
  } else {
    // direct-gemini provider test
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${encodeURIComponent(
        conf.apiKey.trim()
      )}`;
      const res = await fetch(url);
      const latencyMs = Math.round(performance.now() - start);

      if (res.ok) {
        return {
          ok: true,
          status: res.status,
          latencyMs,
          message: `Google Gemini API connected directly (${latencyMs}ms)!`,
        };
      }

      return {
        ok: false,
        status: res.status,
        message: `Gemini API error ${res.status}: ${res.statusText}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Direct Gemini connection failed: ${msg}`,
      };
    }
  }
}
