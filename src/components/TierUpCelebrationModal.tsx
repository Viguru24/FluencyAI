import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Volume2, X, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  TIERS_CONFIG,
  type GamificationTier,
  type TierPerk,
} from '../store/rewardSystem';
import { speakEnglish, stopSpeaking, playChime } from '../services/speech';
import { formatDisplayName } from '../utils/nameFormatter';
import { authService } from '../services/authService';

interface CelebrationData {
  type: 'tier-up' | 'daily-goal';
  newTier?: GamificationTier;
  previousTier?: GamificationTier;
  unlockedPerks?: TierPerk[];
  speakingMinutes?: number;
  dailyXP?: number;
}

interface TierUpCelebrationModalProps {
  onOpenRoadmap?: () => void;
  onOpenStage2Roleplay?: () => void;
}

export const TierUpCelebrationModal: React.FC<TierUpCelebrationModalProps> = ({
  onOpenRoadmap,
  onOpenStage2Roleplay,
}) => {
  const [data, setData] = useState<CelebrationData | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const getUserName = useCallback((): string => {
    try {
      const user = authService.getUser();
      if (user?.name) return formatDisplayName(user.name);
      const saved = localStorage.getItem('fluencyai_user_progress_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) return formatDisplayName(parsed.name);
      }
    } catch {
      /* ignore */
    }
    return 'Louis';
  }, []);

  const getCelebrationMessage = useCallback(
    (item: CelebrationData): string => {
      const name = getUserName();
      if (item.type === 'daily-goal') {
        return `Splendid discipline, ${name}! You've conquered your 15-minute daily speaking goal today. Your neural pathways are locking in authentic British speech patterns!`;
      }

      switch (item.newTier) {
        case 'silver':
          return `Brilliant effort today, ${name}! You've hit Silver Conversationalist—fancy trying Stage 2 Roleplay at 1.0x natural British speed?`;
        case 'gold':
          return `Spot on, ${name}! You've unlocked Gold Fluent! The James AI Direct Test Lab and Career & Tech Roleplay Pack are now officially at your disposal.`;
        case 'platinum':
          return `Tremendous dedication, ${name}! You've achieved Platinum Native Peer! Ready to challenge yourself with 1.15x Fast-Talker London Commute Mode?`;
        case 'diamond':
          return `Exceptional mastery, ${name}! You are now a Diamond Londoner—our highest honor. Boardroom debates, custom AI scenarios, and the exclusive Diamond aura border are yours!`;
        default:
          return `Well done, ${name}! Your English speaking confidence and consistency are growing every single day. Keep speaking out loud!`;
      }
    },
    [getUserName]
  );

  const handleSpeak = useCallback(
    (text: string) => {
      stopSpeaking();
      setIsSpeaking(true);
      speakEnglish(text, {
        personaName: 'James',
        accent: 'UK',
        rate: 0.94,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
    },
    []
  );

  useEffect(() => {
    const handleTierUp = (e: Event) => {
      const customEvt = e as CustomEvent<{
        newTier: GamificationTier;
        previousTier: GamificationTier;
        unlockedPerks: TierPerk[];
      }>;
      if (!customEvt.detail) return;

      const eventData: CelebrationData = {
        type: 'tier-up',
        newTier: customEvt.detail.newTier,
        previousTier: customEvt.detail.previousTier,
        unlockedPerks: customEvt.detail.unlockedPerks,
      };

      setData(eventData);

      playChime('streak');

      // Confetti celebration
      const colors =
        eventData.newTier === 'diamond'
          ? ['#6366f1', '#a855f7', '#ec4899', '#3b82f6']
          : eventData.newTier === 'gold'
          ? ['#f59e0b', '#fbbf24', '#d97706', '#10b981']
          : eventData.newTier === 'platinum'
          ? ['#06b6d4', '#0ea5e9', '#14b8a6', '#f8fafc']
          : ['#94a3b8', '#64748b', '#3b82f6', '#10b981'];

      confetti({
        particleCount: 100,
        spread: 90,
        origin: { y: 0.4 },
        colors,
      });

      // Auto speak personalized congratulation
      const msg = getCelebrationMessage(eventData);
      window.setTimeout(() => {
        handleSpeak(msg);
      }, 500);
    };

    const handleDailyGoal = (e: Event) => {
      const customEvt = e as CustomEvent<{
        dailyXP: number;
        speakingMinutesToday: number;
      }>;
      if (!customEvt.detail) return;

      const eventData: CelebrationData = {
        type: 'daily-goal',
        speakingMinutes: customEvt.detail.speakingMinutesToday,
        dailyXP: customEvt.detail.dailyXP,
      };

      setData(eventData);
      playChime('streak');

      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.45 },
        colors: ['#10b981', '#059669', '#34d399', '#fbbf24'],
      });

      const msg = getCelebrationMessage(eventData);
      window.setTimeout(() => {
        handleSpeak(msg);
      }, 500);
    };

    window.addEventListener('fluency_tier_celebration', handleTierUp);
    window.addEventListener('fluency_daily_goal_celebration', handleDailyGoal);

    return () => {
      window.removeEventListener('fluency_tier_celebration', handleTierUp);
      window.removeEventListener('fluency_daily_goal_celebration', handleDailyGoal);
      stopSpeaking();
    };
  }, [getCelebrationMessage, handleSpeak]);

  if (!data) return null;

  const isTierUp = data.type === 'tier-up';
  const tierConfig = data.newTier ? TIERS_CONFIG[data.newTier] : null;
  const message = getCelebrationMessage(data);

  const handleClose = () => {
    stopSpeaking();
    setIsSpeaking(false);
    setData(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto animate-scale-up">
        {/* Top Header Banner with Dynamic Accent */}
        <div
          className={`relative px-6 py-6 text-white text-center overflow-hidden bg-gradient-to-br ${
            isTierUp && tierConfig
              ? tierConfig.badgeAccent.gradient
              : 'from-emerald-600 via-teal-600 to-sky-700'
          }`}
        >
          {/* Subtle sparkles & glow */}
          <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-white/15 blur-2xl" />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-2xl bg-white/15 hover:bg-white/25 text-white transition active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/20 border border-white/30 backdrop-blur-md shadow-inner text-3xl">
              {isTierUp && tierConfig ? tierConfig.badgeAccent.icon : '🏆'}
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
                {isTierUp ? 'Rank Promotion' : 'Daily Goal Achieved'}
              </span>
              <h2 className="text-2xl font-black text-white tracking-tight mt-1">
                {isTierUp && tierConfig
                  ? `${tierConfig.name}!`
                  : 'Daily 15-Minute Goal Unlocked!'}
              </h2>
              {isTierUp && tierConfig && (
                <p className="text-xs text-white/90 font-medium">
                  CEFR Calibration: {tierConfig.cefrEquivalent}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* James Voice Note Callout */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-brand-950 p-4 text-white shadow-soft border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-lg">
                  🧑‍💼
                </div>
                <div>
                  <div className="text-xs font-black text-amber-300">James • UK Coach</div>
                  <div className="text-[10px] text-slate-400">Personalized Milestone Message</div>
                </div>
              </div>

              <button
                onClick={() => handleSpeak(message)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition active:scale-95 shadow-sm"
                title="Hear James speak this message"
              >
                <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-bounce text-slate-950' : ''}`} />
                <span>{isSpeaking ? 'Speaking…' : 'Hear James'}</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic font-medium">
              &ldquo;{message}&rdquo;
            </p>
          </div>

          {/* Unlocked Perks (if Tier Up) */}
          {isTierUp && tierConfig && tierConfig.perks.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  New Perks &amp; Capabilities Unlocked:
                </h4>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  +{tierConfig.perks.length} Unlocked
                </span>
              </div>

              <div className="space-y-2">
                {tierConfig.perks.map((perk) => (
                  <div
                    key={perk.id}
                    className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 shadow-2xs"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-base flex-shrink-0 shadow-2xs">
                      {perk.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{perk.title}</span>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {perk.description}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Extra Streak Freeze bonus note */}
                <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="font-semibold text-[11px]">
                    +1 Streak Freeze added to your vault to protect your daily habit.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {isTierUp && onOpenStage2Roleplay && (
              <button
                onClick={() => {
                  handleClose();
                  onOpenStage2Roleplay();
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-brand-500 hover:from-amber-300 hover:to-brand-400 text-slate-950 font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>⚡ Try Stage 2 Roleplay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {onOpenRoadmap && (
              <button
                onClick={() => {
                  handleClose();
                  onOpenRoadmap();
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-transparent dark:border-slate-700 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                <span>View Full Rewards Roadmap</span>
              </button>
            )}

            <button
              onClick={handleClose}
              className="py-3 px-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs transition active:scale-95"
            >
              Continue Practice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
