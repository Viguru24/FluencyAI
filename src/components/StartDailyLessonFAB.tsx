import React from 'react';
import { Play, Sparkles, Check, Zap } from 'lucide-react';
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
    <div className="fixed bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none px-4">
      <button
        onClick={handleClick}
        className="pointer-events-auto group relative flex items-center gap-3 px-5 py-3.5 rounded-full bg-gradient-to-r from-brand-600 via-sky-500 to-emerald-500 hover:from-brand-700 hover:to-emerald-600 text-white font-extrabold text-sm shadow-fab hover:shadow-soft-lg transform transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-white/40 backdrop-blur-md"
        aria-label="Start Daily Lesson"
      >
        {/* Pulsing ring indicator */}
        <span className="absolute -inset-1 rounded-full bg-brand-400 opacity-30 group-hover:opacity-60 blur-sm animate-pulse-subtle pointer-events-none" />

        {/* Icon */}
        <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white">
          {isCompletedToday ? (
            <Check className="w-5 h-5 text-emerald-100" />
          ) : (
            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          )}
        </div>

        {/* Text Details */}
        <div className="relative text-left leading-tight">
          <div className="text-xs font-black tracking-wide flex items-center gap-1.5">
            <span>{isCompletedToday ? 'Review Daily Lesson' : 'Start Daily Lesson'}</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse-subtle" />
          </div>
          <div className="text-[10px] font-semibold text-brand-100 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
            <span>5 min sprint • +35 XP</span>
          </div>
        </div>
      </button>
    </div>
  );
};
