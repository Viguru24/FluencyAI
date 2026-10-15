import React, { useState, useEffect } from 'react';
import { Sparkles, Flame, Mic, X } from 'lucide-react';
import type { XPCalculationResult } from '../store/rewardSystem';
import { playChime } from '../services/speech';

export const XPToastContainer: React.FC = () => {
  const [activeToast, setActiveToast] = useState<XPCalculationResult | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let hideTimer: number | null = null;
    let removeTimer: number | null = null;

    const handleXPAwarded = (e: Event) => {
      const customEvt = e as CustomEvent<XPCalculationResult>;
      if (!customEvt.detail) return;

      playChime('success');

      if (hideTimer) clearTimeout(hideTimer);
      if (removeTimer) clearTimeout(removeTimer);

      setActiveToast(customEvt.detail);
      setIsVisible(true);

      // Auto dismiss after 4.2 seconds
      hideTimer = window.setTimeout(() => {
        setIsVisible(false);
        removeTimer = window.setTimeout(() => {
          setActiveToast(null);
        }, 300);
      }, 4200);
    };

    window.addEventListener('fluency_xp_awarded', handleXPAwarded);

    return () => {
      window.removeEventListener('fluency_xp_awarded', handleXPAwarded);
      if (hideTimer) clearTimeout(hideTimer);
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, []);

  if (!activeToast) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92vw] sm:w-auto transition-all duration-300 pointer-events-auto select-none ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
      }`}
    >
      <div className="relative overflow-hidden rounded-3xl bg-slate-900/95 border border-amber-400/50 text-white p-3.5 sm:px-5 sm:py-3.5 shadow-2xl backdrop-blur-xl flex items-center gap-3.5">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-amber-500/25 blur-xl" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-emerald-500/25 blur-xl" />

        {/* Big XP Pill Icon */}
        <div className="relative flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-slate-950 flex flex-col items-center justify-center font-black shadow-lg shadow-amber-500/30">
          <Sparkles className="w-4 h-4 text-slate-950 animate-pulse" />
          <span className="text-[10px] leading-none uppercase font-extrabold tracking-tight">XP</span>
        </div>

        {/* Content & Breakdown */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-black text-amber-300 tracking-tight">
              +{activeToast.totalEarnedXP} XP Earned!
            </span>
            <span className="text-[10px] font-bold text-slate-300 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 truncate">
              {activeToast.activityLabel}
            </span>
          </div>

          {/* Breakdown tags */}
          <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold text-slate-300">
            <span className="text-slate-300">+{activeToast.baseXP} Base</span>

            {activeToast.streakBonusXP > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md">
                <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                +{activeToast.streakBonusXP} Streak ({activeToast.streakMultiplier}x)
              </span>
            )}

            {activeToast.pronunciationBonusXP > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                <Mic className="w-3 h-3 text-emerald-400" />
                +{activeToast.pronunciationBonusXP} Pronunciation
              </span>
            )}
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          aria-label="Dismiss XP notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
