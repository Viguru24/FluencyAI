// LLM Configuration & Unified FreeLLMAPI Router Management
// Supports FreeLLMAPI Gateway on http://127.0.0.1:31415/v1 and Direct Google Gemini API

export type LLMProvider = 'freellmapi' | 'direct-gemini';

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const STORAGE_KEY_LLM_CONFIG = 'fluency_llm_config';
export const DEFAULT_FREELLM_BASE_URL = 'http://127.0.0.1:31415/v1';
export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

export const AVAILABLE_MODELS_FREELLM = [
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (Blazing Fast ~500ms · Recommended)' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Balanced ~1.4s)' },
  { id: 'auto', label: 'Auto (FreeLLMAPI Default Routing)' },
  { id: 'gemma-4-31b-it', label: 'Gemma 4 31B IT' },
];

export const AVAILABLE_MODELS_DIRECT = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
];

export const AVAILABLE_MODELS = AVAILABLE_MODELS_FREELLM;

/**
 * Sanitizes an API key by stripping quotes, whitespace, Bearer prefixes,
 * zero-width invisible unicode characters, and line breaks.
 */
export function sanitizeApiKey(key: string): string {
  if (!key) return '';
  return key
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^key=/i, '')
    .replace(/^["']|["']$/g, '')
    .replace(/[^\x21-\x7E]/g, '') // strip invisible unicode, zero-width spaces, newlines, etc.
    .trim();
}

export const DEFAULT_FREELLM_KEY = 'freellmapi-507e287e4cc5d960e1a31e5a5878d2d8ef7b8947f6fa77c3';

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

  // Check stored keys and environment variables
  const fluencyKey = typeof window !== 'undefined' ? localStorage.getItem('fluency_gemini_api_key') || '' : '';
  const legacyKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') || '' : '';
  const envKey =
    (import.meta as any).env?.VITE_FREELLM_API_KEY ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (import.meta as any).env?.GEMINI_API_KEY ||
    DEFAULT_FREELLM_KEY;

  const rawKey = saved.apiKey && saved.apiKey.trim().length > 0 ? saved.apiKey : fluencyKey || legacyKey || envKey;
  const apiKey = sanitizeApiKey(rawKey || DEFAULT_FREELLM_KEY);
  const envBaseUrl = (import.meta as any).env?.VITE_FREELLM_BASE_URL;
  const baseUrl = (saved.baseUrl || envBaseUrl || DEFAULT_FREELLM_BASE_URL).trim().replace(/\/+$/, '');
  
  let provider: LLMProvider = 'freellmapi';
  if (apiKey.startsWith('freellma')) {
    provider = 'freellmapi';
  } else if (apiKey.startsWith('AIza')) {
    provider = 'direct-gemini';
  } else if (saved.provider) {
    provider = saved.provider;
  }

  let model = saved.model;
  if (!model || (provider === 'freellmapi' && (model === 'gemini-2.5-flash' || model === 'gemini-2.0-flash' || model === 'auto'))) {
    model = provider === 'freellmapi' ? DEFAULT_MODEL : 'gemini-2.5-flash';
  } else if (!model && provider === 'direct-gemini') {
    model = 'gemini-2.5-flash';
  }

  return {
    provider,
    baseUrl,
    apiKey,
    model,
  };
}

export function saveLLMConfig(config: LLMConfig): void {
  const cleanKey = sanitizeApiKey(config.apiKey);
  let provider = config.provider;
  if (cleanKey.startsWith('freellma')) {
    provider = 'freellmapi';
  } else if (cleanKey.startsWith('AIza')) {
    provider = 'direct-gemini';
  }

  const model =
    provider === 'direct-gemini' && config.model === 'auto'
      ? 'gemini-2.5-flash'
      : config.model || (provider === 'direct-gemini' ? 'gemini-2.5-flash' : 'auto');

  const normalized: LLMConfig = {
    provider,
    baseUrl: (config.baseUrl || DEFAULT_FREELLM_BASE_URL).trim().replace(/\/+$/, ''),
    apiKey: cleanKey,
    model,
  };

  try {
    localStorage.setItem(STORAGE_KEY_LLM_CONFIG, JSON.stringify(normalized));
    if (cleanKey) {
      localStorage.setItem('fluency_gemini_api_key', cleanKey);
      localStorage.setItem('gemini_api_key', cleanKey);
    } else {
      localStorage.removeItem('fluency_gemini_api_key');
      localStorage.removeItem('gemini_api_key');
    }
  } catch (e) {
    console.warn('Failed saving fluency_llm_config', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fluency_llm_config_changed', { detail: normalized }));
    window.dispatchEvent(new Event('gemini_api_key_updated'));
    window.dispatchEvent(new Event('storage'));
  }
}

/**
 * Resolves operational gateway candidate URLs.
 * In browser environments, Cross-Origin-Resource-Policy (CORP) or Private Network Access (PNA)
 * can block direct loopback http://127.0.0.1:31415 requests from different origins.
 * This provides automatic failover to the same-origin Vite proxy (/freellm-gateway/v1).
 */
export function getCandidateGatewayUrls(base?: string): string[] {
  const primary = (base || (import.meta as any).env?.VITE_FREELLM_BASE_URL || DEFAULT_FREELLM_BASE_URL)
    .trim()
    .replace(/\/+$/, '');
  const candidates: string[] = [];

  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    // Proxies configured on Vite dev server (zero-CORS)
    const directV1Proxy = `${origin}/v1`;
    const gatewayV1Proxy = `${origin}/freellm-gateway/v1`;
    candidates.push(directV1Proxy);
    candidates.push(gatewayV1Proxy);
  }
  if (!candidates.includes(primary)) {
    candidates.push(primary);
  }
  if (primary.includes('127.0.0.1:31415')) {
    const localhostBase = primary.replace('127.0.0.1:31415', 'localhost:31415');
    if (!candidates.includes(localhostBase)) candidates.push(localhostBase);
  } else if (primary.includes('localhost:31415')) {
    const ipBase = primary.replace('localhost:31415', '127.0.0.1:31415');
    if (!candidates.includes(ipBase)) candidates.push(ipBase);
  }
  return candidates;
}

export interface GatewayTestResult {
  ok: boolean;
  status?: number;
  message: string;
  models?: string[];
  latencyMs?: number;
}

/**
 * Tests connection to FreeLLMAPI Router or Google Gemini Direct API.
 * Accurately parses response JSON error messages so errors are never masked by empty statusText.
 */
export async function testGatewayConnection(config?: LLMConfig): Promise<GatewayTestResult> {
  const conf: LLMConfig = config ? { ...config } : getLLMConfig();
  const cleanKey = sanitizeApiKey(conf.apiKey);

  // Guarantee that freellma keys ALWAYS test against FreeLLMAPI router
  if (cleanKey.startsWith('freellma')) {
    conf.provider = 'freellmapi';
  } else if (cleanKey.startsWith('AIza')) {
    conf.provider = 'direct-gemini';
  }

  const cleanBase = (conf.baseUrl || (import.meta as any).env?.VITE_FREELLM_BASE_URL || DEFAULT_FREELLM_BASE_URL).trim().replace(/\/+$/, '');
  const start = performance.now();

  if (!cleanKey) {
    return {
      ok: false,
      message:
        conf.provider === 'direct-gemini'
          ? 'API Key is empty. Please enter your Google Gemini API key (starts with AIzaSy...).'
          : 'API Key is empty. Please enter your FreeLLMAPI unified key (starts with freellma...).',
    };
  }

  if (conf.provider === 'freellmapi') {
    const candidateBases = getCandidateGatewayUrls(cleanBase);
    let lastNetworkErr = '';

    for (const base of candidateBases) {
      try {
        // 1. Try pinging /models endpoint on FreeLLMAPI router
        const modelsUrl = `${base}/models`;
        const res = await fetch(modelsUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
          },
        });

        const latencyMs = Math.round(performance.now() - start);

        if (res.ok) {
          let models: string[] = [];
          try {
            const data = await res.json();
            if (Array.isArray(data?.data)) {
              models = data.data.map((m: any) => m.id || m.name).filter(Boolean);
            }
          } catch {
            // ignore
          }
          return {
            ok: true,
            status: res.status,
            latencyMs,
            message: `Connected successfully (${latencyMs}ms)! FreeLLMAPI router online.`,
            models: models.length > 0 ? models : undefined,
          };
        }

        // If auth failure on FreeLLMAPI
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
            message: `Authentication error (${res.status}): ${errDetail}. Verify your FreeLLMAPI key.`,
          };
        }

        // Fallback: Test 1-token completion on this base
        const chatUrl = `${base}/chat/completions`;
        const chatRes = await fetch(chatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanKey}`,
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

        if (chatRes.status === 401 || chatRes.status === 403) {
          return {
            ok: false,
            status: chatRes.status,
            message: `Authentication error (${chatRes.status}). Verify your FreeLLMAPI key.`,
          };
        }

        let chatErr = `HTTP ${chatRes.status}`;
        try {
          const d = await chatRes.json();
          chatErr = d?.error?.message || chatErr;
        } catch {
          // ignore
        }
        lastNetworkErr = `HTTP ${chatRes.status} (${chatErr})`;
      } catch (err: unknown) {
        lastNetworkErr = err instanceof Error ? err.message : String(err);
        // continue trying next candidate base
      }
    }

    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (isHttps) {
      return {
        ok: false,
        message: `Browser Mixed-Content Block: This page is hosted on secure HTTPS (${window.location.hostname}), but FreeLLMAPI is a local desktop application running on HTTP (127.0.0.1:31415). Web browsers strictly block HTTPS web pages from fetching local HTTP services. To use your local FreeLLMAPI gateway, please run the app locally on http://localhost:5173 or switch to the "Direct Gemini API" tab.`,
      };
    }

    return {
      ok: false,
      message: `Could not reach ${cleanBase}: ${lastNetworkErr || 'Failed to fetch'}. Ensure your FreeLLMAPI gateway is running on port 31415.`,
    };
  } else {
    // direct-gemini provider test

    // Pre-check for wrong key types
    if (cleanKey.startsWith('freellma')) {
      return {
        ok: false,
        message:
          'This key begins with "freellma", which is for the FreeLLMAPI router. Switch to the "FreeLLMAPI (Unified)" tab on the left to use this key.',
      };
    }
    if (cleanKey.startsWith('sk-')) {
      return {
        ok: false,
        message:
          'This key begins with "sk-", which is an OpenAI key. Google Gemini API keys start with "AIzaSy...".',
      };
    }

    try {
      // Validate key by querying Google's official Gemini models endpoint
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(url);
      const latencyMs = Math.round(performance.now() - start);

      if (res.ok) {
        let models: string[] = [];
        try {
          const data = await res.json();
          if (Array.isArray(data?.models)) {
            models = data.models
              .map((m: any) => m.name?.replace('models/', ''))
              .filter((name: string) => name && (name.includes('flash') || name.includes('gemini')));
          }
        } catch {
          // ignore
        }

        return {
          ok: true,
          status: res.status,
          latencyMs,
          message: `Google Gemini API connected directly (${latencyMs}ms)! Key is verified & active.`,
          models: models.length > 0 ? models : undefined,
        };
      }

      // Parse JSON error body from Google API
      let errorDetail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errorDetail = errJson?.error?.message || errJson?.message || errorDetail;
      } catch {
        const txt = await res.text();
        errorDetail = txt.slice(0, 200) || errorDetail;
      }

      if (res.status === 400 && errorDetail.includes('API key not valid')) {
        return {
          ok: false,
          status: 400,
          message:
            'Google rejected this API key as invalid. Please check that you copied the complete key starting with "AIzaSy..." from https://aistudio.google.com/app/apikey with no missing characters.',
        };
      }

      return {
        ok: false,
        status: res.status,
        message: `Gemini API error (${res.status}): ${errorDetail}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Direct Gemini connection failed: ${msg}. Check your internet connection.`,
      };
    }
  }
}
