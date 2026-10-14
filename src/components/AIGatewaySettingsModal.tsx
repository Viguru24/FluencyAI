import React, { useState } from 'react';
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
} from 'lucide-react';

import {
  getLLMConfig,
  saveLLMConfig,
  testGatewayConnection,
  DEFAULT_FREELLM_BASE_URL,
  AVAILABLE_MODELS,
  AVAILABLE_MODELS_DIRECT,
  AVAILABLE_MODELS_FREELLM,
  type LLMConfig,
  type GatewayTestResult,
} from '../services/llmConfig';

import { toast } from '../services/toast';
import { playChime } from '../services/speech';

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
  const [isCustomModel, setIsCustomModel] = useState(() => {
    const current = getLLMConfig();
    return !AVAILABLE_MODELS.some((m) => m.id === current.model);
  });

  if (!isOpen) return null;

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    playChime('tap');

    try {
      const res = await testGatewayConnection(config);
      setTestResult(res);
      if (res.ok) {
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
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden animate-slide-up"
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
            onClick={onClose}
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
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-brand-600" />
              LLM Provider Mode
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, provider: 'freellmapi' }))}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  config.provider === 'freellmapi'
                    ? 'bg-white text-brand-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
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
                    ? 'bg-white text-brand-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
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
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-brand-600" />
                  Gateway Base URL
                </label>
                <button
                  type="button"
                  onClick={handleResetUrl}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
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
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
              <p className="text-[11px] text-slate-500">
                Default: <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">http://127.0.0.1:31415/v1</code>. Pre-configured for your local FreeLLMAPI router.
              </p>
            </div>
          )}

          {/* API Key Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-brand-600" />
              {config.provider === 'freellmapi' ? 'FreeLLMAPI Unified Key' : 'Google Gemini API Key'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => {
                  const val = e.target.value;
                  const clean = val.trim();
                  setConfig((prev) => {
                    let targetProvider = prev.provider;
                    if (clean.startsWith('freellma')) {
                      targetProvider = 'freellmapi';
                    } else if (clean.startsWith('AIza')) {
                      targetProvider = 'direct-gemini';
                    }
                    return {
                      ...prev,
                      apiKey: val,
                      provider: targetProvider,
                    };
                  });
                }}
                placeholder={config.provider === 'freellmapi' ? 'freellmapi-...' : 'AIzaSy...'}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {config.provider === 'freellmapi' ? (
                <>Unified router key starting with <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-bold">freellma...</code> (also checked from <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">VITE_FREELLM_API_KEY</code>).</>
              ) : (
                <>Your Google AI Studio API key starting with <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-bold">AIzaSy...</code> (39 characters).</>
              )}
            </p>

            {/* Direct Gemini Guidance & Key Format Warning */}
            {config.provider === 'direct-gemini' && (
              <div className="space-y-2 pt-1">
                {config.apiKey.trim().length > 0 && !config.apiKey.trim().startsWith('AIza') && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="leading-tight">
                      <span className="font-bold">Key format notice: </span>
                      {config.apiKey.trim().startsWith('freellma') ? (
                        <span>
                          This key starts with <code>freellma</code>, which belongs to <strong>FreeLLMAPI</strong>. Switch to the <strong>FreeLLMAPI (Unified)</strong> tab above.
                        </span>
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
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={isTesting}
              onClick={handleRunTest}
              className="flex-1 py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 border border-slate-200 active:scale-95 transition disabled:opacity-50"
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
