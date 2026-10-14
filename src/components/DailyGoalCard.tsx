import React from 'react';
import { Flame, Mic, Sparkles, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { UserProgress } from '../types';
import { playChime } from '../services/speech';

interface DailyGoalCardProps {
  progress: UserProgress;
  onUpdateProgress: (updater: (prev: UserProgress) => UserProgress) => void;
  onStartLesson?: () => void;
}

export const DailyGoalCard: React.FC<DailyGoalCardProps> = ({
  progress,
  onUpdateProgress,
  onStartLesson,
}) => {
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

  const handleQuickPractice = () => {
    playChime('success');
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#0ea5e9', '#10b981', '#fbbf24', '#38bdf8'],
    });

    onUpdateProgress((prev) => {
      const nextMinutes = Math.min(prev.dailyGoalMinutes, prev.completedMinutes + 2);
      const nextXP = Math.min(prev.dailyGoalXP, prev.completedXP + 10);
      return {
        ...prev,
        completedMinutes: nextMinutes,
        completedXP: nextXP,
      };
    });
  };

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

            <button
              onClick={handleQuickPractice}
              className="p-2.5 rounded-2xl bg-gradient-to-r from-brand-50 to-sky-50 hover:from-brand-100 hover:to-sky-100 border border-brand-200 text-center transition active:scale-95 group"
              title="Add 2 minutes speaking test"
            >
              <div className="text-[10px] font-bold text-brand-700 uppercase flex items-center justify-center gap-1">
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>+2 Mins</span>
              </div>
              <div className="text-xs font-bold text-brand-900 mt-0.5 group-hover:text-brand-600">
                Log Speak
              </div>
            </button>
          </div>

          {/* Quick link to start daily lesson if uncompleted */}
          {!progress.hasCompletedDailyLessonToday && onStartLesson && (
            <button
              onClick={onStartLesson}
              className="w-full py-2.5 px-3 rounded-2xl bg-brand-50 hover:bg-brand-100 border border-brand-200/80 text-brand-700 text-xs font-bold flex items-center justify-between transition"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                <span>Today's 5-minute Fluency Sprint is ready</span>
              </span>
              <span className="text-[11px] underline">Start now &rarr;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
