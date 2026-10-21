import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Navbar } from './components/Navbar';
import { DailyGoalCard } from './components/DailyGoalCard';
import { RoleplayList } from './components/RoleplayList';
import { LessonFlow } from './components/lesson/LessonFlow';
import { OnboardingModal } from './components/OnboardingModal';
import { roleplayScenarios } from './data/mockData';
import { getDailyLessonPlan, getLessonPlanForScenario } from './data/lessonPlans';
import { XPToastContainer } from './components/XPToast';

const JamesTestAreaModal = lazy(() => import('./components/JamesTestAreaModal').then((m) => ({ default: m.JamesTestAreaModal })));
const PlacementModal = lazy(() => import('./components/PlacementModal').then((m) => ({ default: m.PlacementModal })));
const PersonaSelectorModal = lazy(() => import('./components/PersonaSelectorModal').then((m) => ({ default: m.PersonaSelectorModal })));
const SRSFlashcardModal = lazy(() => import('./components/SRSFlashcardModal').then((m) => ({ default: m.SRSFlashcardModal })));
const CustomScenarioModal = lazy(() => import('./components/CustomScenarioModal').then((m) => ({ default: m.CustomScenarioModal })));
const RapidWarmupModal = lazy(() => import('./components/RapidWarmupModal').then((m) => ({ default: m.RapidWarmupModal })));
const PricingModal = lazy(() => import('./components/PricingModal').then((m) => ({ default: m.PricingModal })));
const TierRoadmapModal = lazy(() => import('./components/TierRoadmapModal').then((m) => ({ default: m.TierRoadmapModal })));
const TierUpCelebrationModal = lazy(() => import('./components/TierUpCelebrationModal').then((m) => ({ default: m.TierUpCelebrationModal })));
const PWAInstallGuideModal = lazy(() => import('./components/PWAInstallGuideModal').then((m) => ({ default: m.PWAInstallGuideModal })));
const InvestorPitchPage = lazy(() => import('./components/InvestorPitchPage').then((m) => ({ default: m.InvestorPitchPage })));

import type { XPCalculationResult } from './store/rewardSystem';
import { useUserStore } from './store/userStore';
import type {
  LessonPlan,
  LessonStage,
  CEFRLevel,
  PlacementAssessmentResult,
  RoleplayScenario,
} from './types';
import { registerServiceWorker } from './pwa';
import {
  hydratePersistentVaultAsync,
  requestPersistentStorage,
  flushKeyVaultBeforeUpdate,
} from './services/persistentKeyVault';
import { getLLMConfig } from './services/llmConfig';
import { RefreshCw, Sparkles, BookmarkCheck, RotateCcw, X, EyeOff, Eye, ArrowRight } from 'lucide-react';
import { ToastContainer } from './components/ToastContainer';
import { toast } from './services/toast';
import { playChime, stopSpeaking } from './services/speech';
import { isDevMode } from './utils/devMode';
import { navigationHistory } from './services/navigationHistory';

export function App() {
  const {
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
  } = useUserStore();

  const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);
  const [lessonInitialStage, setLessonInitialStage] = useState<LessonStage>('scaffolding');
  const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
  const [isSRSOpen, setIsSRSOpen] = useState(false);
  const [isCustomScenarioOpen, setIsCustomScenarioOpen] = useState(false);
  const [isRapidWarmupOpen, setIsRapidWarmupOpen] = useState(false);
  const [customScenarios, setCustomScenarios] = useState<RoleplayScenario[]>([]);
  const [isFreeTalkOpen, setIsFreeTalkOpen] = useState(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const [isPlacementOpen, setIsPlacementOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(!isOnboardingCompleted);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isInvestorOpen, setIsInvestorOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace('#', '').toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    return (
      urlParams.get('view') === 'investor' ||
      urlParams.get('page') === 'investor' ||
      hash === 'investor' ||
      pathname.endsWith('/investor') ||
      pathname.endsWith('/investor/')
    );
  });
  const [pendingLessonCallback, setPendingLessonCallback] = useState<(() => void) | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const touchStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);

  const isAnyModalOpen = Boolean(
    activePlan ||
      isPersonaSelectorOpen ||
      isSRSOpen ||
      isCustomScenarioOpen ||
      isRapidWarmupOpen ||
      isFreeTalkOpen ||
      isInstallGuideOpen ||
      isPlacementOpen ||
      isRoadmapOpen ||
      isOnboardingOpen ||
      isPricingOpen ||
      isInvestorOpen
  );

  const closeAllToHome = () => {
    navigationHistory.navigateToHome();
  };

  useEffect(() => {
    // Initialize navigation history manager to intercept back clicks
    navigationHistory.init();

    const unsubscribeNav = navigationHistory.subscribe((view) => {
      if (view === 'home') {
        stopSpeaking();
        setActivePlan(null);
        setIsPersonaSelectorOpen(false);
        setIsSRSOpen(false);
        setIsCustomScenarioOpen(false);
        setIsRapidWarmupOpen(false);
        setIsFreeTalkOpen(false);
        setIsInstallGuideOpen(false);
        setIsPlacementOpen(false);
        setIsRoadmapOpen(false);
        setIsPricingOpen(false);
        setIsOnboardingOpen(false);
        setIsInvestorOpen(false);
        setPendingLessonCallback(null);
        window.dispatchEvent(new CustomEvent('fluency_close_nav_modals'));
      } else if (view === 'investor') {
        setIsInvestorOpen(true);
      }
    });

    // 1. Lock in persistent storage with mobile OS (iOS Safari / Android Chrome)
    requestPersistentStorage().catch(() => {});

    // 2. Hydrate key vault from IndexedDB, SessionStorage, and Cookies if LocalStorage was cleared
    hydratePersistentVaultAsync(getLLMConfig()).catch(() => {});

    registerServiceWorker(() => {
      setHasUpdate(true);
    });

    return () => {
      unsubscribeNav();
      navigationHistory.destroy();
    };
  }, []);

  const checkPlacementBeforeLesson = (callback: () => void) => {
    if (!isPlacementCompleted) {
      setPendingLessonCallback(() => callback);
      setIsPlacementOpen(true);
      navigationHistory.pushView('placement');
      return;
    }
    callback();
  };

  const openDailyLesson = (initialStage: LessonStage = 'scaffolding') => {
    checkPlacementBeforeLesson(() => {
      setLessonInitialStage(initialStage);
      setActivePlan(getDailyLessonPlan());
      navigationHistory.pushView('lesson');
    });
  };

  const openScenario = (scenarioId: string, initialStage: LessonStage = 'scaffolding') => {
    checkPlacementBeforeLesson(() => {
      setLessonInitialStage(initialStage);
      setActivePlan(getLessonPlanForScenario(scenarioId));
      navigationHistory.pushView('lesson');
    });
  };

  const handleCompletePlacement = (assessedLevel: CEFRLevel, details: PlacementAssessmentResult) => {
    completePlacement(assessedLevel, details);
    if (pendingLessonCallback) {
      const cb = pendingLessonCallback;
      setPendingLessonCallback(null);
      cb();
    } else {
      closeAllToHome();
    }
  };

  const handleDismissPlacement = () => {
    playChime('tap');
    dismissPlacement();
    if (pendingLessonCallback) {
      const cb = pendingLessonCallback;
      setPendingLessonCallback(null);
      cb();
    } else {
      closeAllToHome();
    }
    toast.info('Removed "Find Your CEFR Starting Level" banner.', 'Placement Dismissed');
  };

  const handleRestorePlacementBanner = () => {
    playChime('tap');
    resetPlacement();
    toast.info('Restored "Find Your CEFR Starting Level" banner.', 'Testing Mode');
  };

  const handleRestartOnboarding = () => {
    playChime('tap');
    restartOnboarding();
    setIsOnboardingOpen(true);
    navigationHistory.pushView('onboarding');
    toast.info('Onboarding flow restarted from Step 1.', 'Testing Mode');
  };

  const handleLessonComplete = (plan: LessonPlan, customXPCalc?: XPCalculationResult) => {
    completeLesson(plan, customXPCalc);
    closeAllToHome();
  };

  const handleLaunchCustomScenario = (scenario: RoleplayScenario, plan: LessonPlan) => {
    setCustomScenarios((prev) => [scenario, ...prev.filter((s) => s.id !== scenario.id)]);
    setActivePlan(plan);
    setLessonInitialStage('scaffolding');
    navigationHistory.pushView('lesson');
  };

  const handleReloadApp = () => {
    // Flush active keys to all storage tiers prior to service worker activation & reload
    flushKeyVaultBeforeUpdate();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  useEffect(() => {
    const PULL_THRESHOLD = 65;

    const handleTouchStart = (e: TouchEvent) => {
      if (isAnyModalOpen || isPullRefreshing || window.scrollY > 0) {
        touchStartYRef.current = null;
        return;
      }
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === null || isAnyModalOpen || isPullRefreshing) return;
      if (window.scrollY > 0) {
        touchStartYRef.current = null;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      const deltaY = e.touches[0].clientY - touchStartYRef.current;
      if (deltaY > 12) {
        const damped = Math.min(110, (deltaY - 12) * 0.45);
        pullDistanceRef.current = damped;
        setPullDistance(damped);
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (touchStartYRef.current === null) return;
      touchStartYRef.current = null;

      if (pullDistanceRef.current >= PULL_THRESHOLD && !isPullRefreshing) {
        setIsPullRefreshing(true);
        setPullDistance(56);
        playChime('tap');
        setTimeout(() => {
          handleReloadApp();
        }, 250);
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isAnyModalOpen, isPullRefreshing]);

  const reviewCount = Math.max(savedCardsCount, progress.savedMistakes?.length ?? 0);
  const devMode = isDevMode();

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <ToastContainer />

      {/* Mobile Pull-to-Refresh Indicator */}
      {(pullDistance > 0 || isPullRefreshing) && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-transform duration-150 ease-out"
          style={{ top: `${Math.min(72, Math.max(12, pullDistance))}px` }}
        >
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 dark:bg-slate-900/95 border border-brand-200 dark:border-brand-700 shadow-lg backdrop-blur-md text-xs font-extrabold text-brand-700 dark:text-brand-300">
            <RefreshCw
              className={`w-4 h-4 text-brand-600 dark:text-brand-400 ${
                isPullRefreshing ? 'animate-spin' : ''
              }`}
              style={
                !isPullRefreshing
                  ? { transform: `rotate(${Math.round(pullDistance * 4)}deg)` }
                  : undefined
              }
            />
            <span>
              {isPullRefreshing
                ? 'Refreshing...'
                : pullDistance >= 65
                ? 'Release to refresh'
                : 'Pull down to refresh'}
            </span>
          </div>
        </div>
      )}

      {hasUpdate && (
        <div className="sticky top-0 z-50 bg-brand-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <span className="truncate">New lesson updates and offline improvements available!</span>
          </div>
          <button
            onClick={handleReloadApp}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-brand-700 font-bold hover:bg-brand-50 transition active:scale-95 flex-shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reload</span>
          </button>
        </div>
      )}

      {/* Streamlined Navigation Header */}
      <Navbar
        progress={progress}
        onUpdateProgress={setProgress}
        onOpenInstallGuide={() => {
          setIsInstallGuideOpen(true);
          navigationHistory.pushView('install-guide');
        }}
        onOpenPlacement={() => {
          setIsPlacementOpen(true);
          navigationHistory.pushView('placement');
        }}
        activePersona={activePersona}
        onOpenPersonaSelector={() => {
          setIsPersonaSelectorOpen(true);
          navigationHistory.pushView('persona');
        }}
        onOpenRoadmap={() => {
          setIsRoadmapOpen(true);
          navigationHistory.pushView('roadmap');
        }}
        onOpenPricing={() => {
          setIsPricingOpen(true);
          navigationHistory.pushView('pricing');
        }}
        onOpenInvestor={() => {
          setIsInvestorOpen(true);
          navigationHistory.pushView('investor');
        }}
        onOpenOnboarding={handleRestartOnboarding}
      />

      {/* Main App Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3.5 sm:px-6 py-4 pb-16 space-y-5">
        {/* Quick Testing Controls Bar (Dev Mode Only) */}
        {devMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                🛠️ Testing Controls
              </span>
              <span className="hidden sm:inline text-slate-500 dark:text-slate-400 font-medium">
                Quickly test onboarding or toggle the CEFR starting level prompt
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRestartOnboarding}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-2xs transition active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart Onboarding</span>
              </button>

              {!isPlacementCompleted ? (
                <button
                  type="button"
                  onClick={handleDismissPlacement}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-2xs transition active:scale-95"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Remove CEFR Starting Level</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRestorePlacementBanner}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5 text-brand-500" />
                  <span>Restore CEFR Level Banner</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Onboarding CEFR Placement Banner for new users */}
        {!isPlacementCompleted && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white p-4 sm:p-5 shadow-soft border border-white/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                  🎯
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm sm:text-base text-white">Find Your CEFR Starting Level</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-wider">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-brand-100/90 leading-relaxed">
                    Take a friendly 3-turn interactive check with {activePersona.name} so vocabulary complexity and speaking speed match your exact level.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                <button
                  onClick={() => {
                    playChime('tap');
                    setIsPlacementOpen(true);
                    navigationHistory.pushView('placement');
                  }}
                  className="flex-1 sm:flex-initial py-2.5 px-4 rounded-2xl bg-white hover:bg-brand-50 text-brand-900 font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>🎙️ Start Placement (2 min)</span>
                </button>

                <button
                  onClick={handleDismissPlacement}
                  title="Dismiss Find Your CEFR Starting Level"
                  className="py-2.5 px-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Dismiss</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Daily Goal, Primary Hero Session & Quick Practice Modes */}
        <DailyGoalCard
          progress={progress}
          activePersona={activePersona}
          onUpdateProgress={setProgress}
          onStartLesson={() => openDailyLesson('scaffolding')}
          onStartDirectRoleplay={() => openDailyLesson('roleplay')}
          onOpenFreeTalk={() => {
            setIsFreeTalkOpen(true);
            navigationHistory.pushView('free-talk');
          }}
          onOpenSRS={() => {
            setIsSRSOpen(true);
            navigationHistory.pushView('phrasebook');
          }}
          onOpenWarmup={() => {
            setIsRapidWarmupOpen(true);
            navigationHistory.pushView('warmup');
          }}
          onOpenRoadmap={() => {
            setIsRoadmapOpen(true);
            navigationHistory.pushView('roadmap');
          }}
        />

        {/* Review Queue Indicator */}
        {reviewCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
                <BookmarkCheck className="w-5 h-5" />
              </div>
              <div className="text-xs text-amber-900 dark:text-amber-200 min-w-0">
                <div className="font-bold">{reviewCount} saved phrases in your phrasebook</div>
                <div className="text-amber-700 dark:text-amber-400">Automatically included in Stage 1 Prep &amp; Saved Phrases.</div>
              </div>
            </div>
            <button
              onClick={() => {
                playChime('tap');
                setIsSRSOpen(true);
                navigationHistory.pushView('phrasebook');
              }}
              className="w-full sm:w-auto text-center px-3.5 py-2 sm:py-1.5 rounded-xl bg-amber-200/70 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 text-xs font-bold transition flex-shrink-0"
            >
              📌 My Saved Phrasebook
            </button>
          </div>
        )}

        {/* Conversational Roleplay Scenarios */}
        <RoleplayList
          scenarios={[...customScenarios, ...roleplayScenarios]}
          progress={progress}
          onSelectScenario={(scenario) => openScenario(scenario.id)}
          onOpenCustomBuilder={() => {
            setIsCustomScenarioOpen(true);
            navigationHistory.pushView('custom-scenario');
          }}
        />

        {/* Partner & Vision Briefing Quick Card */}
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-200/80 dark:border-indigo-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-xs flex-shrink-0">
              🤝
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Partner &amp; Vision Briefing
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider">
                  Vision
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                Discover our mission to bridge the global fluency gap, educational architecture, sustainable business model, and long-term collaborative roadmap.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playChime('tap');
              setIsInvestorOpen(true);
              navigationHistory.pushView('investor');
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition active:scale-95 shadow-xs flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            <span>Explore Partner Vision</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </main>

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
          onSaveMistakes={saveMistakes}
          onComplete={handleLessonComplete}
          onExit={closeAllToHome}
        />
      )}

      {/* Dynamic Multi-Persona Voice Coach Selector */}
      {/* Suspense wrapper for lazy-loaded secondary modals */}
      <Suspense fallback={null}>
        {/* Dynamic Multi-Persona Voice Coach Selector */}
        {isPersonaSelectorOpen && (
          <PersonaSelectorModal
            isOpen={isPersonaSelectorOpen}
            onClose={closeAllToHome}
            activePersona={activePersona}
            onSelectPersona={selectPersona}
          />
        )}

        {/* Saved Phrases & Flashcards Drill Studio */}
        {isSRSOpen && (
          <SRSFlashcardModal
            isOpen={isSRSOpen}
            onClose={closeAllToHome}
            onRewardXP={rewardXP}
            persona={activePersona}
          />
        )}

        {/* AI-Powered Real-World Scenario Builder */}
        {isCustomScenarioOpen && (
          <CustomScenarioModal
            isOpen={isCustomScenarioOpen}
            onClose={closeAllToHome}
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
            onClose={closeAllToHome}
            onRewardXP={rewardXP}
            persona={activePersona}
          />
        )}

        {/* Interactive CEFR Placement Assessment Modal */}
        {isPlacementOpen && (
          <PlacementModal
            isOpen={isPlacementOpen}
            onClose={closeAllToHome}
            onCompletePlacement={handleCompletePlacement}
            onSkipPlacement={handleDismissPlacement}
            audioSpeed={progress.audioSpeed}
            initialLevel={progress.level}
          />
        )}

        {/* Free Talk with Active Coach Modal */}
        {isFreeTalkOpen && (
          <JamesTestAreaModal
            isOpen={isFreeTalkOpen}
            onClose={closeAllToHome}
            audioSpeed={progress.audioSpeed}
            persona={activePersona}
            userLevel={progress.level}
            onOpenLessonRoleplay={() => openDailyLesson('roleplay')}
          />
        )}

        {/* PWA Installation Guide Modal */}
        {isInstallGuideOpen && <PWAInstallGuideModal onClose={closeAllToHome} />}

        {/* Tier Promotion & Daily Goal Celebration Modal */}
        <TierUpCelebrationModal
          onOpenRoadmap={() => {
            setIsRoadmapOpen(true);
            navigationHistory.pushView('roadmap');
          }}
          onOpenStage2Roleplay={() => openDailyLesson('roleplay')}
        />

        {/* Full Fluency Journey & Rewards Roadmap Modal */}
        <TierRoadmapModal
          isOpen={isRoadmapOpen}
          onClose={closeAllToHome}
          onOpenStage2Roleplay={() => {
            closeAllToHome();
            openDailyLesson('roleplay');
          }}
        />

        {/* Stripe Pricing & Sales Page Modal */}
        {isPricingOpen && (
          <PricingModal
            isOpen={isPricingOpen}
            onClose={closeAllToHome}
            onSuccess={(planTier) => {
              toast.success(`Welcome to FluencyAI ${planTier.toUpperCase()}!`, 'Plan Activated');
            }}
          />
        )}

        {/* Dedicated Full-Page Partner Vision & Briefing */}
        {isInvestorOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 dark:bg-slate-950 animate-fade-in">
            <InvestorPitchPage
              onBackToApp={() => {
                setIsInvestorOpen(false);
                closeAllToHome();
              }}
              onLaunchRoleplay={() => {
                setIsInvestorOpen(false);
                openDailyLesson('roleplay');
              }}
              onLaunchPlacement={() => {
                setIsInvestorOpen(false);
                setIsPlacementOpen(true);
                navigationHistory.pushView('placement');
              }}
              onLaunchWarmup={() => {
                setIsInvestorOpen(false);
                setIsRapidWarmupOpen(true);
                navigationHistory.pushView('warmup');
              }}
              onOpenPricing={() => {
                setIsInvestorOpen(false);
                setIsPricingOpen(true);
                navigationHistory.pushView('pricing');
              }}
            />
          </div>
        )}
      </Suspense>

      {/* Floating Micro-Celebration XP Toast Container */}
      <XPToastContainer />

      {/* Ultra-Simple Onboarding Setup Flow */}
      {isOnboardingOpen && (
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onClose={closeAllToHome}
          progress={progress}
          onUpdateProgress={setProgress}
          onComplete={({ startPlacement }) => {
            completeOnboarding();
            closeAllToHome();
            if (startPlacement) {
              setIsPlacementOpen(true);
              navigationHistory.pushView('placement');
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
