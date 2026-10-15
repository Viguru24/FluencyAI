import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DailyGoalCard } from './components/DailyGoalCard';
import { RoleplayList } from './components/RoleplayList';
import { StartDailyLessonFAB } from './components/StartDailyLessonFAB';
import { PWAInstallGuideModal } from './components/PWAInstallGuideModal';
import { LessonFlow } from './components/lesson/LessonFlow';
import { JamesTestAreaModal } from './components/JamesTestAreaModal';
import { PlacementModal } from './components/PlacementModal';
import { PersonaSelectorModal } from './components/PersonaSelectorModal';
import { SRSFlashcardModal } from './components/SRSFlashcardModal';
import { CustomScenarioModal } from './components/CustomScenarioModal';
import { RapidWarmupModal } from './components/RapidWarmupModal';
import { roleplayScenarios, initialUserProgress } from './data/mockData';
import { getDailyLessonPlan, getLessonPlanForScenario } from './data/lessonPlans';
import { getActivePersona } from './data/personas';
import { addPhrasesToSRS } from './services/srsService';
import { XPToastContainer } from './components/XPToast';
import { TierUpCelebrationModal } from './components/TierUpCelebrationModal';
import { TierRoadmapModal } from './components/TierRoadmapModal';
import {
  calculateEarnedXP,
  awardGamificationXP,
  subscribeGamification,
  type ActivityType,
  type XPCalculationResult,
} from './store/rewardSystem';
import { recordActivity } from './services/activityService';
import type { 
  UserProgress, 
  LessonPlan, 
  PhrasingUpgrade, 
  LessonStage, 
  CEFRLevel, 
  PlacementAssessmentResult, 
  AIPersona, 
  RoleplayScenario 
} from './types';
import { registerServiceWorker } from './pwa';
import { RefreshCw, Sparkles, BookmarkCheck } from 'lucide-react';
import { ToastContainer } from './components/ToastContainer';
import { playChime } from './services/speech';
import { authService, mergeUserProgressWithRemote } from './services/authService';
import { toast } from './services/toast';
import { formatDisplayName, normalizeUserAvatar } from './utils/nameFormatter';

const STORAGE_KEY = 'fluencyai_user_progress_v1';
const PLACEMENT_ASSESSED_KEY = 'fluency_placement_assessed_v1';
const DAILY_ID = 'daily-lesson-today';

export function App() {
  // Load saved progress or fallback to initial, merging with remote authenticated profile if present
  const [progress, setProgress] = useState<UserProgress>(() => {
    let local = initialUserProgress;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) local = { ...initialUserProgress, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Could not read user progress from localStorage', e);
    }
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
  });

  const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);
  const [lessonInitialStage, setLessonInitialStage] = useState<LessonStage>('scaffolding');
  const [activePersona, setActivePersonaState] = useState<AIPersona>(getActivePersona);
  const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
  const [isSRSOpen, setIsSRSOpen] = useState(false);
  const [isCustomScenarioOpen, setIsCustomScenarioOpen] = useState(false);
  const [isRapidWarmupOpen, setIsRapidWarmupOpen] = useState(false);
  const [customScenarios, setCustomScenarios] = useState<RoleplayScenario[]>([]);
  const [isJamesTestOpen, setIsJamesTestOpen] = useState(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const [isPlacementOpen, setIsPlacementOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [pendingLessonCallback, setPendingLessonCallback] = useState<(() => void) | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);

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

  // Listen for auth state changes (login, logout, profile update)
  useEffect(() => {
    const unsub = authService.onAuthStateChange((session) => {
      if (session?.user) {
        setProgress((prev) => mergeUserProgressWithRemote(prev, session.user));
      }
    });
    return unsub;
  }, []);

  // Sync progress to localStorage & VPS Cloud database
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
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
            },
          })
          .catch((err) => console.warn('[App] Cloud sync error:', err));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [progress]);

  // Register service worker on mount
  useEffect(() => {
    registerServiceWorker(() => {
      setHasUpdate(true);
    });
  }, []);

  /**
   * For new users who haven't completed placement, intercept before starting a full lesson
   */
  const checkPlacementBeforeLesson = (callback: () => void) => {
    const hasAssessed =
      localStorage.getItem(PLACEMENT_ASSESSED_KEY) === 'true' ||
      Boolean(progress.hasCompletedPlacement);

    if (!hasAssessed) {
      setPendingLessonCallback(() => callback);
      setIsPlacementOpen(true);
      return;
    }
    callback();
  };

  const openDailyLesson = (initialStage: LessonStage = 'scaffolding') => {
    checkPlacementBeforeLesson(() => {
      setLessonInitialStage(initialStage);
      setActivePlan(getDailyLessonPlan());
    });
  };

  const openScenario = (scenarioId: string, initialStage: LessonStage = 'scaffolding') => {
    checkPlacementBeforeLesson(() => {
      setLessonInitialStage(initialStage);
      setActivePlan(getLessonPlanForScenario(scenarioId));
    });
  };

  const handleCompletePlacement = (assessedLevel: CEFRLevel, details: PlacementAssessmentResult) => {
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

    // Immediate sync to VPS database
    if (authService.isAuthenticated()) {
      authService
        .syncProgress({
          level: assessedLevel,
          progress_data: {
            hasCompletedPlacement: true,
            placementDetails: details,
          },
        })
        .then(() => {
          console.info('[App] CEFR Level synced to VPS database:', assessedLevel);
        })
        .catch((err) => console.warn('[App] VPS level sync warning:', err));
    }

    toast.success(
      `Your level is calibrated to Level ${assessedLevel} (${details.title})! James has adapted vocabulary complexity.`,
      'Placement Complete'
    );

    // If user clicked to start a lesson, transition directly into that lesson
    if (pendingLessonCallback) {
      const cb = pendingLessonCallback;
      setPendingLessonCallback(null);
      cb();
    }
  };

  const handleLessonComplete = (plan: LessonPlan, customXPCalc?: XPCalculationResult) => {
    const isDaily = plan.id === DAILY_ID;
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
    setActivePlan(null);
  };

  const handleSaveMistakes = (plan: LessonPlan, upgrades: PhrasingUpgrade[]) => {
    addPhrasesToSRS(upgrades);
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
  };

  const handleRewardXP = (amount: number, activity: ActivityType = 'custom') => {
    const xpCalc = calculateEarnedXP(activity, amount);
    awardGamificationXP(xpCalc, 2);
    recordActivity(2, xpCalc.totalEarnedXP);

    setProgress((prev) => ({
      ...prev,
      completedXP: prev.completedXP + xpCalc.totalEarnedXP,
    }));
  };

  const handleLaunchCustomScenario = (scenario: RoleplayScenario, plan: LessonPlan) => {
    setCustomScenarios((prev) => [scenario, ...prev.filter((s) => s.id !== scenario.id)]);
    setActivePlan(plan);
    setLessonInitialStage('scaffolding');
  };

  const handleReloadApp = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  const [savedCount, setSavedCount] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('savedReviewPhrases');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.length;
      }
    } catch {
      /* ignore */
    }
    return progress.savedMistakes?.length ?? 0;
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const stored = localStorage.getItem('savedReviewPhrases');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setSavedCount(parsed.length);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('savedReviewPhrasesUpdated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('savedReviewPhrasesUpdated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const reviewCount = Math.max(savedCount, progress.savedMistakes?.length ?? 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Global Toast System */}
      <ToastContainer />

      {/* PWA Update Banner */}

      {hasUpdate && (
        <div className="sticky top-0 z-50 bg-brand-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>New lesson updates and offline improvements available!</span>
          </div>
          <button
            onClick={handleReloadApp}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-brand-700 font-bold hover:bg-brand-50 transition active:scale-95"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reload</span>
          </button>
        </div>
      )}

      {/* Navigation Header */}
      <Navbar
        progress={progress}
        onUpdateProgress={setProgress}
        onOpenInstallGuide={() => setIsInstallGuideOpen(true)}
        onOpenJamesTest={() => setIsJamesTestOpen(true)}
        onOpenPlacement={() => setIsPlacementOpen(true)}
        activePersona={activePersona}
        onOpenPersonaSelector={() => setIsPersonaSelectorOpen(true)}
        onOpenRoadmap={() => setIsRoadmapOpen(true)}
      />

      {/* Main App Container with responsive max-w-5xl layout and fluid spacing */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 pb-32 space-y-6">
        {/* Onboarding CEFR Placement Banner for new users */}
        {(!progress.hasCompletedPlacement && typeof window !== 'undefined' && localStorage.getItem(PLACEMENT_ASSESSED_KEY) !== 'true') && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white p-4 sm:p-5 shadow-soft border border-white/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                  🎯
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm sm:text-base text-white">Find Your CEFR Starting Level</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-wider">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-brand-100/90 leading-relaxed">
                    Take a friendly 3-turn interactive check with James so he adjusts vocabulary complexity and speaking speed to your exact level.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  playChime('tap');
                  setIsPlacementOpen(true);
                }}
                className="py-2.5 px-4 rounded-2xl bg-white hover:bg-brand-50 text-brand-900 font-black text-xs shadow-md transition active:scale-95 flex-shrink-0 flex items-center justify-center gap-1.5"
              >
                <span>🎙️ Start Placement (2 min)</span>
              </button>
            </div>
          </div>
        )}

        {/* Daily Goal & Welcoming Section */}
        <DailyGoalCard
          progress={progress}
          onUpdateProgress={setProgress}
          onStartLesson={() => openDailyLesson('scaffolding')}
          onOpenSRS={() => setIsSRSOpen(true)}
          onOpenWarmup={() => setIsRapidWarmupOpen(true)}
          onOpenRoadmap={() => setIsRoadmapOpen(true)}
        />

        {/* James AI Test Area & Direct Voice Sandbox Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-brand-950 to-indigo-950 text-white p-5 shadow-soft border border-brand-500/30">
          <div className="pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative z-10 space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner flex-shrink-0 backdrop-blur-xs">
                  🧑‍💼
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black tracking-tight text-white">James AI Test Lab</h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                      Direct Mode
                    </span>
                  </div>
                  <p className="text-xs text-brand-100/80 mt-0.5">
                    Talk directly with James • Zero phrase preparation • Test speech & pronunciation
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Test how James responds in real-time, drill difficult words with syllable breakdowns, test grammar slips, or chat freely with your London colleague.
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  playChime('tap');
                  setIsJamesTestOpen(true);
                }}
                className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-brand-500 hover:from-amber-300 hover:to-brand-400 text-slate-950 font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>🎙️ Enter James Test Area</span>
              </button>

              <button
                onClick={() => {
                  playChime('tap');
                  openDailyLesson('roleplay');
                }}
                className="py-2.5 px-3.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5"
                title="Open Daily Lesson skipping straight to Stage 2 Live Roleplay"
              >
                <span>⚡ Stage 2 Roleplay</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tomorrow's review queue */}
        {reviewCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div className="text-xs text-amber-900">
              <div className="font-bold">{reviewCount} phrases queued for your next lesson warm-up</div>
              <div className="text-amber-700">Saved from your scorecards — automatically injected into Stage 1 Prep.</div>
            </div>
          </div>
        )}

        {/* Upcoming Roleplay Scenarios Section */}
        <RoleplayList
          scenarios={[...customScenarios, ...roleplayScenarios]}
          progress={progress}
          onSelectScenario={(scenario) => openScenario(scenario.id)}
          onOpenCustomBuilder={() => setIsCustomScenarioOpen(true)}
        />
      </main>

      {/* Floating Action Button: Start Daily Lesson */}
      {!activePlan && (
        <StartDailyLessonFAB onStartLesson={() => openDailyLesson('scaffolding')} isCompletedToday={progress.hasCompletedDailyLessonToday} />
      )}

      {/* 3-stage lesson flow: Prep → Live Roleplay → Scorecard */}
      {activePlan && (
        <LessonFlow
          key={activePlan.id}
          plan={activePlan}
          nativeLanguage={progress.nativeLanguage}
          userLevel={progress.level}
          audioSpeed={progress.audioSpeed}
          savedMistakeIds={(progress.savedMistakes ?? []).map((m) => m.id)}
          initialStage={lessonInitialStage}
          onSaveMistakes={handleSaveMistakes}
          onComplete={handleLessonComplete}
          onExit={() => setActivePlan(null)}
        />
      )}

      {/* Dynamic Multi-Persona Voice Coach Selector */}
      {isPersonaSelectorOpen && (
        <PersonaSelectorModal
          isOpen={isPersonaSelectorOpen}
          onClose={() => setIsPersonaSelectorOpen(false)}
          activePersona={activePersona}
          onSelectPersona={(p) => {
            setActivePersonaState(p);
            setProgress((prev) => ({ ...prev, activePersonaId: p.id }));
          }}
        />
      )}

      {/* Spaced Repetition (SRS) Flashcard Drill Studio */}
      {isSRSOpen && (
        <SRSFlashcardModal
          isOpen={isSRSOpen}
          onClose={() => setIsSRSOpen(false)}
          onRewardXP={handleRewardXP}
          persona={activePersona}
        />
      )}

      {/* AI-Powered Real-World Scenario Builder */}
      {isCustomScenarioOpen && (
        <CustomScenarioModal
          isOpen={isCustomScenarioOpen}
          onClose={() => setIsCustomScenarioOpen(false)}
          activePersona={activePersona}
          userLevel={progress.level}
          nativeLanguage={progress.nativeLanguage}
          onLaunchScenario={handleLaunchCustomScenario}
        />
      )}

      {/* 60-Second Rapid-Fire Spoken Warmup */}
      {isRapidWarmupOpen && (
        <RapidWarmupModal
          isOpen={isRapidWarmupOpen}
          onClose={() => setIsRapidWarmupOpen(false)}
          onRewardXP={handleRewardXP}
          persona={activePersona}
        />
      )}

      {/* Interactive CEFR Placement Assessment Modal */}
      {isPlacementOpen && (
        <PlacementModal
          isOpen={isPlacementOpen}
          onClose={() => {
            setIsPlacementOpen(false);
            setPendingLessonCallback(null);
          }}
          onCompletePlacement={handleCompletePlacement}
          audioSpeed={progress.audioSpeed}
          initialLevel={progress.level}
        />
      )}

      {/* James Test Area Modal */}
      {isJamesTestOpen && (
        <JamesTestAreaModal
          isOpen={isJamesTestOpen}
          onClose={() => setIsJamesTestOpen(false)}
          audioSpeed={progress.audioSpeed}
          onOpenLessonRoleplay={() => openDailyLesson('roleplay')}
        />
      )}

      {/* PWA Installation Guide Modal */}
      {isInstallGuideOpen && <PWAInstallGuideModal onClose={() => setIsInstallGuideOpen(false)} />}

      {/* Floating Micro-Celebration XP Toast Container */}
      <XPToastContainer />

      {/* Tier Promotion & Daily Goal Celebration Modal */}
      <TierUpCelebrationModal
        onOpenRoadmap={() => setIsRoadmapOpen(true)}
        onOpenStage2Roleplay={() => openDailyLesson('roleplay')}
      />

      {/* Full Fluency Journey & Rewards Roadmap Modal */}
      <TierRoadmapModal
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
        onOpenStage2Roleplay={() => {
          setIsRoadmapOpen(false);
          openDailyLesson('roleplay');
        }}
      />
    </div>
  );
}

export default App;
