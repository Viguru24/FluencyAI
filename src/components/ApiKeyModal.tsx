import React, { useState } from 'react';
import { Key, Check, Trash2, X, ExternalLink, ShieldCheck } from 'lucide-react';
import { getGeminiApiKey, saveGeminiApiKey } from '../services/geminiService';
import { toast } from '../services/toast';
import { playChime } from '../services/speech';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const currentKey = isOpen ? getGeminiApiKey() : null;
  const [apiKey, setApiKey] = useState(() => getGeminiApiKey() || '');
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.warning('Please enter a valid Gemini API key.');
      return;
    }

    if (!trimmed.startsWith('AIza')) {
      toast.warning('Gemini API keys typically start with "AIza". Check that you copied the full key.');
    }

    saveGeminiApiKey(trimmed);
    setApiKey(trimmed);
    playChime('success');
    toast.success('Gemini 2.5 Flash connected! AI Brain is now Live.', 'API Key Saved');
    onClose();
  };

  const handleRemove = () => {
    saveGeminiApiKey('');
    setApiKey('');
    playChime('tap');
    toast.info('API key removed. Running in offline/mock mode.', 'Key Cleared');
  };

  const maskedKey = currentKey
    ? `${currentKey.slice(0, 6)}••••••••••••${currentKey.slice(-4)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-brand-600 via-sky-600 to-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight">AI Brain Connection</h2>
              <p className="text-[11px] text-brand-100 font-medium">Powered by Google Gemini 2.5 Flash</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Current Status Pill */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
              currentKey
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  currentKey ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{currentKey ? '🟢 Gemini 2.5 Live' : '🔴 Offline / Mock Mode'}</span>
            </div>
            {maskedKey && (
              <span className="font-mono text-[11px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                {maskedKey}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Connect your personal Google Gemini API key so James can hold sharp, intelligent conversations,
            react to your actual voice recordings, and deliver custom pronunciation coaching.
          </p>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste AIzaSy... key here"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs font-mono text-slate-800 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Stored locally in your browser (<code>fluency_gemini_api_key</code>).
            </p>
          </div>

          {/* AI Studio Link Helper */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Need a free Gemini API key?</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-brand-600 hover:underline"
            >
              Get one from Google AI Studio <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 pb-5 pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
          {currentKey && (
            <button
              onClick={handleRemove}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition active:scale-95 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Disconnect Key
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-soft transition active:scale-95 flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" /> Save &amp; Connect
          </button>
        </div>
      </div>
    </div>
  );
};
