import React from 'react';
import { X, Download, Share, PlusSquare, Smartphone, Sparkles } from 'lucide-react';
import { promptPWAInstall } from '../pwa';
import { playChime } from '../services/speech';

interface PWAInstallGuideModalProps {
  onClose: () => void;
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({ onClose }) => {
  const handleDirectInstall = async () => {
    playChime('tap');
    const outcome = await promptPWAInstall();
    if (outcome === 'accepted') {
      playChime('success');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-brand-600 to-sky-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-amber-300" />
            <h3 className="font-extrabold text-base">Install FluencyAI App</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-white flex items-center justify-center mx-auto shadow-soft">
              <Sparkles className="w-7 h-7 text-amber-200 animate-pulse-subtle" />
            </div>
            <h4 className="font-extrabold text-base text-slate-900 pt-2">
              Practice English Anytime, Offline & Fullscreen
            </h4>
            <p className="text-xs text-slate-500">
              Add FluencyAI to your home screen for instant zero-lag access, offline lessons, and audio roleplays.
            </p>
          </div>

          {/* Quick Install Button */}
          <button
            onClick={handleDirectInstall}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-extrabold text-xs shadow-soft transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Install Immediately</span>
          </button>

          {/* Instructions by Platform */}
          <div className="space-y-3 pt-1 text-xs">
            {/* iOS Safari */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-200 text-[10px] flex items-center justify-center">🍎</span>
                <span>iPhone & iPad (Safari)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] pl-1">
                <li>Tap the <strong className="text-slate-800">Share</strong> icon at the bottom of Safari (<Share className="w-3 h-3 inline text-brand-600" />)</li>
                <li>Scroll down and tap <strong className="text-slate-800">Add to Home Screen</strong> (<PlusSquare className="w-3 h-3 inline text-brand-600" />)</li>
                <li>Tap <strong className="text-slate-800">Add</strong> in the top right corner</li>
              </ol>
            </div>

            {/* Android */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-100 text-[10px] flex items-center justify-center">🤖</span>
                <span>Android (Chrome & Edge)</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Tap the three dots (<strong>⋮</strong>) menu and select <strong className="text-slate-800">Install app</strong> or <strong className="text-slate-800">Add to Home screen</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};
