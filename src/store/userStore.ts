import { useState, useEffect, useCallback } from 'react';
import { initialUserProgress } from '../data/mockData';
import { getActivePersona } from '../data/personas';
import { addPhrasesToSRS, getUserSavedSRSCards } from '../services/srsService';
import { recordActivity } from '../services/activityService';
import { authService, mergeUserProgressWithRemote } from '../services/authService';
import { toast } from '../services/toast';
import { formatDisplayName, normalizeUserAvatar } from '../utils/nameFormatter';
import {
  calculateEarnedXP,
  awardGamificationXP,
  subscribeGamification,
  getGamificationState,
  type ActivityType,
  type XPCalculationResult,
} from './rewardSystem';
import type {
  UserProgress,
  LessonPlan,
  PhrasingUpgrade,
  CEFRLevel,
  PlacementAssessmentResult,
  AIPersona,
} from '../types';
import { getLLMConfig } from '../services/llmConfig';

export const USER_STORAGE_KEY = 'fluencyai_user_progress_v1';
export const PLACEMENT_ASSESSED_KEY = 'fluency_placement_assessed_v1';
export const ONBOARDING_COMPLETED_KEY = 'fluency_onboarding_completed_v1';
export const DAILY_LESSON_ID = 'daily-lesson-today';

function loadInitialProgress(): UserProgress {
  let local = initialUserProgress;
  try {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (saved) local = { ...initialUserProgress, ...JSON.parse(saved) };
  } catch (e) {
    console.warn('Could not read user progress from localStorage', e);
  }

  const gamState = getGamificationState();
  local = {
    ...local,
    completedXP: gamState.dailyXP,
    completedMinutes: Math.max(local.completedMinutes, gamState.speakingMinutesToday),
    streakDays: gamState.streakDays,
  };

  const currentUser = authService.getUser();
  if (currentUser) {
    local = mergeUserProgressWithRemote(local, currentUser);
  }
  if (local.name) {
    local.name = formatDisplayName(local.name);
  }
  if (local.avatar) {
    local.avatar = normalizeUserAvatar(local.avatar) || local.avatar;
  }
  return local;
}

export function useUserStore() {
  const [progress, setProgress] = useState<UserProgress>(loadInitialProgress);
  const [activePersona, setActivePersonaState] = useState<AIPersona>(getActivePersona);
  const [savedCardsCount, setSavedCardsCount] = useState<number>(() => getUserSavedSRSCards().length);

  // Sync gamification store state with progress
  useEffect(() => {
    const unsub = subscribeGamification((gamState) => {
      setProgress((prev) => ({
        ...prev,
        completedXP: gamState.dailyXP,
        completedMinutes: Math.max(prev.completedMinutes, gamState.speakingMinutesToday),
        streakDays: gamState.streakDays,
      }));
    });
    return unsub;
  }, []);

  // Listen for persona changes
  useEffect(() => {
    const handlePersonaChange = (e: Event) => {
      const customEvt = e as CustomEvent<AIPersona>;
      if (customEvt.detail) {
        setActivePersonaState(customEvt.detail);
      }
    };
    window.addEventListener('fluency_persona_changed', handlePersonaChange);
    return () => window.removeEventListener('fluency_persona_changed', handlePersonaChange);
  }, []);

  // Listen for SRS updates
  useEffect(() => {
    const handleSRSUpdate = () => {
      setSavedCardsCount(getUserSavedSRSCards().length);
    };
    window.addEventListener('fluency_srs_updated', handleSRSUpdate);
    window.addEventListener('storage', handleSRSUpdate);
    return () => {
      window.removeEventListener('fluency_srs_updated', handleSRSUpdate);
      window.removeEventListener('storage', handleSRSUpdate);
    };
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsub = authService.onAuthStateChange((session) => {
      if (session?.user) {
        setProgress((prev) => mergeUserProgressWithRemote(prev, session.user));
      }
    });
    return unsub;
  }, []);

  // Persist to localStorage & debounced VPS Cloud sync
  useEffect(() => {
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      console.warn('Could not save user progress to localStorage', e);
    }

    if (authService.isAuthenticated()) {
      const timer = setTimeout(() => {
        authService
          .syncProgress({
            xp: progress.completedXP,
            streak: progress.streakDays,
            level: progress.level,
            name: progress.name,
            picture: progress.avatar,
            progress_data: {
              completedScenarioIds: progress.completedScenarioIds,
              completedMinutes: progress.completedMinutes,
              dailyGoalMinutes: progress.dailyGoalMinutes,
              dailyGoalXP: progress.dailyGoalXP,
              nativeLanguage: progress.nativeLanguage,
              hasCompletedPlacement: progress.hasCompletedPlacement,
              placementDetails: progress.placementDetails,
              llm_config: getLLMConfig(),
            },
          })
          .catch((err) => console.warn('[userStore] Cloud sync error:', err));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [progress]);

  const selectPersona = useCallback((p: AIPersona) => {
    setActivePersonaState(p);
    setProgress((prev) => ({ ...prev, activePersonaId: p.id }));
  }, []);

  const completePlacement = useCallback(
    (assessedLevel: CEFRLevel, details: PlacementAssessmentResult) => {
      try {
        localStorage.setItem(PLACEMENT_ASSESSED_KEY, 'true');
      } catch {
        /* ignore */
      }

      setProgress((prev) => ({
        ...prev,
        level: assessedLevel,
        hasCompletedPlacement: true,
        placementDetails: details,
      }));

      if (authService.isAuthenticated()) {
        authService
          .syncProgress({
            level: assessedLevel,
            progress_data: {
              hasCompletedPlacement: true,
              placementDetails: details,
            },
          })
          .catch((err) => console.warn('[userStore] VPS level sync warning:', err));
      }

      toast.success(
        `Your level is calibrated to Level ${assessedLevel} (${details.title})! ${activePersona.name} has adapted vocabulary complexity.`,
        'Placement Complete'
      );
    },
    [activePersona.name]
  );

  const completeLesson = useCallback((plan: LessonPlan, customXPCalc?: XPCalculationResult) => {
    const isDaily = plan.id === DAILY_LESSON_ID;
    const activityType: ActivityType = isDaily ? 'daily-lesson' : 'full-lesson';
    const xpCalc = customXPCalc || calculateEarnedXP(activityType, plan.xpReward);
    awardGamificationXP(xpCalc, plan.minutes);
    recordActivity(plan.minutes, xpCalc.totalEarnedXP);

    setProgress((prev) => ({
      ...prev,
      hasCompletedDailyLessonToday: prev.hasCompletedDailyLessonToday || isDaily,
      completedScenarioIds:
        isDaily || prev.completedScenarioIds.includes(plan.id)
          ? prev.completedScenarioIds
          : [...prev.completedScenarioIds, plan.id],
      completedXP: Math.min(prev.dailyGoalXP, prev.completedXP + xpCalc.totalEarnedXP),
      completedMinutes: Math.min(prev.dailyGoalMinutes, prev.completedMinutes + plan.minutes),
    }));
  }, []);

  const saveMistakes = useCallback((plan: LessonPlan, upgrades: PhrasingUpgrade[]) => {
    addPhrasesToSRS(upgrades, plan.title);
    setProgress((prev) => {
      const existing = prev.savedMistakes ?? [];
      const existingIds = new Set(existing.map((m) => m.id));
      const fresh = upgrades
        .filter((u) => !existingIds.has(u.id))
        .map((u) => ({
          id: u.id,
          whatYouSaid: u.whatYouSaid,
          moreNatural: u.moreNatural,
          scenarioTitle: plan.title,
          dateSaved: new Date().toISOString(),
        }));
      return { ...prev, savedMistakes: [...existing, ...fresh] };
    });
  }, []);

  const rewardXP = useCallback((amount: number, activity: ActivityType = 'custom') => {
    const xpCalc = calculateEarnedXP(activity, amount);
    awardGamificationXP(xpCalc, 2);
    recordActivity(2, xpCalc.totalEarnedXP);

    setProgress((prev) => ({
      ...prev,
      completedXP: prev.completedXP + xpCalc.totalEarnedXP,
    }));
  }, []);

  const isPlacementCompleted =
    Boolean(progress.hasCompletedPlacement) ||
    (typeof window !== 'undefined' && localStorage.getItem(PLACEMENT_ASSESSED_KEY) === 'true');

  const isOnboardingCompleted =
    Boolean(progress.hasCompletedOnboarding) ||
    (typeof window !== 'undefined' && localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true');

  const completeOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch {
      /* ignore */
    }
    setProgress((prev) => ({
      ...prev,
      hasCompletedOnboarding: true,
    }));
  }, []);

  const restartOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    } catch {
      /* ignore */
    }
    setProgress((prev) => ({
      ...prev,
      hasCompletedOnboarding: false,
    }));
  }, []);

  const dismissPlacement = useCallback(() => {
    try {
      localStorage.setItem(PLACEMENT_ASSESSED_KEY, 'true');
    } catch {
      /* ignore */
    }
    setProgress((prev) => ({
      ...prev,
      hasCompletedPlacement: true,
    }));
  }, []);

  const resetPlacement = useCallback(() => {
    try {
      localStorage.removeItem(PLACEMENT_ASSESSED_KEY);
    } catch {
      /* ignore */
    }
    setProgress((prev) => ({
      ...prev,
      hasCompletedPlacement: false,
    }));
  }, []);

  return {
    progress,
    setProgress,
    activePersona,
    selectPersona,
    savedCardsCount,
    isPlacementCompleted,
    isOnboardingCompleted,
    completeOnboarding,
    restartOnboarding,
    completePlacement,
    dismissPlacement,
    resetPlacement,
    completeLesson,
    saveMistakes,
    rewardXP,
  };
}
