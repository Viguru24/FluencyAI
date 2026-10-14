import React from 'react';
import { Play, Sparkles, Check, Zap, ArrowRight } from 'lucide-react';
import { playChime } from '../services/speech';

interface StartDailyLessonFABProps {
  onStartLesson: () => void;
  isCompletedToday: boolean;
}

export const StartDailyLessonFAB: React.FC<StartDailyLessonFABProps> = ({
  onStartLesson,
  isCompletedToday,
}) => {
  const handleClick = () => {
    playChime('tap');
    onStartLesson();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none px-4 pb-4 pt-6 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent backdrop-blur-[2px]">
      <button
        onClick={handleClick}
        className="pointer-events-auto w-full max-w-md group relative flex items-center justify-between px-5 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 via-sky-500 to-emerald-500 hover:from-brand-700 hover:to-emerald-600 text-white font-extrabold text-sm shadow-fab hover:shadow-soft-lg transform transition-all duration-200 active:scale-98 border border-white/30 backdrop-blur-md"
        aria-label="Start Daily Lesson"
      >
        {/* Pulsing ring indicator */}
        <span className="absolute -inset-0.5 rounded-2xl bg-brand-400 opacity-25 group-hover:opacity-50 blur-sm animate-pulse-subtle pointer-events-none" />

        <div className="relative flex items-center gap-3">
          {/* Icon */}
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 text-white flex-shrink-0 shadow-inner">
            {isCompletedToday ? (
              <Check className="w-5 h-5 text-emerald-100" />
            ) : (
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            )}
          </div>

          {/* Text Details */}
          <div className="text-left leading-tight">
            <div className="text-sm font-black tracking-wide flex items-center gap-1.5">
              <span>{isCompletedToday ? 'Review Daily Lesson' : 'Start Daily Lesson'}</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse-subtle" />
            </div>
            <div className="text-[11px] font-semibold text-brand-100 flex items-center gap-1 mt-0.5">
              <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
              <span>5 min sprint • +35 XP</span>
            </div>
          </div>
        </div>

        {/* Right CTA pill */}
        <div className="relative flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-white/20 group-hover:bg-white/30 transition text-white">
          <span>{isCompletedToday ? 'Review' : 'Start'}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>
    </div>
  );
};
