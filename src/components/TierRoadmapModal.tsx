import React from 'react';
import {
  X,
  Trophy,
  Flame,
  Shield,
  Lock,
  CheckCircle2,
  Gift,
  Sparkles,
  Zap,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  TIERS_CONFIG,
  ORDERED_TIERS,
  useGamificationStore,
} from '../store/rewardSystem';
import { playChime } from '../services/speech';

interface TierRoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStage2Roleplay?: () => void;
}

export const TierRoadmapModal: React.FC<TierRoadmapModalProps> = ({
  isOpen,
  onClose,
  onOpenStage2Roleplay,
}) => {
  const {
    totalXP,
    dailyXP,
    dailyXPTarget,
    currentTier,
    streakDays,
    streakFreezes,
    speakingMinutesToday,
    speakingMinutesTarget,
    pronunciationAvg,
    unlockedPerks,
    dailyChestClaimed,
    currentTierConfig,
    nextTierConfig,
    progressToNextTier,
    xpRemainingToNextTier,
    multiplierInfo,
    pronunciationBonusInfo,
    isDailyGoalMet,
    claimChest,
    devAddXP,
    devSetTier,
    devReset,
  } = useGamificationStore();

  if (!isOpen) return null;

  const currentTierIndex = ORDERED_TIERS.indexOf(currentTier);

  const handleClaimChest = () => {
    playChime('success');
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.5 } });
    claimChest();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl shadow-inner">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  My Fluency Journey &amp; Rewards
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${currentTierConfig.badgeAccent.pillBg}`}
                >
                  {currentTierConfig.badgeAccent.icon} {currentTierConfig.name}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Earn XP, build speaking streaks, and unlock British fluency perks
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition active:scale-95"
            aria-label="Close roadmap modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Top Summary & Multipliers Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Cumulative XP & Next Rank Progress */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-brand-50 to-indigo-50/50 dark:from-slate-800 dark:to-slate-800/60 border border-brand-200/80 dark:border-slate-700 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-800 dark:text-brand-300">
                  Total Lifetime XP
                </span>
                <span className="text-xs font-black text-brand-900 dark:text-brand-200">{totalXP.toLocaleString()} XP</span>
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white leading-none">
                {currentTierConfig.shortName}
              </div>
              <div className="space-y-1 pt-1">
                <div className="w-full h-2 rounded-full bg-brand-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-600 transition-all duration-500"
                    style={{ width: `${progressToNextTier}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>{progressToNextTier}% to next rank</span>
                  {nextTierConfig ? (
                    <span>{xpRemainingToNextTier.toLocaleString()} XP needed</span>
                  ) : (
                    <span>Max Rank Reached 💎</span>
                  )}
                </div>
              </div>
            </div>

            {/* Streak & Streak Multiplier Booster */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-slate-800 dark:to-slate-800/60 border border-amber-200/80 dark:border-slate-700 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Active Multiplier
                </span>
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
              </div>
              <div className="text-lg font-black text-amber-950 dark:text-amber-200 leading-none">
                {multiplierInfo.multiplier}x Boost
              </div>
              <div className="text-[11px] text-amber-900 dark:text-amber-300/90 font-medium">
                {streakDays}-day streak active.
                {multiplierInfo.nextThreshold && (
                  <span className="block text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 font-bold">
                    Reach {multiplierInfo.nextThreshold.days} days for {multiplierInfo.nextThreshold.multiplier}x boost!
                  </span>
                )}
              </div>
            </div>

            {/* Pronunciation Accuracy & Streak Freezes */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-slate-800 dark:to-slate-800/60 border border-emerald-200/80 dark:border-slate-700 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Vault &amp; Accuracy
                </span>
                <Shield className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-emerald-950 dark:text-emerald-200">{pronunciationAvg}%</span>
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 border border-transparent dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                  {pronunciationBonusInfo.percent > 0 ? `+${Math.round(pronunciationBonusInfo.percent * 100)}% Bonus` : 'Base Bonus'}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded-lg text-[10px]">
                  🛡️ {streakFreezes}/2 Freezes Stored
                </span>
              </div>
            </div>
          </div>

          {/* Daily Milestone Chest Banner */}
          <div
            className={`rounded-3xl p-4 sm:p-5 border transition-all ${
              dailyChestClaimed
                ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                : isDailyGoalMet
                ? 'bg-gradient-to-r from-amber-400/20 via-yellow-400/15 to-emerald-400/20 border-amber-400 dark:border-amber-500 shadow-md animate-pulse-subtle'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-2xs'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-inner ${
                    dailyChestClaimed
                      ? 'bg-emerald-100 text-emerald-700'
                      : isDailyGoalMet
                      ? 'bg-amber-400 text-slate-950 animate-bounce'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300'
                  }`}
                >
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Daily Milestone Chest
                    </h3>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        dailyChestClaimed
                          ? 'bg-emerald-100 text-emerald-800'
                          : isDailyGoalMet
                          ? 'bg-amber-400 text-amber-950 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {dailyChestClaimed
                        ? 'Claimed Today ✓'
                        : isDailyGoalMet
                        ? 'Ready to Open! 🎁'
                        : 'In Progress'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Requires 100 Daily XP ({dailyXP}/100) AND 15 speaking minutes ({speakingMinutesToday}/15 mins).
                  </p>
                </div>
              </div>

              {!dailyChestClaimed && isDailyGoalMet ? (
                <button
                  onClick={handleClaimChest}
                  className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 flex-shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Claim Daily Chest (+50 XP)</span>
                </button>
              ) : dailyChestClaimed ? (
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Claimed · Resets Midnight</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-xl">
                  {Math.max(0, dailyXPTarget - dailyXP)} XP &amp; {Math.max(0, speakingMinutesTarget - speakingMinutesToday)} mins left
                </span>
              )}
            </div>
          </div>

          {/* 5-Tier Progression Ladder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                5-Tier Fluency Progression Ladder
              </h3>
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                Current: {currentTierConfig.name}
              </span>
            </div>

            <div className="space-y-3">
              {ORDERED_TIERS.map((tierKey, index) => {
                const tier = TIERS_CONFIG[tierKey];
                const isCurrent = currentTier === tierKey;
                const isUnlocked = index <= currentTierIndex;
                const isNext = index === currentTierIndex + 1;

                const meetsXP = totalXP >= tier.minXP;
                const meetsStreak = streakDays >= tier.reqStreak;
                const meetsPron = pronunciationAvg >= tier.reqPronunciation;

                return (
                  <div
                    key={tierKey}
                    className={`relative overflow-hidden rounded-3xl border transition-all duration-300 ${
                      isCurrent
                        ? `bg-white dark:bg-slate-800/90 border-brand-400 shadow-md ring-2 ${tier.badgeAccent.ringColor}`
                        : isUnlocked
                        ? 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80'
                        : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-800/60 opacity-80'
                    }`}
                  >
                    {/* Top Tier Strip */}
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm border ${
                              isUnlocked
                                ? `bg-white dark:bg-slate-700 ${tier.badgeAccent.border}`
                                : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 grayscale'
                            }`}
                          >
                            {tier.badgeAccent.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                {tier.name}
                              </h4>
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                ({tier.cefrEquivalent})
                              </span>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                                  Current Tier
                                </span>
                              )}
                              {isNext && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-[10px] font-black uppercase tracking-wider">
                                  Next Target 🎯
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {tier.minXP.toLocaleString()} –{' '}
                              {tier.maxXP === Infinity ? '15,000+' : tier.maxXP.toLocaleString()} XP
                            </div>
                          </div>
                        </div>

                        {/* Status Icon */}
                        <div className="flex-shrink-0">
                          {isUnlocked ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-xl">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Unlocked</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Locked</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Requirements Checklist */}
                      <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${
                            meetsXP
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {meetsXP ? '✓' : '○'} {tier.minXP.toLocaleString()} XP
                        </span>

                        {tier.reqStreak > 0 && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${
                              meetsStreak
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {meetsStreak ? '✓' : '○'} {tier.reqStreak}-Day Streak ({streakDays}/{tier.reqStreak})
                          </span>
                        )}

                        {tier.reqPronunciation > 0 && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${
                              meetsPron
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {meetsPron ? '✓' : '○'} &gt;={tier.reqPronunciation}% Pronunciation ({pronunciationAvg}%)
                          </span>
                        )}
                      </div>

                      {/* Tier Perks Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        {tier.perks.map((perk) => {
                          const hasPerk = unlockedPerks.includes(perk.id);
                          return (
                            <div
                              key={perk.id}
                              className={`flex items-start gap-2 p-2 rounded-xl text-xs transition ${
                                hasPerk
                                  ? 'bg-white/80 dark:bg-slate-700/80 border border-slate-200/60 dark:border-slate-600 text-slate-800 dark:text-slate-200'
                                  : 'bg-slate-100/60 dark:bg-slate-800/50 border border-slate-200/40 dark:border-slate-700/50 text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              <span className="text-sm flex-shrink-0">{perk.icon}</span>
                              <div className="min-w-0">
                                <div className="font-bold truncate">{perk.title}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                                  {perk.description}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dev Test Sandbox Controls */}
          <div className="rounded-3xl bg-slate-900 text-white p-4 sm:p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Developer Gamification Sandbox
                </span>
              </div>
              <span className="text-[10px] text-slate-400">Instant Testing Controls</span>
            </div>

            <p className="text-xs text-slate-300">
              Simulate actions instantly to verify floating XP toasts, tier promotion modals, and perks:
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  playChime('tap');
                  devAddXP(100);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition active:scale-95 shadow-sm"
              >
                +100 XP (Trigger Toast)
              </button>

              <button
                onClick={() => {
                  playChime('tap');
                  devSetTier('silver');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition active:scale-95"
              >
                🥈 Silver (1k XP)
              </button>

              <button
                onClick={() => {
                  playChime('tap');
                  devSetTier('gold');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition active:scale-95"
              >
                🥇 Gold (3.5k XP)
              </button>

              <button
                onClick={() => {
                  playChime('tap');
                  devSetTier('platinum');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs transition active:scale-95"
              >
                💠 Platinum (8k XP)
              </button>

              <button
                onClick={() => {
                  playChime('tap');
                  devSetTier('diamond');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs transition active:scale-95"
              >
                💎 Diamond (15k XP)
              </button>

              <button
                onClick={() => {
                  playChime('tap');
                  devReset();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50 font-bold text-xs transition active:scale-95"
              >
                Reset Demo
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Tier rewards &amp; unlocks persist automatically across all sessions.</span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenStage2Roleplay && currentTierIndex >= 1 && (
              <button
                onClick={() => {
                  onClose();
                  onOpenStage2Roleplay();
                }}
                className="px-3 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition active:scale-95 shadow-sm flex items-center gap-1.5"
              >
                <span>⚡ Stage 2 Roleplay</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition active:scale-95 border border-transparent dark:border-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
