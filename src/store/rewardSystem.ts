// Tiered Reward & Progression System Store for FluencyAI
// Tracks lifetime XP, daily XP targets, speaking minutes, streaks, freezes, and perks.

export type GamificationTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface TierPerk {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: GamificationTier;
}

export interface TierDefinition {
  id: GamificationTier;
  levelNumber: number;
  name: string;
  shortName: string;
  minXP: number;
  maxXP: number;
  reqStreak: number;
  reqPronunciation: number;
  cefrEquivalent: string;
  badgeAccent: {
    name: string;
    gradient: string;
    border: string;
    text: string;
    pillBg: string;
    icon: string;
    glow: string;
    ringColor: string;
    tagBg: string;
  };
  perks: TierPerk[];
}

export interface GamificationState {
  totalXP: number;
  dailyXP: number;
  dailyXPTarget: number;
  currentTier: GamificationTier;
  streakDays: number;
  streakFreezes: number; // max 2
  speakingMinutesToday: number;
  speakingMinutesTarget: number;
  pronunciationAvg: number; // rolling average percentage (e.g., 88)
  unlockedPerks: string[];
  dailyChestClaimed: boolean;
  lastActiveDate: string; // YYYY-MM-DD
}

export type ActivityType =
  | 'sprint-60s'
  | 'daily-lesson'
  | 'srs-session'
  | 'full-lesson'
  | 'james-test-lab'
  | 'roleplay-minute'
  | 'custom';

export interface XPCalculationResult {
  activityType: ActivityType;
  baseXP: number;
  streakDays: number;
  streakMultiplier: number;
  streakBonusXP: number;
  pronunciationScore: number;
  pronunciationBonusPercent: number;
  pronunciationBonusXP: number;
  earsOnlyBonusXP?: number;
  missionPhrasesBonusXP?: number;
  missionPhrasesCount?: number;
  totalEarnedXP: number;
  breakdownText: string;
  activityLabel: string;
}

export const TIERS_CONFIG: Record<GamificationTier, TierDefinition> = {
  bronze: {
    id: 'bronze',
    levelNumber: 1,
    name: 'Bronze Speaker',
    shortName: 'Bronze I',
    minXP: 0,
    maxXP: 999,
    reqStreak: 0,
    reqPronunciation: 0,
    cefrEquivalent: 'A2 / B1',
    badgeAccent: {
      name: 'Warm Bronze',
      gradient: 'from-amber-700 via-amber-600 to-amber-800',
      border: 'border-amber-600/40 dark:border-amber-500/60',
      text: 'text-amber-800 dark:text-amber-200',
      pillBg: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
      icon: '🥉',
      glow: 'shadow-amber-500/20',
      ringColor: 'ring-amber-500/40',
      tagBg: 'bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800',
    },
    perks: [
      {
        id: 'audio-speed-0.85',
        title: '0.85x Natural Speed',
        description: 'Gentle, clear conversational speed for active listening',
        icon: '🐢',
        tier: 'bronze',
      },
      {
        id: 'daily-lesson',
        title: 'Daily 5-Min Sprint',
        description: 'Daily British phrase and quick pronunciation drill',
        icon: '🎯',
        tier: 'bronze',
      },
      {
        id: 'spoken-sprint-60s',
        title: '60s Spoken Sprint',
        description: 'Rapid warm-up challenge with real-time mic feedback',
        icon: '⚡',
        tier: 'bronze',
      },
      {
        id: 'basic-srs',
        title: 'Saved Phrases & Flashcards',
        description: '5-stage phrasebook memory practice to lock in phrases',
        icon: '🗂️',
        tier: 'bronze',
      },
    ],
  },
  silver: {
    id: 'silver',
    levelNumber: 2,
    name: 'Silver Conversationalist',
    shortName: 'Silver II',
    minXP: 1000,
    maxXP: 3499,
    reqStreak: 5,
    reqPronunciation: 80,
    cefrEquivalent: 'B1',
    badgeAccent: {
      name: 'Sleek Silver',
      gradient: 'from-slate-400 via-slate-500 to-slate-700',
      border: 'border-slate-400/40 dark:border-slate-600',
      text: 'text-slate-800 dark:text-slate-100',
      pillBg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700',
      icon: '🥈',
      glow: 'shadow-slate-400/25',
      ringColor: 'ring-slate-400/50',
      tagBg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700',
    },
    perks: [
      {
        id: 'stage-2-roleplay',
        title: 'Stage 2 Live Roleplay Direct Jump',
        description: 'Skip scaffolding and dive straight into real-time roleplay',
        icon: '⚡',
        tier: 'silver',
      },
      {
        id: 'audio-speed-1.0',
        title: '1.0x Natural British Speed',
        description: 'Authentic London conversational pace for James & personas',
        icon: '🎙️',
        tier: 'silver',
      },
      {
        id: 'streak-freeze-weekly',
        title: '+1 Weekly Streak Freeze',
        description: 'Protects your streak if you miss a practice day (up to 2 stored)',
        icon: '🛡️',
        tier: 'silver',
      },
    ],
  },
  gold: {
    id: 'gold',
    levelNumber: 3,
    name: 'Gold Fluent',
    shortName: 'Gold III',
    minXP: 3500,
    maxXP: 7999,
    reqStreak: 14,
    reqPronunciation: 85,
    cefrEquivalent: 'B2',
    badgeAccent: {
      name: 'Vibrant Gold',
      gradient: 'from-amber-400 via-yellow-500 to-amber-600',
      border: 'border-amber-400/50 dark:border-amber-500/60',
      text: 'text-amber-900 dark:text-amber-100',
      pillBg: 'bg-amber-100/90 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700',
      icon: '🥇',
      glow: 'shadow-amber-400/30',
      ringColor: 'ring-amber-400/60',
      tagBg: 'bg-amber-50 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800',
    },
    perks: [
      {
        id: 'james-direct-mode',
        title: 'Open Office & Pub Chat with James',
        description: 'Unscripted free-talk, British idioms & instant pronunciation feedback',
        icon: '🧑‍💼',
        tier: 'gold',
      },
      {
        id: 'career-tech-roleplay',
        title: 'Career & Tech Roleplay Pack',
        description: 'Executive 1-on-1s, engineering standups, and interview simulations',
        icon: '💼',
        tier: 'gold',
      },
    ],
  },
  platinum: {
    id: 'platinum',
    levelNumber: 4,
    name: 'Platinum Native Peer',
    shortName: 'Platinum IV',
    minXP: 8000,
    maxXP: 14999,
    reqStreak: 30,
    reqPronunciation: 90,
    cefrEquivalent: 'C1',
    badgeAccent: {
      name: 'Cyan Platinum',
      gradient: 'from-cyan-400 via-teal-500 to-sky-600',
      border: 'border-cyan-400/50 dark:border-cyan-500/60',
      text: 'text-cyan-900 dark:text-cyan-100',
      pillBg: 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-900 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700',
      icon: '💠',
      glow: 'shadow-cyan-400/30',
      ringColor: 'ring-cyan-400/60',
      tagBg: 'bg-cyan-50 dark:bg-cyan-950/70 text-cyan-950 dark:text-cyan-200 border-cyan-300 dark:border-cyan-800',
    },
    perks: [
      {
        id: 'fast-talker-1.15x',
        title: '1.15x Fast-Talker London Commute Mode',
        description: 'High-speed authentic British conversational challenge',
        icon: '🚆',
        tier: 'platinum',
      },
      {
        id: 'syllable-stress-radar',
        title: 'Advanced Syllable Stress Analytics',
        description: 'In-depth pitch curves, phoneme radar, and stress intonation metrics',
        icon: '📊',
        tier: 'platinum',
      },
    ],
  },
  diamond: {
    id: 'diamond',
    levelNumber: 5,
    name: 'Diamond Londoner',
    shortName: 'Diamond V',
    minXP: 15000,
    maxXP: Infinity,
    reqStreak: 60,
    reqPronunciation: 92,
    cefrEquivalent: 'C2',
    badgeAccent: {
      name: 'Iridescent Diamond',
      gradient: 'from-indigo-500 via-purple-500 to-pink-500',
      border: 'border-indigo-400/50 dark:border-indigo-500/60',
      text: 'text-indigo-950 dark:text-indigo-100',
      pillBg: 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-950 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700',
      icon: '💎',
      glow: 'shadow-indigo-500/40',
      ringColor: 'ring-indigo-400/70',
      tagBg: 'bg-gradient-to-r from-indigo-50 to-pink-50 dark:from-indigo-950/80 dark:to-purple-950/80 text-indigo-950 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700',
    },
    perks: [
      {
        id: 'unscripted-debate-mode',
        title: 'Unscripted Debate & Executive Negotiation Mode',
        description: 'High-stakes boardroom debates and challenging negotiation sparring',
        icon: '👑',
        tier: 'diamond',
      },
      {
        id: 'custom-roleplay-generator',
        title: 'Custom AI Scenario Studio Pro',
        description: 'Instant customized scenarios generated specifically for your career',
        icon: '✨',
        tier: 'diamond',
      },
      {
        id: 'diamond-avatar-border',
        title: 'Diamond Profile Aura Border',
        description: 'Iridescent violet-diamond shimmering border for your avatar',
        icon: '💎',
        tier: 'diamond',
      },
    ],
  },
};

export const ORDERED_TIERS: GamificationTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

const GAMIFICATION_STORAGE_KEY = 'fluency_gamification_v1';
const EVENT_UPDATED = 'fluency_gamification_updated';
const EVENT_XP_AWARDED = 'fluency_xp_awarded';
const EVENT_TIER_UP = 'fluency_tier_celebration';
const EVENT_DAILY_GOAL = 'fluency_daily_goal_celebration';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Collect all perks for a tier and every tier below it
 */
export function getAllPerksUpToTier(tier: GamificationTier): string[] {
  const perks: string[] = [];
  for (const t of ORDERED_TIERS) {
    TIERS_CONFIG[t].perks.forEach((p) => perks.push(p.id));
    if (t === tier) break;
  }
  return perks;
}

/**
 * Determine the highest tier a learner qualifies for
 */
export function evaluateTier(
  totalXP: number,
  streakDays: number,
  pronunciationAvg: number
): GamificationTier {
  // Check from highest to lowest
  for (let i = ORDERED_TIERS.length - 1; i >= 0; i--) {
    const tierKey = ORDERED_TIERS[i];
    const def = TIERS_CONFIG[tierKey];
    if (
      totalXP >= def.minXP &&
      streakDays >= def.reqStreak &&
      pronunciationAvg >= def.reqPronunciation
    ) {
      return tierKey;
    }
  }
  return 'bronze';
}

/**
 * Initial state matching default dashboard context:
 * 65 XP today, 10 of 15 mins, 5-day streak, 88% pronunciation average.
 * Initial totalXP is set to 1,250 so the user starts at Silver Conversationalist (1,000 XP threshold met with 5-day streak and 88% pron avg).
 */
export const initialGamificationState: GamificationState = {
  totalXP: 1250,
  dailyXP: 65,
  dailyXPTarget: 100,
  currentTier: 'silver',
  streakDays: 5,
  streakFreezes: 1,
  speakingMinutesToday: 10,
  speakingMinutesTarget: 15,
  pronunciationAvg: 88,
  unlockedPerks: getAllPerksUpToTier('silver'),
  dailyChestClaimed: false,
  lastActiveDate: getTodayString(),
};

/**
 * Load gamification state from localStorage or fallback
 */
export function getGamificationState(): GamificationState {
  if (typeof window === 'undefined') return initialGamificationState;

  try {
    const raw = localStorage.getItem(GAMIFICATION_STORAGE_KEY);
    if (raw) {
      const parsed: GamificationState = JSON.parse(raw);
      const today = getTodayString();

      // Check for day rollover: reset daily counters while preserving streak & lifetime XP
      if (parsed.lastActiveDate && parsed.lastActiveDate !== today) {
        parsed.dailyXP = 0;
        parsed.speakingMinutesToday = 0;
        parsed.dailyChestClaimed = false;
        parsed.lastActiveDate = today;
        saveGamificationState(parsed, false);
      }

      // Ensure perks and tier consistency
      if (!parsed.currentTier) {
        parsed.currentTier = evaluateTier(parsed.totalXP, parsed.streakDays, parsed.pronunciationAvg);
      }
      if (!parsed.unlockedPerks || parsed.unlockedPerks.length === 0) {
        parsed.unlockedPerks = getAllPerksUpToTier(parsed.currentTier);
      }

      return parsed;
    }
  } catch (err) {
    console.warn('[GamificationStore] Could not read state from localStorage', err);
  }

  // Save initial on first load
  saveGamificationState(initialGamificationState, false);
  return initialGamificationState;
}

/**
 * Save state to localStorage and broadcast change event
 */
export function saveGamificationState(state: GamificationState, emitEvent: boolean = true): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(state));
    if (emitEvent) {
      window.dispatchEvent(new CustomEvent(EVENT_UPDATED, { detail: state }));
    }
  } catch (err) {
    console.warn('[GamificationStore] Could not save state', err);
  }
}

/**
 * Calculate streak multiplier
 * 3–6 Days: 1.1x XP
 * 7–13 Days: 1.25x XP
 * 14–29 Days: 1.5x XP
 * 30+ Days: 2.0x XP
 */
export function getStreakMultiplier(streakDays: number): {
  multiplier: number;
  label: string;
  nextThreshold?: { days: number; multiplier: number };
} {
  if (streakDays >= 30) {
    return { multiplier: 2.0, label: '🔥 2.0x Diamond Streak' };
  }
  if (streakDays >= 14) {
    return {
      multiplier: 1.5,
      label: '🔥 1.5x Gold Streak',
      nextThreshold: { days: 30, multiplier: 2.0 },
    };
  }
  if (streakDays >= 7) {
    return {
      multiplier: 1.25,
      label: '🔥 1.25x Silver Streak',
      nextThreshold: { days: 14, multiplier: 1.5 },
    };
  }
  if (streakDays >= 3) {
    return {
      multiplier: 1.1,
      label: '🔥 1.1x Streak Boost Active',
      nextThreshold: { days: 7, multiplier: 1.25 },
    };
  }
  return {
    multiplier: 1.0,
    label: '1.0x Base XP',
    nextThreshold: { days: 3, multiplier: 1.1 },
  };
}

/**
 * Calculate pronunciation accuracy bonus
 * >= 90%: +25% XP bonus ("Crystal Clear Bonus")
 * 85% - 89%: +10% XP bonus ("Great Accent Bonus")
 * < 85%: 0% bonus
 */
export function getPronunciationBonus(score: number): {
  percent: number;
  label: string;
} {
  if (score >= 90) {
    return { percent: 0.25, label: '💎 +25% Crystal Clear Bonus' };
  }
  if (score >= 85) {
    return { percent: 0.1, label: '✨ +10% Great Accent Bonus' };
  }
  return { percent: 0.0, label: 'Standard Accuracy' };
}

/**
 * Dynamic XP calculation helper
 * Returns full breakdown: base XP + streak multiplier bonus + pronunciation accuracy bonus
 */
export function calculateEarnedXP(
  activityType: ActivityType,
  baseXP?: number,
  pronunciationScore?: number,
  streakDays?: number,
  extraBonuses?: {
    earsOnlyBonus?: boolean;
    missionPhrasesCount?: number;
  }
): XPCalculationResult {
  const state = getGamificationState();
  const actualStreak = typeof streakDays === 'number' ? streakDays : state.streakDays;
  const actualPron = typeof pronunciationScore === 'number' ? pronunciationScore : state.pronunciationAvg;

  let computedBase = 50;
  let label = 'Spoken Activity';

  if (typeof baseXP === 'number' && baseXP > 0) {
    computedBase = baseXP;
  } else {
    switch (activityType) {
      case 'sprint-60s':
        computedBase = 50;
        label = '60s Spoken Sprint';
        break;
      case 'daily-lesson':
        computedBase = 35;
        label = 'Daily Lesson Sprint';
        break;
      case 'srs-session':
        computedBase = 20;
        label = 'Phrasebook Practice Session';
        break;
      case 'full-lesson':
        computedBase = 45;
        label = 'Full Lesson Plan';
        break;
      case 'james-test-lab':
      case 'roleplay-minute':
        computedBase = 10;
        label = 'James Voice Session';
        break;
      default:
        computedBase = 25;
        label = 'Spoken Practice';
    }
  }

  const { multiplier: streakMultiplier } = getStreakMultiplier(actualStreak);
  const { percent: pronPercent } = getPronunciationBonus(actualPron);

  const streakBonusXP = Math.round(computedBase * (streakMultiplier - 1.0));
  const pronunciationBonusXP = Math.round(computedBase * pronPercent);

  const earsOnlyBonusXP = extraBonuses?.earsOnlyBonus ? 15 : 0;
  const missionPhrasesCount = extraBonuses?.missionPhrasesCount
    ? Math.min(3, Math.max(0, extraBonuses.missionPhrasesCount))
    : 0;
  const missionPhrasesBonusXP = missionPhrasesCount * 10;

  const totalEarnedXP =
    computedBase + streakBonusXP + pronunciationBonusXP + earsOnlyBonusXP + missionPhrasesBonusXP;

  const parts = [`+${computedBase} XP Base`];
  if (streakBonusXP > 0) {
    parts.push(`+ ${streakBonusXP} XP Streak`);
  }
  if (pronunciationBonusXP > 0) {
    parts.push(`+ ${pronunciationBonusXP} XP Pronunciation`);
  }
  if (earsOnlyBonusXP > 0) {
    parts.push(`+ ${earsOnlyBonusXP} XP Ears-Only`);
  }
  if (missionPhrasesBonusXP > 0) {
    parts.push(`+ ${missionPhrasesBonusXP} XP Mission Phrases`);
  }
  const breakdownText = `${parts.join(' ')} = +${totalEarnedXP} XP!`;

  return {
    activityType,
    baseXP: computedBase,
    streakDays: actualStreak,
    streakMultiplier,
    streakBonusXP,
    pronunciationScore: actualPron,
    pronunciationBonusPercent: pronPercent,
    pronunciationBonusXP,
    earsOnlyBonusXP,
    missionPhrasesBonusXP,
    missionPhrasesCount,
    totalEarnedXP,
    breakdownText,
    activityLabel: label,
  };
}

/**
 * Award XP to learner, check for Tier promotion, and trigger celebration modals / toasts
 */
export function awardGamificationXP(
  calc: XPCalculationResult,
  minutesSpoken: number = 0
): {
  state: GamificationState;
  didTierUp: boolean;
  newTier?: GamificationTier;
  previousTier?: GamificationTier;
  didHitDailyGoal: boolean;
} {
  const current = getGamificationState();
  const prevTier = current.currentTier;
  const wasGoalHitBefore =
    current.dailyXP >= current.dailyXPTarget &&
    current.speakingMinutesToday >= current.speakingMinutesTarget;

  const updatedTotalXP = current.totalXP + calc.totalEarnedXP;
  const updatedDailyXP = current.dailyXP + calc.totalEarnedXP;
  const updatedMinutes = current.speakingMinutesToday + Math.max(0, minutesSpoken);

  // Check new tier qualification
  const newTier = evaluateTier(updatedTotalXP, current.streakDays, current.pronunciationAvg);
  const prevTierIndex = ORDERED_TIERS.indexOf(prevTier);
  const newTierIndex = ORDERED_TIERS.indexOf(newTier);
  const didTierUp = newTierIndex > prevTierIndex;

  // Award streak freeze on tier up (max 2)
  let updatedFreezes = current.streakFreezes;
  if (didTierUp && updatedFreezes < 2) {
    updatedFreezes += 1;
  }

  const newState: GamificationState = {
    ...current,
    totalXP: updatedTotalXP,
    dailyXP: updatedDailyXP,
    speakingMinutesToday: updatedMinutes,
    currentTier: didTierUp ? newTier : current.currentTier,
    streakFreezes: updatedFreezes,
    unlockedPerks: getAllPerksUpToTier(didTierUp ? newTier : current.currentTier),
    lastActiveDate: getTodayString(),
  };

  saveGamificationState(newState);

  // Broadcast XP Toast event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_XP_AWARDED, { detail: calc }));
  }

  // Check daily goal completion
  const isGoalHitNow =
    updatedDailyXP >= newState.dailyXPTarget &&
    updatedMinutes >= newState.speakingMinutesTarget;

  const didHitDailyGoal = !wasGoalHitBefore && isGoalHitNow;

  if (didTierUp && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(EVENT_TIER_UP, {
        detail: {
          newTier,
          previousTier: prevTier,
          unlockedPerks: TIERS_CONFIG[newTier].perks,
        },
      })
    );
  } else if (didHitDailyGoal && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(EVENT_DAILY_GOAL, {
        detail: {
          dailyXP: updatedDailyXP,
          speakingMinutesToday: updatedMinutes,
        },
      })
    );
  }

  return {
    state: newState,
    didTierUp,
    newTier: didTierUp ? newTier : undefined,
    previousTier: prevTier,
    didHitDailyGoal,
  };
}

/**
 * Claim the daily milestone chest
 * Unlocks when dailyXP >= 100 AND speakingMinutesToday >= 15
 */
export function claimDailyMilestoneChest(): {
  success: boolean;
  bonusXP: number;
  streakFreezeAwarded: boolean;
  message: string;
} {
  const current = getGamificationState();

  if (current.dailyChestClaimed) {
    return {
      success: false,
      bonusXP: 0,
      streakFreezeAwarded: false,
      message: "Today's daily milestone chest has already been claimed! Check back tomorrow.",
    };
  }

  const isEligible =
    current.dailyXP >= current.dailyXPTarget &&
    current.speakingMinutesToday >= current.speakingMinutesTarget;

  if (!isEligible) {
    return {
      success: false,
      bonusXP: 0,
      streakFreezeAwarded: false,
      message: `Complete ${Math.max(0, current.dailyXPTarget - current.dailyXP)} more XP and ${Math.max(
        0,
        current.speakingMinutesTarget - current.speakingMinutesToday
      )} more speaking mins to open today's chest!`,
    };
  }

  // Claim rewards: +50 Bonus XP and +1 Streak Freeze if below cap
  const bonusXP = 50;
  let freezeAwarded = false;
  let newFreezes = current.streakFreezes;

  if (newFreezes < 2) {
    newFreezes += 1;
    freezeAwarded = true;
  }

  const updatedState: GamificationState = {
    ...current,
    totalXP: current.totalXP + bonusXP,
    dailyXP: current.dailyXP + bonusXP,
    dailyChestClaimed: true,
    streakFreezes: newFreezes,
  };

  saveGamificationState(updatedState);

  // Trigger floating toast for chest XP
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(EVENT_XP_AWARDED, {
        detail: {
          activityType: 'custom',
          baseXP: bonusXP,
          streakDays: current.streakDays,
          streakMultiplier: 1.0,
          streakBonusXP: 0,
          pronunciationScore: current.pronunciationAvg,
          pronunciationBonusPercent: 0,
          pronunciationBonusXP: 0,
          totalEarnedXP: bonusXP,
          breakdownText: `🎁 Daily Milestone Chest Opened! +${bonusXP} Bonus XP${
            freezeAwarded ? ' & +1 Streak Freeze' : ''
          }!`,
          activityLabel: 'Daily Milestone Chest',
        } as XPCalculationResult,
      })
    );
  }

  return {
    success: true,
    bonusXP,
    streakFreezeAwarded: freezeAwarded,
    message: `Phenomenal! Claimed +${bonusXP} XP${freezeAwarded ? ' and protected your streak with +1 Freeze' : ''}!`,
  };
}

/**
 * Dev Helper: Simulate adding XP and triggering recalculations
 */
export function simulateAddXP(amount: number = 100): XPCalculationResult {
  const current = getGamificationState();
  const calc = calculateEarnedXP('custom', amount, current.pronunciationAvg, current.streakDays);
  awardGamificationXP(calc, 2);
  return calc;
}

/**
 * Dev Helper: Simulate triggering a specific Tier promotion
 */
export function simulateTierUp(targetTier: GamificationTier): void {
  const targetConfig = TIERS_CONFIG[targetTier];
  const current = getGamificationState();
  const prevTier = current.currentTier;

  const updatedState: GamificationState = {
    ...current,
    totalXP: Math.max(current.totalXP, targetConfig.minXP + 100),
    streakDays: Math.max(current.streakDays, targetConfig.reqStreak),
    pronunciationAvg: Math.max(current.pronunciationAvg, targetConfig.reqPronunciation),
    currentTier: targetTier,
    unlockedPerks: getAllPerksUpToTier(targetTier),
    streakFreezes: Math.min(2, current.streakFreezes + 1),
  };

  saveGamificationState(updatedState);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(EVENT_TIER_UP, {
        detail: {
          newTier: targetTier,
          previousTier: prevTier,
          unlockedPerks: targetConfig.perks,
        },
      })
    );
  }
}

/**
 * Dev Helper: Reset gamification to default state
 */
export function resetGamificationState(): void {
  saveGamificationState(initialGamificationState);
}

/**
 * Check if a specific perk is currently unlocked for the learner
 */
export function isPerkUnlocked(perkId: string): boolean {
  const state = getGamificationState();
  return state.unlockedPerks.includes(perkId);
}

export interface AudioSpeedOption {
  speed: number;
  label: string;
  minTier: GamificationTier;
  unlocked: boolean;
  lockReason?: string;
}

/**
 * Get configured audio speeds with tier lock enforcement
 * - 0.85x: Bronze+ (Always unlocked)
 * - 1.0x: Silver+ (Unlocked at Silver)
 * - 1.15x: Platinum+ (Unlocked at Platinum)
 */
export function getAvailableAudioSpeeds(currentTier?: GamificationTier): AudioSpeedOption[] {
  const tier = currentTier || getGamificationState().currentTier;
  const tierIdx = ORDERED_TIERS.indexOf(tier);
  const silverIdx = ORDERED_TIERS.indexOf('silver');
  const platinumIdx = ORDERED_TIERS.indexOf('platinum');

  return [
    {
      speed: 0.85,
      label: '0.85x (Guided)',
      minTier: 'bronze',
      unlocked: true,
    },
    {
      speed: 1.0,
      label: '1.0x (Natural)',
      minTier: 'silver',
      unlocked: tierIdx >= silverIdx,
      lockReason: 'Unlocks at Silver Tier (1,000 XP)',
    },
    {
      speed: 1.15,
      label: '1.15x (Fast Commute)',
      minTier: 'platinum',
      unlocked: tierIdx >= platinumIdx,
      lockReason: 'Unlocks at Platinum Tier (8,000 XP)',
    },
  ];
}

/**
 * Sync and merge gamification state from authenticated VPS profile
 */
export function syncGamificationFromRemote(remote: Partial<GamificationState>): GamificationState {
  const current = getGamificationState();
  const mergedTotalXP = Math.max(current.totalXP, typeof remote.totalXP === 'number' ? remote.totalXP : 0);
  const mergedStreakDays = Math.max(current.streakDays, typeof remote.streakDays === 'number' ? remote.streakDays : 0);
  const mergedPron = Math.max(current.pronunciationAvg, typeof remote.pronunciationAvg === 'number' ? remote.pronunciationAvg : 0);
  const mergedTier = evaluateTier(mergedTotalXP, mergedStreakDays, mergedPron);
  const mergedFreezes = Math.max(current.streakFreezes, Math.min(2, typeof remote.streakFreezes === 'number' ? remote.streakFreezes : 0));
  const mergedDailyChest = Boolean(current.dailyChestClaimed || remote.dailyChestClaimed);

  const updated: GamificationState = {
    ...current,
    totalXP: mergedTotalXP,
    streakDays: mergedStreakDays,
    pronunciationAvg: mergedPron,
    currentTier: mergedTier,
    streakFreezes: mergedFreezes,
    unlockedPerks: getAllPerksUpToTier(mergedTier),
    dailyChestClaimed: mergedDailyChest,
  };

  saveGamificationState(updated);
  return updated;
}

/**
 * Subscribe to gamification state changes
 */
export function subscribeGamification(listener: (state: GamificationState) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleUpdate = (e: Event) => {
    const customEvt = e as CustomEvent<GamificationState>;
    listener(customEvt.detail || getGamificationState());
  };

  window.addEventListener(EVENT_UPDATED, handleUpdate);
  return () => window.removeEventListener(EVENT_UPDATED, handleUpdate);
}

/**
 * React Hook for consuming and interacting with the gamification store
 */
import { useState, useEffect, useCallback } from 'react';

export function useGamificationStore() {
  const [state, setState] = useState<GamificationState>(getGamificationState);

  useEffect(() => {
    return subscribeGamification((updated) => {
      setState(updated);
    });
  }, []);

  const addXP = useCallback((activity: ActivityType, baseXP?: number, pronScore?: number, mins: number = 0) => {
    const calc = calculateEarnedXP(activity, baseXP, pronScore);
    return awardGamificationXP(calc, mins);
  }, []);

  const claimChest = useCallback(() => {
    return claimDailyMilestoneChest();
  }, []);

  const devAddXP = useCallback((amt: number = 100) => {
    return simulateAddXP(amt);
  }, []);

  const devSetTier = useCallback((tier: GamificationTier) => {
    simulateTierUp(tier);
  }, []);

  const devReset = useCallback(() => {
    resetGamificationState();
  }, []);

  const currentTierConfig = TIERS_CONFIG[state.currentTier];
  const nextTierIndex = ORDERED_TIERS.indexOf(state.currentTier) + 1;
  const nextTierKey = nextTierIndex < ORDERED_TIERS.length ? ORDERED_TIERS[nextTierIndex] : null;
  const nextTierConfig = nextTierKey ? TIERS_CONFIG[nextTierKey] : null;

  // Calculate percentage toward next tier
  let progressToNextTier = 100;
  let xpRemainingToNextTier = 0;

  if (nextTierConfig) {
    const minForCurrent = currentTierConfig.minXP;
    const minForNext = nextTierConfig.minXP;
    const span = minForNext - minForCurrent;
    const progressXP = Math.max(0, state.totalXP - minForCurrent);
    progressToNextTier = Math.min(100, Math.max(0, Math.round((progressXP / span) * 100)));
    xpRemainingToNextTier = Math.max(0, minForNext - state.totalXP);
  }

  const multiplierInfo = getStreakMultiplier(state.streakDays);
  const pronunciationBonusInfo = getPronunciationBonus(state.pronunciationAvg);

  const isDailyGoalMet =
    state.dailyXP >= state.dailyXPTarget &&
    state.speakingMinutesToday >= state.speakingMinutesTarget;

  return {
    ...state,
    currentTierConfig,
    nextTierConfig,
    progressToNextTier,
    xpRemainingToNextTier,
    multiplierInfo,
    pronunciationBonusInfo,
    isDailyGoalMet,
    addXP,
    claimChest,
    devAddXP,
    devSetTier,
    devReset,
  };
}
