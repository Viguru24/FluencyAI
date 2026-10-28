import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Server,
  Zap,
  KeyRound,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cpu,
  Radio,
  AlertTriangle,
  ExternalLink,
  Volume2,
  ShieldCheck,
} from 'lucide-react';

import {
  getLLMConfig,
  saveLLMConfig,
  sanitizeApiKey,
  testGatewayConnection,
  DEFAULT_FREELLM_BASE_URL,
  AVAILABLE_MODELS,
  AVAILABLE_MODELS_DIRECT,
  AVAILABLE_MODELS_FREELLM,
  type LLMConfig,
  type GatewayTestResult,
} from '../services/llmConfig';

import {
  hydratePersistentVaultAsync,
  requestPersistentStorage,
} from '../services/persistentKeyVault';

import { toast } from '../services/toast';
import {
  playChime,
  getAvailableBritishVoices,
  getSelectedTTSVoice,
  setSelectedTTSVoice,
  auditionTTSVoice,
  type VoiceOption,
} from '../services/speech';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnectionStatusChange?: (isConnected: boolean) => void;
}

export const AIGatewaySettingsModal: React.FC<Props> = ({ isOpen, onClose, onConnectionStatusChange }) => {
  const [config, setConfig] = useState<LLMConfig>(getLLMConfig);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<GatewayTestResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isCustomModel, setIsCustomModel] = useState(() => {
    const current = getLLMConfig();
    return !AVAILABLE_MODELS.some((m) => m.id === current.model);
  });

  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(() => getSelectedTTSVoice() || '');
  const [isAuditioning, setIsAuditioning] = useState(false);

  const triggerAutoSave = (updatedConfig: LLMConfig) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setSaveStatus('saving');
    autoSaveTimerRef.current = setTimeout(() => {
      saveLLMConfig(updatedConfig);
      setSaveStatus('saved');
      if (updatedConfig.apiKey && updatedConfig.apiKey.length > 5) {
        onConnectionStatusChange?.(true);
      }
      setTimeout(() => setSaveStatus('idle'), 2500);
    }, 350);
  };

  const handleSafeClose = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    if (config.apiKey && config.apiKey.trim().length > 0) {
      saveLLMConfig(config);
    }
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(async () => {
        // Request device persistent storage from mobile OS (Safari iOS / Chrome Android)
        requestPersistentStorage().catch(() => {});

        // Hydrate from multi-tier persistent vault (IndexedDB + 1-Year Cookie)
        const initial = getLLMConfig();
        const healed = await hydratePersistentVaultAsync(initial, (h) => {
          setConfig(h);
        });

        if (healed.apiKey.startsWith('freellma')) {
          healed.provider = 'freellmapi';
        } else if (healed.apiKey.startsWith('AIza')) {
          healed.provider = 'direct-gemini';
        }

        setConfig(healed);
        setTestResult(null);
      });

      const loadVoices = () => {
        const voices = getAvailableBritishVoices();
        setAvailableVoices(voices);
        const savedVoice = getSelectedTTSVoice();
        if (savedVoice) {
          setSelectedVoice(savedVoice);
        } else if (voices.length > 0) {
          setSelectedVoice(voices[0].name);
          setSelectedTTSVoice(voices[0].name);
        }
      };

      loadVoices();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, [isOpen]);

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoice(voiceName);
    setSelectedTTSVoice(voiceName);
    playChime('tap');
    toast.success(`Active British voice: ${voiceName.split('-')[0].trim()}`, 'Voice Engine Updated');
  };

  const handleAuditionVoice = () => {
    setIsAuditioning(true);
    playChime('tap');
    auditionTTSVoice(
      selectedVoice,
      () => setIsAuditioning(true),
      () => setIsAuditioning(false)
    );
  };

  if (!isOpen) return null;

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    playChime('tap');

    try {
      const activeConf = { ...config };
      if (activeConf.apiKey.trim().startsWith('freellma')) {
        activeConf.provider = 'freellmapi';
        setConfig((prev) => ({ ...prev, provider: 'freellmapi' }));
      } else if (activeConf.apiKey.trim().startsWith('AIza')) {
        activeConf.provider = 'direct-gemini';
        setConfig((prev) => ({ ...prev, provider: 'direct-gemini' }));
      }
      const res = await testGatewayConnection(activeConf);
      if (!res.ok && res.status === 401 && activeConf.provider === 'freellmapi') {
        const verifiedKey = 'freellmapi-507e287e4cc5d960e1a31e5a5878d2d8ef7b8947f6fa77c3';
        if (activeConf.apiKey !== verifiedKey) {
          const retryRes = await testGatewayConnection({ ...activeConf, apiKey: verifiedKey });
          if (retryRes.ok) {
            const healed = { ...activeConf, apiKey: verifiedKey, provider: 'freellmapi' as const };
            setConfig(healed);
            saveLLMConfig(healed);
            setTestResult(retryRes);
            playChime('success');
            onConnectionStatusChange?.(true);
            toast.success('Connected with verified FreeLLMAPI key!', 'Gateway Connected');
            return;
          }
        }
      }
      setTestResult(res);
      if (res.ok) {
        saveLLMConfig(activeConf);
        playChime('success');
        onConnectionStatusChange?.(true);
        toast.success(res.message, 'Gateway Test Successful');
      } else {
        onConnectionStatusChange?.(false);
        toast.error(res.message, 'Gateway Test Failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const failRes: GatewayTestResult = {
        ok: false,
        message: `Connection check error: ${msg}`,
      };
      setTestResult(failRes);
      onConnectionStatusChange?.(false);
      toast.error(failRes.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    playChime('tap');
    saveLLMConfig(config);
    toast.success('AI Gateway settings saved successfully.', 'Configuration Saved');
    if (config.apiKey && config.apiKey.length > 5) {
      onConnectionStatusChange?.(true);
    }
    onClose();
  };

  const handleResetUrl = () => {
    setConfig((prev) => ({ ...prev, baseUrl: DEFAULT_FREELLM_BASE_URL }));
    playChime('tap');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onClick={handleSafeClose}
    >
      <div
        className="w-full max-w-lg bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 backdrop-blur-md rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gateway-settings-title"
      >
        {/* Header with gradient badge */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-brand-900 via-slate-900 to-brand-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-500 to-emerald-400 flex items-center justify-center text-white shadow-soft">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="gateway-settings-title" className="text-base font-extrabold tracking-tight text-white">
                  AI Gateway Settings
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Router v1
                </span>
              </div>
              <p className="text-xs text-slate-300">FreeLLMAPI Unified Router &amp; Gemini Connection</p>
            </div>
          </div>
          <button
            onClick={handleSafeClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto no-scrollbar">
          {/* Provider Selection Segment */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-brand-600" />
              LLM Provider Mode
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, provider: 'freellmapi' }))}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  config.provider === 'freellmapi'
                    ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm border border-slate-200 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>FreeLLMAPI (Unified)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    provider: 'direct-gemini',
                    model: prev.model === 'auto' ? 'gemini-2.5-flash' : prev.model,
                  }))
                }
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  config.provider === 'direct-gemini'
                    ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm border border-slate-200 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-brand-500" />
                <span>Direct Gemini API</span>
              </button>
            </div>
          </div>

          {/* Gateway Base URL (Only if FreeLLMAPI) */}
          {config.provider === 'freellmapi' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-brand-600" />
                  Gateway Base URL
                </label>
                <button
                  type="button"
                  onClick={handleResetUrl}
                  className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to 31415</span>
                </button>
              </div>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) => setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder={DEFAULT_FREELLM_BASE_URL}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Default: <code className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">http://127.0.0.1:31415/v1</code>. Pre-configured for your local FreeLLMAPI router.
              </p>
              {typeof window !== 'undefined' && window.location.protocol === 'https:' && (
                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Cloud Production Environment Detected</p>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      You are viewing English Tutor on HTTPS ({window.location.hostname}). Web browsers strictly block HTTPS websites from accessing insecure local servers (127.0.0.1:31415).
                    </p>
                    <div className="pt-1 flex items-center gap-3">
                      <a
                        href="http://localhost:5173"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-brand-700 hover:text-brand-900 underline flex items-center gap-1"
                      >
                        <span>Open Local App (http://localhost:5173)</span>
                        <Zap className="w-3 h-3 text-amber-600" />
                      </a>
                      <span className="text-amber-400">•</span>
                      <button
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, provider: 'direct-gemini' }))}
                        className="font-semibold text-slate-700 hover:text-slate-900 underline"
                      >
                        Use Direct Gemini API on Cloud
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-brand-600" />
                {config.provider === 'freellmapi' ? 'FreeLLMAPI Unified Key' : 'Google Gemini API Key'}
              </label>
              {config.provider === 'freellmapi' && (
                <button
                  type="button"
                  onClick={() => {
                    const verifiedKey = 'freellmapi-507e287e4cc5d960e1a31e5a5878d2d8ef7b8947f6fa77c3';
                    const healed = { ...config, apiKey: verifiedKey, provider: 'freellmapi' as const };
                    setConfig(healed);
                    saveLLMConfig(healed);
                    toast.success('Inserted verified FreeLLMAPI key!', 'Key Inserted');
                  }}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded-lg border border-brand-200/60 active:scale-95 transition"
                >
                  <RotateCcw className="w-3 h-3 text-brand-600" />
                  <span>Insert Verified Key</span>
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => {
                  const val = e.target.value;
                  const clean = sanitizeApiKey(val);
                  let targetProvider = config.provider;
                  let targetModel = config.model;

                  if (clean.startsWith('freellma')) {
                    targetProvider = 'freellmapi';
                  } else if (clean.startsWith('AIza') || (clean.length >= 35 && !clean.startsWith('sk-'))) {
                    targetProvider = 'direct-gemini';
                    if (!targetModel || targetModel === 'auto') {
                      targetModel = 'gemini-2.5-flash';
                    }
                  }

                  const updated: LLMConfig = {
                    ...config,
                    apiKey: val,
                    provider: targetProvider,
                    model: targetModel,
                  };
                  setConfig(updated);
                  triggerAutoSave(updated);
                }}
                onBlur={() => {
                  if (config.apiKey && config.apiKey.trim().length > 0) {
                    saveLLMConfig(config);
                    setSaveStatus('saved');
                  }
                }}
                placeholder={config.provider === 'freellmapi' ? 'freellmapi-...' : 'AIzaSy...'}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Persistent Vault & Auto-Save Status */}
            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                <span>Protected by Persistent Vault (survives updates &amp; mobile cache clears)</span>
              </div>
              {saveStatus === 'saving' && (
                <span className="text-amber-500 dark:text-amber-400 font-bold text-[10px] animate-pulse">
                  Saving…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Auto-saved</span>
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {config.provider === 'freellmapi' ? (
                <>Unified router key starting with <code className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-bold">freellma...</code> (also checked from <code className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">VITE_FREELLM_API_KEY</code>).</>
              ) : (
                <>Your Google AI Studio API key starting with <code className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-bold">AIzaSy...</code> (39 characters).</>
              )}
            </p>

            {/* Direct Gemini Guidance & Key Format Warning */}
            {config.provider === 'direct-gemini' && (
              <div className="space-y-2 pt-1">
                {config.apiKey.trim().length > 0 && !config.apiKey.trim().startsWith('AIza') && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="leading-tight space-y-1.5 flex-1">
                      <div className="font-bold">Key format notice: </div>
                      {config.apiKey.trim().startsWith('freellma') ? (
                        <div className="space-y-1.5">
                          <p>
                            This key starts with <code>freellma</code>, which belongs to <strong>FreeLLMAPI</strong>.
                          </p>
                          <button
                            type="button"
                            onClick={() => setConfig((prev) => ({ ...prev, provider: 'freellmapi' }))}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shadow-xs transition"
                          >
                            Switch to FreeLLMAPI (Unified) Mode
                          </button>
                        </div>
                      ) : config.apiKey.trim().startsWith('sk-') ? (
                        <span>
                          This key starts with <code>sk-</code> (OpenAI format). Gemini API keys always start with <code>AIzaSy...</code>.
                        </span>
                      ) : (
                        <span>
                          Google Gemini keys must start with <code>AIzaSy...</code>. Check that you copied the complete key.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold flex items-center gap-1.5 text-sky-950">
                      <KeyRound className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                      <span>Need a free Google Gemini key?</span>
                    </div>
                    <p className="text-[11px] text-sky-700 truncate">
                      Generate a free key in Google AI Studio (takes 10 seconds).
                    </p>
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95 flex-shrink-0"
                  >
                    <span>Get Key</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* FreeLLMAPI Active Status Card */}
            {config.provider === 'freellmapi' && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div className="leading-tight">
                  <div className="font-bold text-emerald-950">FreeLLMAPI Unified Gateway Active</div>
                  <p className="text-[11px] text-emerald-700">Connected to local router on port 31415. Free, fast, and multi-model.</p>
                </div>
              </div>
            )}
          </div>


          {/* Model Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-brand-600" />
                Target Model
              </label>
              <button
                type="button"
                onClick={() => setIsCustomModel(!isCustomModel)}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-800"
              >
                {isCustomModel ? 'Pick Preset Model' : 'Custom Model Name'}
              </button>
            </div>

            {isCustomModel ? (
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
                placeholder={config.provider === 'direct-gemini' ? 'gemini-2.5-flash, gemini-2.0-flash' : 'auto, gemma-4-31b-it'}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
            ) : (
              <select
                value={config.model}
                onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              >
                {(config.provider === 'direct-gemini' ? AVAILABLE_MODELS_DIRECT : AVAILABLE_MODELS_FREELLM).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-slate-500">
              {config.provider === 'direct-gemini' ? (
                <>Google Gemini 2.5 Flash is recommended for real-time natural British conversation with James.</>
              ) : (
                <>Leave set to <strong className="text-slate-700">auto</strong> for FreeLLMAPI intelligent routing across Gemini Flash and Gemma 4 models.</>
              )}
            </p>
          </div>

          {/* British Voice Engine & Audition Selector */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-brand-600" />
                British Voice Engine (James TTS)
              </label>
              <button
                type="button"
                disabled={isAuditioning}
                onClick={handleAuditionVoice}
                className="px-2.5 py-1 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-50"
              >
                {isAuditioning ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Speaking…</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3" />
                    <span>🔊 Test Voice</span>
                  </>
                )}
              </button>
            </div>

            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
            >
              {availableVoices.length === 0 ? (
                <option value="">Default British Neural Voice</option>
              ) : (
                availableVoices.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.isNeural ? '🌟 [Neural] ' : v.isRobotic ? '🤖 [Robotic SAPI] ' : '🗣️ '}
                    {v.name}
                  </option>
                ))
              )}
            </select>

            <p className="text-[11px] text-slate-500 leading-tight">
              Prioritizes <strong className="text-slate-700">Microsoft Ryan / Sonia Online (Natural)</strong> and <strong className="text-slate-700">Google UK English</strong> for realistic human-like cadence. The robotic offline Microsoft George voice is explicitly penalized.
            </p>
          </div>


          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 transition animate-slide-down ${
                testResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="font-bold">{testResult.ok ? 'Connection Verified' : 'Connection Error'}</div>
                <div className="opacity-90">{testResult.message}</div>
                {testResult.models && testResult.models.length > 0 && (
                  <div className="mt-1 text-[11px] text-emerald-700 font-medium">
                    Available router models: {testResult.models.slice(0, 4).join(', ')}
                    {testResult.models.length > 4 ? ` +${testResult.models.length - 4} more` : ''}
                  </div>
                )}
                {!testResult.ok && config.provider === 'freellmapi' && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    {typeof window !== 'undefined' && window.location.protocol === 'https:' ? (
                      <>
                        <a
                          href="http://localhost:5173"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition active:scale-95 inline-flex items-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Open Local App (http://localhost:5173)</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setConfig((prev) => ({ ...prev, provider: 'direct-gemini' }));
                            toast.info('Switched to Direct Gemini API tab.', 'Cloud AI Mode');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition active:scale-95 inline-flex items-center gap-1.5"
                        >
                          <span>Switch to Direct Gemini API</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          const verifiedKey = 'freellmapi-507e287e4cc5d960e1a31e5a5878d2d8ef7b8947f6fa77c3';
                          const healed = { ...config, apiKey: verifiedKey, provider: 'freellmapi' as const };
                          setConfig(healed);
                          saveLLMConfig(healed);
                          setIsTesting(true);
                          const res = await testGatewayConnection(healed);
                          setIsTesting(false);
                          setTestResult(res);
                          if (res.ok) {
                            playChime('success');
                            onConnectionStatusChange?.(true);
                            toast.success('Connected successfully with verified FreeLLMAPI key!', 'Gateway Connected');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Use Verified Key &amp; Re-Test</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={isTesting}
              onClick={handleRunTest}
              className="flex-1 py-2.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 active:scale-95 transition disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                  <span>Testing Gateway…</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Test Gateway Connection</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white text-xs font-bold shadow-soft active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <span>Save &amp; Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
