import React, { useState, useEffect } from 'react';
import {
  Flame,
  Mic,
  Layers,
  Zap,
  Calendar,
  ChevronDown,
  ChevronUp,
  Gift,
  MessageCircle,
  Play,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { AIPersona, UserProgress } from '../types';
import { playChime } from '../services/speech';
import { FluencyHeatmap } from './FluencyHeatmap';
import { getDueSRSFlashcards, getUserSavedSRSCards } from '../services/srsService';
import { formatDisplayName } from '../utils/nameFormatter';
import { useGamificationStore } from '../store/rewardSystem';

interface DailyGoalCardProps {
  progress: UserProgress;
  activePersona?: AIPersona;
  onUpdateProgress: (updater: (prev: UserProgress) => UserProgress) => void;
  onStartLesson?: () => void;
  onStartDirectRoleplay?: () => void;
  onOpenFreeTalk?: () => void;
  onOpenSRS?: () => void;
  onOpenWarmup?: () => void;
  onOpenRoadmap?: () => void;
}

export const DailyGoalCard: React.FC<DailyGoalCardProps> = ({
  progress,
  activePersona,
  onStartLesson,
  onStartDirectRoleplay,
  onOpenFreeTalk,
  onOpenSRS,
  onOpenWarmup,
  onOpenRoadmap,
}) => {
  const {
    dailyXP,
    dailyXPTarget,
    speakingMinutesToday,
    speakingMinutesTarget,
    streakDays,
    pronunciationAvg,
    currentTierConfig,
    multiplierInfo,
    dailyChestClaimed,
    isDailyGoalMet,
    claimChest,
  } = useGamificationStore();

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [srsDueCount, setSrsDueCount] = useState(() => getDueSRSFlashcards().length);
  const [savedReviewCount, setSavedReviewCount] = useState(() => getUserSavedSRSCards().length);

  useEffect(() => {
    const updateCount = () => {
      setSrsDueCount(getDueSRSFlashcards().length);
      setSavedReviewCount(getUserSavedSRSCards().length);
    };

    window.addEventListener('fluency_srs_updated', updateCount);
    window.addEventListener('storage', updateCount);
    return () => {
      window.removeEventListener('fluency_srs_updated', updateCount);
      window.removeEventListener('storage', updateCount);
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const currentMinutes = Math.max(progress.completedMinutes, speakingMinutesToday);
  const minutesPercent = Math.min(
    100,
    Math.round((currentMinutes / speakingMinutesTarget) * 100)
  );

  const isGoalReached = currentMinutes >= speakingMinutesTarget;
  const coachName = activePersona?.name || 'James';
  const coachAvatar = activePersona?.avatar || '🧑‍💼';

  return (
    <div className="w-full space-y-4">
      {/* Welcoming Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-snug break-words">
            {getGreeting()}, {formatDisplayName(progress.name)}!
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
            Consistency over perfection. Speak a little every day!
          </p>
        </div>

        {/* Tier Pill & Streak Counter Pills */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              playChime('tap');
              onOpenRoadmap?.();
            }}
            className={`flex-1 sm:flex-initial justify-center sm:justify-start cursor-pointer group flex items-center gap-2 px-3 py-1.5 rounded-2xl border shadow-xs transition active:scale-95 ${currentTierConfig.badgeAccent.pillBg}`}
            title={`Current Rank: ${currentTierConfig.name} • Click to open Rewards Roadmap`}
          >
            <span className="text-base group-hover:scale-110 transition-transform">
              {currentTierConfig.badgeAccent.icon}
            </span>
            <div className="text-left">
              <div className="text-xs font-black tracking-tight leading-none text-slate-900 dark:text-white">
                {currentTierConfig.shortName}
              </div>
              <div className="text-[9px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-0.5">
                Fluency Tier
              </div>
            </div>
          </button>

          <div
            onClick={() => {
              playChime('streak');
              confetti({ particleCount: 30, spread: 50, origin: { y: 0.2 } });
            }}
            className="flex-1 sm:flex-initial justify-center sm:justify-start cursor-pointer group flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 dark:bg-amber-950/70 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200/80 dark:border-amber-700/80 shadow-xs transition active:scale-95"
            title="Click to celebrate streak!"
          >
            <Flame className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse-subtle group-hover:scale-110 transition-transform" />
            <div className="text-left sm:text-right">
              <div className="text-xs font-black text-amber-900 dark:text-amber-100 leading-none">
                {streakDays} Days
              </div>
              <div className="text-[9px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                Streak
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Hero Card: Today's Guided Session (Standalone Card, Full Width, Un-squashed) */}
      {onStartLesson && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-indigo-600 to-sky-600 p-4 sm:p-5 text-white shadow-soft border border-white/20">
          <div className="pointer-events-none absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-sky-400/20 blur-2xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[10px] font-black uppercase tracking-wider text-white">
                  Today&apos;s Guided Session
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-black tracking-wide">
                  ⚡ 3 min • +45 XP
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white leading-snug">
                {progress.hasCompletedDailyLessonToday
                  ? 'Daily Lesson Completed — Practice Again!'
                  : `Daily 3-Stage Lesson with ${coachName}`}
              </h2>
              <p className="text-xs sm:text-sm text-brand-100/90 leading-relaxed max-w-2xl">
                {savedReviewCount > 0
                  ? `Includes ${Math.min(2, savedReviewCount)} saved phrase${savedReviewCount === 1 ? '' : 's'} + live voice roleplay & AI scorecard`
                  : 'Phrase warm-up → Live voice roleplay → AI fluency scorecard'}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:shrink-0 w-full sm:w-auto">
              <button
                onClick={() => {
                  playChime('tap');
                  onStartLesson();
                }}
                className="flex-1 sm:flex-initial py-3 px-4 sm:px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95 group"
              >
                <Play className="w-4 h-4 fill-slate-950 text-slate-950 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-slate-950 whitespace-nowrap">Start Today&apos;s Lesson</span>
              </button>

              {onStartDirectRoleplay && (
                <button
                  onClick={() => {
                    playChime('tap');
                    onStartDirectRoleplay();
                  }}
                  className="py-3 px-3.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-black text-xs sm:text-sm transition active:scale-95 shrink-0 whitespace-nowrap"
                  title="Skip warm-up phrases and jump straight into Stage 2 Roleplay"
                >
                  ⚡ Skip Prep
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Standalone Daily Speaking Goal & Progress Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-soft border border-slate-200/80 dark:border-slate-800 space-y-4">
        {/* Progress Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 text-white shadow-soft shadow-brand-500/30 flex-shrink-0">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Daily Speaking Goal
              </span>
              <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                {currentMinutes} of {speakingMinutesTarget} mins spoken
              </div>
            </div>
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wide border shadow-2xs flex items-center gap-1 flex-shrink-0 ${
              isGoalReached
                ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/40 dark:border-emerald-500/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">Done</span>
            <span className="text-brand-600 dark:text-sky-300 font-black">{minutesPercent}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 via-sky-400 to-emerald-400 transition-all duration-700 ease-out shadow-sm"
              style={{ width: `${minutesPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>Goal: {speakingMinutesTarget} mins daily</span>
            <span>{Math.max(0, speakingMinutesTarget - currentMinutes)} mins remaining</span>
          </div>
        </div>

        {/* Goal Milestones Row */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="relative p-2 sm:p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-center flex flex-col justify-between group shadow-2xs hover:border-brand-300 dark:hover:border-brand-500 transition min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-black text-slate-700 dark:text-slate-100 uppercase tracking-wider truncate">
                XP Today
              </span>
              <button
                onClick={() => {
                  if (!dailyChestClaimed && isDailyGoalMet) {
                    playChime('success');
                    confetti({ particleCount: 70, spread: 70, origin: { y: 0.5 } });
                    claimChest();
                  } else {
                    playChime('tap');
                    onOpenRoadmap?.();
                  }
                }}
                title={
                  dailyChestClaimed
                    ? "Today's Daily Milestone Chest Claimed ✓ (+50 XP bonus)"
                    : isDailyGoalMet
                    ? '🎁 Daily Milestone Chest Ready! Tap to claim +50 XP bonus'
                    : `🎁 Daily Chest: reach ${dailyXPTarget} XP & ${speakingMinutesTarget} mins to unlock`
                }
                className={`p-0.5 sm:p-1 rounded-lg transition active:scale-95 shrink-0 ${
                  dailyChestClaimed
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
                    : isDailyGoalMet
                    ? 'text-amber-500 bg-amber-100 dark:bg-amber-950/60 ring-2 ring-amber-400 animate-bounce'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Gift className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isDailyGoalMet && !dailyChestClaimed ? 'animate-pulse' : ''}`} />
              </button>
            </div>

            <div className="text-sm sm:text-base font-black text-brand-600 dark:text-sky-300 my-0.5 truncate">
              {dailyXP}/{dailyXPTarget}
            </div>

            <div className="text-[9px] sm:text-[10px] font-black text-amber-950 dark:text-amber-100 bg-amber-200 dark:bg-amber-900/80 border border-amber-300 dark:border-amber-600 rounded-md py-0.5 px-1 truncate flex items-center justify-center gap-0.5">
              <span className="truncate">{multiplierInfo.label}</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-center flex flex-col justify-between shadow-2xs min-w-0">
            <div className="text-[10px] sm:text-[11px] font-black text-slate-700 dark:text-slate-100 uppercase tracking-wider truncate">
              Fluency CEFR
            </div>
            <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-300 my-0.5 truncate">
              Level {progress.level}
            </div>
            <div className="text-[9px] sm:text-[10px] font-black text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-500 rounded-md py-0.5 px-1 truncate">
              {currentTierConfig.shortName}
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-center flex flex-col justify-between shadow-2xs min-w-0">
            <div className="text-[10px] sm:text-[11px] font-black text-slate-700 dark:text-slate-100 uppercase tracking-wider truncate">
              <span className="sm:hidden">Clarity</span>
              <span className="hidden sm:inline">Pronunciation</span>
            </div>
            <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-300 my-0.5 truncate">
              {pronunciationAvg}%
            </div>
            <div className="text-[9px] sm:text-[10px] font-black text-emerald-950 dark:text-emerald-100 bg-emerald-200 dark:bg-emerald-900/80 border border-emerald-300 dark:border-emerald-600 rounded-md py-0.5 px-1 truncate">
              {pronunciationAvg >= 90
                ? '💎 +25% Bonus'
                : pronunciationAvg >= 85
                ? '✨ +10% Bonus'
                : 'Standard'}
            </div>
          </div>
        </div>

        {/* Toggle 365-Day Fluency Heatmap */}
        <div className="pt-0.5">
          <button
            onClick={() => setShowHeatmap((prev) => !prev)}
            className="w-full py-2.5 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-98"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{showHeatmap ? 'Hide Immersion Heatmap' : 'View 365-Day Speaking Heatmap'}</span>
            {showHeatmap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {showHeatmap && (
        <div className="animate-fade-in pt-1">
          <FluencyHeatmap />
        </div>
      )}

      {/* Standalone Quick Practice Section (Un-nested, Generous Spacing) */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Quick Practice Modes
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {onOpenWarmup && (
            <button
              onClick={onOpenWarmup}
              className="py-3 px-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-amber-50/40 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 text-amber-950 dark:text-amber-100 text-xs font-bold flex items-center justify-between transition shadow-soft group active:scale-98"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Zap className="w-4.5 h-4.5 animate-pulse" />
                </span>
                <span className="text-left leading-tight min-w-0">
                  <span className="block font-black text-slate-900 dark:text-white truncate text-xs sm:text-sm">
                    ⚡ 60s Spoken Warmup (+50 XP)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block truncate mt-0.5">
                    Rapid-fire British reflexes
                  </span>
                </span>
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-black group-hover:translate-x-1 transition-transform shrink-0 ml-2">&rarr;</span>
            </button>
          )}

          {onOpenSRS && (
            <button
              onClick={onOpenSRS}
              className="py-3 px-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-indigo-50/40 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 text-indigo-950 dark:text-indigo-100 text-xs font-bold flex items-center justify-between transition shadow-soft group active:scale-98"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Layers className="w-4.5 h-4.5" />
                </span>
                <span className="text-left leading-tight min-w-0">
                  <span className="block font-black text-slate-900 dark:text-white truncate text-xs sm:text-sm">
                    📌 My Saved Phrasebook
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block truncate mt-0.5">
                    {srsDueCount} due for practice
                  </span>
                </span>
              </span>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-black group-hover:translate-x-1 transition-transform shrink-0 ml-2">&rarr;</span>
            </button>
          )}
        </div>

        {onOpenFreeTalk && (
          <button
            onClick={() => {
              playChime('tap');
              onOpenFreeTalk();
            }}
            className="w-full py-3 px-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-brand-50/40 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 text-slate-900 dark:text-slate-100 text-xs font-bold flex items-center justify-between transition shadow-soft group active:scale-[0.99]"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-xs text-base shrink-0">
                {coachAvatar}
              </span>
              <span className="text-left leading-tight min-w-0">
                <span className="block font-black text-slate-900 dark:text-white truncate text-xs sm:text-sm">
                  Open Office &amp; Pub Chat with {coachName}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block truncate mt-0.5">
                  Unscripted free-talk, British idioms &amp; instant pronunciation feedback
                </span>
              </span>
            </span>
            <MessageCircle className="w-4.5 h-4.5 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform shrink-0 ml-2" />
          </button>
        )}
      </div>
    </div>
  );
};
