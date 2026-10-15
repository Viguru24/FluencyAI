import React, { useState, useEffect } from 'react';
import { Flame, Mic, Sparkles, Layers, Zap, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { UserProgress } from '../types';
import { playChime } from '../services/speech';
import { FluencyHeatmap } from './FluencyHeatmap';
import { getDueSRSFlashcards } from '../services/srsService';

interface DailyGoalCardProps {
  progress: UserProgress;
  onUpdateProgress: (updater: (prev: UserProgress) => UserProgress) => void;
  onStartLesson?: () => void;
  onOpenSRS?: () => void;
  onOpenWarmup?: () => void;
}

export const DailyGoalCard: React.FC<DailyGoalCardProps> = ({
  progress,
  onStartLesson,
  onOpenSRS,
  onOpenWarmup,
}) => {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [srsDueCount, setSrsDueCount] = useState(() => getDueSRSFlashcards().length);
  const [reviewCount, setReviewCount] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('savedReviewPhrases');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.length;
      }
    } catch {
      /* ignore */
    }
    return (progress.savedMistakes?.length && progress.savedMistakes.length > 0) ? progress.savedMistakes.length : 3;
  });

  useEffect(() => {
    const updateCount = () => {
      try {
        const stored = localStorage.getItem('savedReviewPhrases');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setReviewCount(parsed.length);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setReviewCount((progress.savedMistakes?.length && progress.savedMistakes.length > 0) ? progress.savedMistakes.length : 3);
      setSrsDueCount(getDueSRSFlashcards().length);
    };

    window.addEventListener('savedReviewPhrasesUpdated', updateCount);
    window.addEventListener('fluency_srs_updated', updateCount);
    window.addEventListener('storage', updateCount);
    return () => {
      window.removeEventListener('savedReviewPhrasesUpdated', updateCount);
      window.removeEventListener('fluency_srs_updated', updateCount);
      window.removeEventListener('storage', updateCount);
    };
  }, [progress.savedMistakes]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const minutesPercent = Math.min(
    100,
    Math.round((progress.completedMinutes / progress.dailyGoalMinutes) * 100)
  );

  const isGoalReached = progress.completedMinutes >= progress.dailyGoalMinutes;

  return (
    <div className="w-full space-y-3">
      {/* Welcoming Header Banner */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {getGreeting()}, {progress.name}!
            </h1>
            <span className="inline-block animate-bounce-subtle text-xl">🌱</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Consistency over perfection. Speak a little every day!
          </p>
        </div>

        {/* Streak Counter Pill */}
        <div 
          onClick={() => {
            playChime('streak');
            confetti({ particleCount: 30, spread: 50, origin: { y: 0.2 } });
          }}
          className="cursor-pointer group flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200/80 shadow-sm transition active:scale-95"
          title="Click to celebrate streak!"
        >
          <Flame className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse-subtle group-hover:scale-110 transition-transform" />
          <div className="text-right">
            <div className="text-xs font-black text-amber-900 leading-none">
              {progress.streakDays} Days
            </div>
            <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">
              Streak
            </div>
          </div>
        </div>
      </div>

      {/* Main Daily Goal Progress Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-brand-50/30 to-emerald-50/40 p-5 shadow-soft border border-slate-200/80">
        {/* Subtle decorative background blur glow */}
        <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-brand-200/40 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-emerald-200/40 blur-2xl" />

        <div className="relative z-10 space-y-4">
          {/* Progress Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-100 text-brand-700">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Daily Speaking Goal
                </span>
                <div className="text-sm font-extrabold text-slate-900">
                  {progress.completedMinutes} of {progress.dailyGoalMinutes} mins spoken
                </div>
              </div>
            </div>

            {/* Percentage Badge */}
            <div className={`px-2.5 py-1 rounded-full text-xs font-black tracking-wide border ${
              isGoalReached 
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                : 'bg-brand-50 text-brand-700 border-brand-200'
            }`}>
              {minutesPercent}%
            </div>
          </div>

          {/* Progress Bar with smooth soft gradient & glow */}
          <div className="space-y-1.5">
            <div className="w-full h-3.5 rounded-full bg-slate-100/90 overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 via-sky-400 to-emerald-400 transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${minutesPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Goal: 15 mins daily practice</span>
              <span>{Math.max(0, progress.dailyGoalMinutes - progress.completedMinutes)} mins remaining</span>
            </div>
          </div>

          {/* Encouraging Context Message */}
          <div className="rounded-2xl bg-white/80 border border-slate-200/60 p-3 flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isGoalReached ? (
                <span className="font-semibold text-emerald-700">
                  🎉 Phenomenal job today! You unlocked today's fluency badge and protected your streak.
                </span>
              ) : (
                <span>
                  <strong className="text-slate-800">Speaking out loud</strong> creates neural pathways faster than reading alone. Tap any scenario below to practice!
                </span>
              )}
            </p>
          </div>

          {/* Goal Milestones Row */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2.5 rounded-2xl bg-white/90 border border-slate-200/60 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase">XP Today</div>
              <div className="text-sm font-black text-brand-600 mt-0.5">
                {progress.completedXP}/{progress.dailyGoalXP}
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-white/90 border border-slate-200/60 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Fluency CEFR</div>
              <div className="text-sm font-black text-emerald-600 mt-0.5">
                Level {progress.level}
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-white/90 border border-slate-200/60 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Pronunciation Avg
              </div>
              <div className="text-sm font-black text-emerald-600 mt-0.5 flex items-center justify-center gap-1">
                <span>88%</span>
              </div>
            </div>
          </div>

          {/* Quick Immersion Actions: 60s Sprint & SRS Flashcards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {onOpenWarmup && (
              <button
                onClick={onOpenWarmup}
                className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-rose-500/10 hover:from-amber-500/20 hover:to-rose-500/20 border border-amber-300/80 text-amber-950 text-xs font-bold flex items-center justify-between transition shadow-2xs group active:scale-95"
              >
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                    <Zap className="w-3.5 h-3.5 animate-pulse" />
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block font-extrabold text-amber-950">60s Spoken Sprint</span>
                    <span className="text-[10px] text-amber-700 font-medium">Rapid warm-up · +50 XP</span>
                  </span>
                </span>
                <span className="text-xs text-amber-600 font-extrabold group-hover:translate-x-0.5 transition-transform">&rarr;</span>
              </button>
            )}

            {onOpenSRS && (
              <button
                onClick={onOpenSRS}
                className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-200 text-indigo-950 text-xs font-bold flex items-center justify-between transition shadow-2xs group active:scale-95"
              >
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Layers className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block font-extrabold text-indigo-950">SRS Flashcards</span>
                    <span className="text-[10px] text-indigo-700 font-medium">{srsDueCount} cards due for recall</span>
                  </span>
                </span>
                <span className="text-xs text-indigo-600 font-extrabold group-hover:translate-x-0.5 transition-transform">&rarr;</span>
              </button>
            )}
          </div>

          {/* Spaced repetition review banner */}
          {onStartLesson && (
            <button
              onClick={onStartLesson}
              className="w-full py-2.5 px-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 text-xs font-bold flex items-center justify-between transition shadow-xs group"
            >
              <span className="flex items-center gap-2 text-left">
                <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-amber-200 text-amber-800 flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                </span>
                <span>
                  <strong className="text-amber-900 font-extrabold">Full Lesson Plan:</strong>{' '}
                  <span className="text-slate-700 font-semibold">{reviewCount} phrases ready for practice</span>
                </span>
              </span>
              <span className="text-[11px] font-bold text-amber-700 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 flex-shrink-0">
                Start Lesson &rarr;
              </span>
            </button>
          )}

          {/* Toggle 365-Day Fluency Heatmap */}
          <div className="pt-1">
            <button
              onClick={() => setShowHeatmap((prev) => !prev)}
              className="w-full py-2 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-98"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>{showHeatmap ? 'Hide Immersion Heatmap' : 'View 365-Day Speaking Heatmap'}</span>
              {showHeatmap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Heatmap Component */}
      {showHeatmap && (
        <div className="animate-fade-in pt-1">
          <FluencyHeatmap />
        </div>
      )}
    </div>
  );
};
