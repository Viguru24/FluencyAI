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
    <div className="w-full space-y-3.5">
      {/* Welcoming Header Banner */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {getGreeting()}, {formatDisplayName(progress.name)}!
            </h1>
            <span className="inline-block animate-bounce-subtle text-xl">🌱</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
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
            className={`cursor-pointer group flex items-center gap-2 px-3 py-1.5 rounded-2xl border shadow-sm transition active:scale-95 ${currentTierConfig.badgeAccent.pillBg}`}
            title={`Current Rank: ${currentTierConfig.name} • Click to open Rewards Roadmap`}
          >
            <span className="text-base group-hover:scale-110 transition-transform">
              {currentTierConfig.badgeAccent.icon}
            </span>
            <div className="text-left">
              <div className="text-xs font-black tracking-tight leading-none">
                {currentTierConfig.shortName}
              </div>
              <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mt-0.5">
                Fluency Tier
              </div>
            </div>
          </button>

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
                {streakDays} Days
              </div>
              <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                Streak
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Daily Goal & Hero Session Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-brand-50/30 to-emerald-50/40 p-5 shadow-soft border border-slate-200/80">
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
                  {currentMinutes} of {speakingMinutesTarget} mins spoken
                </div>
              </div>
            </div>

            <div
              className={`px-2.5 py-1 rounded-full text-xs font-black tracking-wide border ${
                isGoalReached
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-brand-50 text-brand-700 border-brand-200'
              }`}
            >
              {minutesPercent}%
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-3.5 rounded-full bg-slate-100/90 overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 via-sky-400 to-emerald-400 transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${minutesPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
              <span>Goal: {speakingMinutesTarget} mins daily practice</span>
              <span>{Math.max(0, speakingMinutesTarget - currentMinutes)} mins remaining</span>
            </div>
          </div>

          {/* Primary Hero Action: Start Today's Lesson */}
          {onStartLesson && (
            <div className="rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-sky-600 p-4 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold uppercase tracking-wider">
                    Today&apos;s Guided Session
                  </span>
                  <span className="text-[11px] font-bold text-amber-300">5 min • +35 XP</span>
                </div>
                <h3 className="text-sm sm:text-base font-black">
                  {progress.hasCompletedDailyLessonToday
                    ? 'Daily Lesson Completed — Practice Again!'
                    : `Daily 3-Stage Lesson with ${coachName}`}
                </h3>
                <p className="text-xs text-brand-100/90">
                  {savedReviewCount > 0
                    ? `Includes ${Math.min(2, savedReviewCount)} saved review phrases + live roleplay & scorecard`
                    : 'Phrase warm-up → Live voice roleplay → AI fluency scorecard'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    playChime('tap');
                    onStartLesson();
                  }}
                  className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-white hover:bg-brand-50 text-brand-950 font-black text-xs shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-brand-700 text-brand-700" />
                  <span>Start Daily Lesson</span>
                </button>
                {onStartDirectRoleplay && (
                  <button
                    onClick={() => {
                      playChime('tap');
                      onStartDirectRoleplay();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-bold text-xs transition active:scale-95"
                    title="Skip warm-up phrases and jump straight into Stage 2 Roleplay"
                  >
                    ⚡ Skip Prep
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Goal Milestones Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="relative p-2.5 rounded-2xl bg-white/90 border border-slate-200/60 text-center flex flex-col justify-between group shadow-2xs hover:border-brand-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">XP Today</span>
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
                  className={`p-1 rounded-lg transition active:scale-95 ${
                    dailyChestClaimed
                      ? 'text-emerald-600 bg-emerald-50'
                      : isDailyGoalMet
                      ? 'text-amber-500 bg-amber-100 ring-2 ring-amber-400 animate-bounce'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Gift className={`w-3.5 h-3.5 ${isDailyGoalMet && !dailyChestClaimed ? 'animate-pulse' : ''}`} />
                </button>
              </div>

              <div className="text-sm font-black text-brand-600 my-0.5">
                {dailyXP}/{dailyXPTarget}
              </div>

              <div className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/70 rounded-md py-0.5 px-1 truncate flex items-center justify-center gap-0.5">
                <span>{multiplierInfo.label}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-white/90 border border-slate-200/60 text-center flex flex-col justify-between shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Fluency CEFR</div>
              <div className="text-sm font-black text-emerald-600 my-0.5">
                Level {progress.level}
              </div>
              <div className="text-[9px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200/70 rounded-md py-0.5 px-1 truncate">
                {currentTierConfig.shortName}
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-white/90 border border-slate-200/60 text-center flex flex-col justify-between shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Pronunciation Avg
              </div>
              <div className="text-sm font-black text-emerald-600 my-0.5">
                {pronunciationAvg}%
              </div>
              <div className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/70 rounded-md py-0.5 px-1 truncate">
                {pronunciationAvg >= 90
                  ? '💎 +25% Bonus'
                  : pronunciationAvg >= 85
                  ? '✨ +10% Bonus'
                  : 'Standard'}
              </div>
            </div>
          </div>

          {/* 3-Card Quick Practice Modes: Free Talk, 60s Sprint, SRS Flashcards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
            {onOpenFreeTalk && (
              <button
                onClick={() => {
                  playChime('tap');
                  onOpenFreeTalk();
                }}
                className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-sky-500/10 via-brand-500/5 to-emerald-500/10 hover:from-sky-500/20 hover:to-emerald-500/20 border border-brand-200 text-slate-900 text-xs font-bold flex items-center justify-between transition shadow-2xs group active:scale-95"
              >
                <span className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-xs text-sm">
                    {coachAvatar}
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block font-extrabold text-slate-900">
                      Free Talk with {coachName}
                    </span>
                    <span className="text-[10px] text-brand-700 font-medium">
                      Open voice chat · 0 prep
                    </span>
                  </span>
                </span>
                <MessageCircle className="w-3.5 h-3.5 text-brand-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </button>
            )}

            {onOpenWarmup && (
              <button
                onClick={onOpenWarmup}
                className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-rose-500/10 hover:from-amber-500/20 hover:to-rose-500/20 border border-amber-300/80 text-amber-950 text-xs font-bold flex items-center justify-between transition shadow-2xs group active:scale-95"
              >
                <span className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
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
                  <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
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

          {/* Toggle 365-Day Fluency Heatmap */}
          <div className="pt-0.5">
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

      {showHeatmap && (
        <div className="animate-fade-in pt-1">
          <FluencyHeatmap />
        </div>
      )}
    </div>
  );
};
