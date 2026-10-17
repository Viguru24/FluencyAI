import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DailyGoalCard } from './components/DailyGoalCard';
import { RoleplayList } from './components/RoleplayList';
import { PWAInstallGuideModal } from './components/PWAInstallGuideModal';
import { LessonFlow } from './components/lesson/LessonFlow';
import { JamesTestAreaModal } from './components/JamesTestAreaModal';
import { PlacementModal } from './components/PlacementModal';
import { PersonaSelectorModal } from './components/PersonaSelectorModal';
import { SRSFlashcardModal } from './components/SRSFlashcardModal';
import { CustomScenarioModal } from './components/CustomScenarioModal';
import { RapidWarmupModal } from './components/RapidWarmupModal';
import { OnboardingModal } from './components/OnboardingModal';
import { PricingModal } from './components/PricingModal';
import { roleplayScenarios } from './data/mockData';
import { getDailyLessonPlan, getLessonPlanForScenario } from './data/lessonPlans';
import { XPToastContainer } from './components/XPToast';
import { TierUpCelebrationModal } from './components/TierUpCelebrationModal';
import { TierRoadmapModal } from './components/TierRoadmapModal';
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
import { RefreshCw, Sparkles, BookmarkCheck } from 'lucide-react';
import { ToastContainer } from './components/ToastContainer';
import { toast } from './services/toast';
import { playChime } from './services/speech';

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
    completePlacement,
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
  const [pendingLessonCallback, setPendingLessonCallback] = useState<(() => void) | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    registerServiceWorker(() => {
      setHasUpdate(true);
    });
  }, []);

  const checkPlacementBeforeLesson = (callback: () => void) => {
    if (!isPlacementCompleted) {
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
    completePlacement(assessedLevel, details);
    if (pendingLessonCallback) {
      const cb = pendingLessonCallback;
      setPendingLessonCallback(null);
      cb();
    }
  };

  const handleLessonComplete = (plan: LessonPlan, customXPCalc?: XPCalculationResult) => {
    completeLesson(plan, customXPCalc);
    setActivePlan(null);
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

  const reviewCount = Math.max(savedCardsCount, progress.savedMistakes?.length ?? 0);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <ToastContainer />

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
        onOpenInstallGuide={() => setIsInstallGuideOpen(true)}
        onOpenPlacement={() => setIsPlacementOpen(true)}
        activePersona={activePersona}
        onOpenPersonaSelector={() => setIsPersonaSelectorOpen(true)}
        onOpenRoadmap={() => setIsRoadmapOpen(true)}
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
      />

      {/* Main App Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3.5 sm:px-6 py-4 pb-16 space-y-5">
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

              <button
                onClick={() => {
                  playChime('tap');
                  setIsPlacementOpen(true);
                }}
                className="w-full sm:w-auto py-2.5 px-4 rounded-2xl bg-white hover:bg-brand-50 text-brand-900 font-black text-xs shadow-md transition active:scale-95 flex-shrink-0 flex items-center justify-center gap-1.5"
              >
                <span>🎙️ Start Placement (2 min)</span>
              </button>
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
          onOpenFreeTalk={() => setIsFreeTalkOpen(true)}
          onOpenSRS={() => setIsSRSOpen(true)}
          onOpenWarmup={() => setIsRapidWarmupOpen(true)}
          onOpenRoadmap={() => setIsRoadmapOpen(true)}
        />

        {/* Review Queue Indicator */}
        {reviewCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
                <BookmarkCheck className="w-5 h-5" />
              </div>
              <div className="text-xs text-amber-900 dark:text-amber-200 min-w-0">
                <div className="font-bold">{reviewCount} saved phrases in your review deck</div>
                <div className="text-amber-700 dark:text-amber-400">Automatically included in Stage 1 Prep &amp; SRS Flashcards.</div>
              </div>
            </div>
            <button
              onClick={() => {
                playChime('tap');
                setIsSRSOpen(true);
              }}
              className="w-full sm:w-auto text-center px-3.5 py-2 sm:py-1.5 rounded-xl bg-amber-200/70 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 text-xs font-bold transition flex-shrink-0"
            >
              Review Deck
            </button>
          </div>
        )}

        {/* Conversational Roleplay Scenarios */}
        <RoleplayList
          scenarios={[...customScenarios, ...roleplayScenarios]}
          progress={progress}
          onSelectScenario={(scenario) => openScenario(scenario.id)}
          onOpenCustomBuilder={() => setIsCustomScenarioOpen(true)}
        />
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
          onExit={() => setActivePlan(null)}
        />
      )}

      {/* Dynamic Multi-Persona Voice Coach Selector */}
      {isPersonaSelectorOpen && (
        <PersonaSelectorModal
          isOpen={isPersonaSelectorOpen}
          onClose={() => setIsPersonaSelectorOpen(false)}
          activePersona={activePersona}
          onSelectPersona={selectPersona}
        />
      )}

      {/* Spaced Repetition (SRS) Flashcard Drill Studio */}
      {isSRSOpen && (
        <SRSFlashcardModal
          isOpen={isSRSOpen}
          onClose={() => setIsSRSOpen(false)}
          onRewardXP={rewardXP}
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
          onRewardXP={rewardXP}
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

      {/* Free Talk with Active Coach Modal */}
      {isFreeTalkOpen && (
        <JamesTestAreaModal
          isOpen={isFreeTalkOpen}
          onClose={() => setIsFreeTalkOpen(false)}
          audioSpeed={progress.audioSpeed}
          persona={activePersona}
          userLevel={progress.level}
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

      {/* Ultra-Simple Onboarding Setup Flow */}
      {isOnboardingOpen && (
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          progress={progress}
          onUpdateProgress={setProgress}
          onComplete={({ startPlacement }) => {
            completeOnboarding();
            setIsOnboardingOpen(false);
            if (startPlacement) {
              setIsPlacementOpen(true);
            }
          }}
        />
      )}

      {/* Stripe Pricing & Sales Page Modal */}
      {isPricingOpen && (
        <PricingModal
          isOpen={isPricingOpen}
          onClose={() => setIsPricingOpen(false)}
          onSuccess={(planTier) => {
            toast.success(`Welcome to FluencyAI ${planTier.toUpperCase()}!`, 'Plan Activated');
          }}
        />
      )}
    </div>
  );
}

export default App;
