// Fluency AI Indestructible Key Vault & Multi-Tier Persistence Subsystem
// Guarantees that user API keys (specifically Google Gemini AI keys)
// survive mobile OS cache clears, Safari 7-day ITP, PWA updates,
// domain switches (fluency.cosmowhisper.com <-> api.cosmowhisper.com),
// memory pressure, and accidental navigation without manual save.

import type { LLMConfig } from './llmConfig';

const DB_NAME = 'fluency_persistent_vault_db';
const DB_VERSION = 1;
const STORE_NAME = 'credentials_vault';

const COOKIE_KEY_NAME = 'fluency_gemini_vault_key';
const COOKIE_CONF_NAME = 'fluency_llm_config_vault';
const COOKIE_MAX_AGE = 31536000; // 1 full year in seconds

// Storage keys
export const STORAGE_KEY_CONFIG = 'fluency_llm_config';
export const STORAGE_KEY_GEMINI = 'fluency_gemini_api_key';
export const STORAGE_KEY_LEGACY = 'gemini_api_key';
export const STORAGE_KEY_BACKUP = 'fluency_gemini_api_key_v2_backup';
export const STORAGE_KEY_SESSION_CONFIG = 'fluency_llm_config_session';
export const STORAGE_KEY_SESSION_KEY = 'fluency_gemini_session_key';

/**
 * Cookie Helper with cross-subdomain coverage for cosmowhisper.com
 */
function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  try {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isCosmo = hostname.includes('cosmowhisper.com');
    const domainAttr = isCosmo ? '; domain=.cosmowhisper.com' : '';
    const secureAttr = isHttps ? '; Secure' : '';

    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${domainAttr}${secureAttr}`;
  } catch (e) {
    console.warn('[KeyVault] Failed writing cookie', e);
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const nameEQ = `${name}=`;
    const parts = document.cookie.split(';');
    for (let c of parts) {
      c = c.trim();
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length));
      }
    }
  } catch (e) {
    console.warn('[KeyVault] Failed reading cookie', e);
  }
  return null;
}

/**
 * IndexedDB Promise-based Open Helper
 */
function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Write an item to IndexedDB Vault
 */
async function writeToIDB(key: string, data: any): Promise<void> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id: key, payload: data, updatedAt: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (e) {
    console.warn('[KeyVault] IndexedDB write failed non-critically', e);
  }
}

/**
 * Read an item from IndexedDB Vault
 */
async function readFromIDB<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        db.close();
        if (req.result && req.result.payload) {
          resolve(req.result.payload as T);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Requests device persistent storage from mobile OS (Safari iOS, Chrome Android).
 * This switches the browser quota from "best-effort" to "persistent" so the OS
 * will never automatically evict Fluency AI's stored keys under memory/disk pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isAlreadyPersisted = await navigator.storage.persisted();
      if (!isAlreadyPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[KeyVault] Device storage persistence granted: ${granted}`);
        return granted;
      }
      return true;
    } catch (e) {
      console.warn('[KeyVault] Error requesting persistent storage', e);
    }
  }
  return false;
}

/**
 * Synchronous snapshot reader used during initial React render
 * Cascades through LocalStorage -> SessionStorage -> Cookies
 */
export function readFromPersistentVaultSync(): { config?: Partial<LLMConfig>; apiKey?: string } {
  if (typeof window === 'undefined') return {};

  let config: Partial<LLMConfig> | undefined;
  let apiKey: string | undefined;

  // 1. Try LocalStorage
  try {
    const rawConf = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (rawConf) {
      config = JSON.parse(rawConf);
    }
  } catch {}

  const keyLocal =
    localStorage.getItem(STORAGE_KEY_GEMINI) ||
    localStorage.getItem(STORAGE_KEY_BACKUP) ||
    localStorage.getItem(STORAGE_KEY_LEGACY) ||
    '';

  if (keyLocal && keyLocal.trim().length > 0) {
    apiKey = keyLocal.trim();
  }

  // 2. Try SessionStorage if LocalStorage was empty or cleared
  if (!apiKey || apiKey.length < 5) {
    try {
      const sessKey = sessionStorage.getItem(STORAGE_KEY_SESSION_KEY);
      if (sessKey && sessKey.trim().length > 0) {
        apiKey = sessKey.trim();
      }
      const rawSessConf = sessionStorage.getItem(STORAGE_KEY_SESSION_CONFIG);
      if (!config && rawSessConf) {
        config = JSON.parse(rawSessConf);
      }
    } catch {}
  }

  // 3. Try Persistent 1-Year Cookie (survives PWA updates & domain hops)
  if (!apiKey || apiKey.length < 5) {
    const cookieKey = getCookie(COOKIE_KEY_NAME);
    if (cookieKey && cookieKey.trim().length > 0) {
      apiKey = cookieKey.trim();
    }
  }
  if (!config) {
    const cookieConfRaw = getCookie(COOKIE_CONF_NAME);
    if (cookieConfRaw) {
      try {
        config = JSON.parse(cookieConfRaw);
      } catch {}
    }
  }

  return { config, apiKey };
}

/**
 * Saves LLM configuration and Gemini API Key to ALL durability tiers:
 * 1. LocalStorage
 * 2. SessionStorage
 * 3. 1-Year Cross-Subdomain Cookie
 * 4. IndexedDB Vault
 * 5. Device Persistent Storage registration
 */
export async function saveToPersistentVault(config: LLMConfig): Promise<void> {
  if (typeof window === 'undefined') return;

  const cleanKey = (config.apiKey || '').trim();
  const serialized = JSON.stringify(config);

  // Tier 1: LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, serialized);
    if (cleanKey) {
      localStorage.setItem(STORAGE_KEY_GEMINI, cleanKey);
      localStorage.setItem(STORAGE_KEY_BACKUP, cleanKey);
      localStorage.setItem(STORAGE_KEY_LEGACY, cleanKey);
    }
  } catch (e) {
    console.warn('[KeyVault] LocalStorage write error', e);
  }

  // Tier 2: SessionStorage
  try {
    sessionStorage.setItem(STORAGE_KEY_SESSION_CONFIG, serialized);
    if (cleanKey) {
      sessionStorage.setItem(STORAGE_KEY_SESSION_KEY, cleanKey);
    }
  } catch {}

  // Tier 3: Cross-Subdomain Cookie
  if (cleanKey) {
    setCookie(COOKIE_KEY_NAME, cleanKey);
  }
  setCookie(COOKIE_CONF_NAME, serialized);

  // Tier 4: IndexedDB Vault (Persistent storage)
  try {
    await writeToIDB('llm_config', config);
    if (cleanKey) {
      await writeToIDB('gemini_api_key', cleanKey);
    }
  } catch (e) {
    console.warn('[KeyVault] IndexedDB save failed', e);
  }

  // Request storage persistence from OS
  requestPersistentStorage().catch(() => {});
}

/**
 * Flush all current in-memory keys to all storage layers before PWA reloads or updates
 */
export function flushKeyVaultBeforeUpdate(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    const key =
      localStorage.getItem(STORAGE_KEY_GEMINI) ||
      localStorage.getItem(STORAGE_KEY_BACKUP) ||
      getCookie(COOKIE_KEY_NAME);

    if (raw) {
      sessionStorage.setItem(STORAGE_KEY_SESSION_CONFIG, raw);
      setCookie(COOKIE_CONF_NAME, raw);
    }
    if (key) {
      sessionStorage.setItem(STORAGE_KEY_SESSION_KEY, key);
      setCookie(COOKIE_KEY_NAME, key);
    }
  } catch (e) {
    console.warn('[KeyVault] Error during pre-update flush', e);
  }
}

/**
 * Asynchronously hydrates and restores the LLM config if LocalStorage was cleared or lost.
 * Queries IndexedDB and Cookies, restores to LocalStorage, and dispatches events.
 */
export async function hydratePersistentVaultAsync(
  currentConfig: LLMConfig,
  onHydrated?: (healedConfig: LLMConfig) => void
): Promise<LLMConfig> {
  // If currentConfig already has a user-entered key (e.g. starting with AIza), keep it
  if (currentConfig.apiKey && currentConfig.apiKey.startsWith('AIza')) {
    // Re-verify that IndexedDB and cookies are up to date
    saveToPersistentVault(currentConfig).catch(() => {});
    return currentConfig;
  }

  // 1. Check IndexedDB
  const idbConfig = await readFromIDB<LLMConfig>('llm_config');
  const idbKey = await readFromIDB<string>('gemini_api_key');

  const cookieKey = getCookie(COOKIE_KEY_NAME);
  const cookieConfRaw = getCookie(COOKIE_CONF_NAME);
  let cookieConfig: LLMConfig | null = null;
  if (cookieConfRaw) {
    try {
      cookieConfig = JSON.parse(cookieConfRaw);
    } catch {}
  }

  const bestKey = idbKey || cookieKey || idbConfig?.apiKey || cookieConfig?.apiKey;

  if (bestKey && bestKey.startsWith('AIza')) {
    console.log('[KeyVault] Recovered Gemini API key from persistent vault storage!');
    const healedConfig: LLMConfig = {
      provider: 'direct-gemini',
      baseUrl: idbConfig?.baseUrl || cookieConfig?.baseUrl || currentConfig.baseUrl,
      apiKey: bestKey.trim(),
      model:
        idbConfig?.model || cookieConfig?.model || (currentConfig.model === 'auto' ? 'gemini-2.5-flash' : currentConfig.model),
    };

    await saveToPersistentVault(healedConfig);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fluency_llm_config_changed', { detail: healedConfig }));
      window.dispatchEvent(new Event('gemini_api_key_updated'));
      window.dispatchEvent(new Event('storage'));
    }

    if (onHydrated) {
      onHydrated(healedConfig);
    }
    return healedConfig;
  }

  return currentConfig;
}
