import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DailyGoalCard } from './components/DailyGoalCard';
import { RoleplayList } from './components/RoleplayList';
import { StartDailyLessonFAB } from './components/StartDailyLessonFAB';
import { PWAInstallGuideModal } from './components/PWAInstallGuideModal';
import { LessonFlow } from './components/lesson/LessonFlow';
import { roleplayScenarios, initialUserProgress } from './data/mockData';
import { getDailyLessonPlan, getLessonPlanForScenario } from './data/lessonPlans';
import type { UserProgress, LessonPlan, PhrasingUpgrade } from './types';
import { registerServiceWorker } from './pwa';
import { RefreshCw, Sparkles, BookmarkCheck } from 'lucide-react';

const STORAGE_KEY = 'fluencyai_user_progress_v1';
const DAILY_ID = 'daily-lesson-today';

export function App() {
  // Load saved progress or fallback to initial
  const [progress, setProgress] = useState<UserProgress>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...initialUserProgress, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Could not read user progress from localStorage', e);
    }
    return initialUserProgress;
  });

  const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);

  // Sync progress to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      console.warn('Could not save user progress to localStorage', e);
    }
  }, [progress]);

  // Register service worker on mount
  useEffect(() => {
    registerServiceWorker(() => {
      setHasUpdate(true);
    });
  }, []);

  const openDailyLesson = () => setActivePlan(getDailyLessonPlan());
  const openScenario = (scenarioId: string) => setActivePlan(getLessonPlanForScenario(scenarioId));

  const handleLessonComplete = (plan: LessonPlan) => {
    setProgress((prev) => {
      const isDaily = plan.id === DAILY_ID;
      return {
        ...prev,
        hasCompletedDailyLessonToday: prev.hasCompletedDailyLessonToday || isDaily,
        completedScenarioIds:
          isDaily || prev.completedScenarioIds.includes(plan.id)
            ? prev.completedScenarioIds
            : [...prev.completedScenarioIds, plan.id],
        completedXP: Math.min(prev.dailyGoalXP, prev.completedXP + plan.xpReward),
        completedMinutes: Math.min(prev.dailyGoalMinutes, prev.completedMinutes + plan.minutes),
      };
    });
    setActivePlan(null);
  };

  const handleSaveMistakes = (plan: LessonPlan, upgrades: PhrasingUpgrade[]) => {
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
      />

      {/* Main Mobile App Container with pb-32 to guarantee floating button never overlaps Conversational Roleplays heading */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4 pb-32 space-y-5">
        {/* Daily Goal & Welcoming Section */}
        <DailyGoalCard progress={progress} onUpdateProgress={setProgress} onStartLesson={openDailyLesson} />

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
          scenarios={roleplayScenarios}
          progress={progress}
          onSelectScenario={(scenario) => openScenario(scenario.id)}
        />
      </main>

      {/* Floating Action Button: Start Daily Lesson */}
      {!activePlan && (
        <StartDailyLessonFAB onStartLesson={openDailyLesson} isCompletedToday={progress.hasCompletedDailyLessonToday} />
      )}

      {/* 3-stage lesson flow: Prep → Live Roleplay → Scorecard */}
      {activePlan && (
        <LessonFlow
          key={activePlan.id}
          plan={activePlan}
          nativeLanguage={progress.nativeLanguage}
          audioSpeed={progress.audioSpeed}
          savedMistakeIds={(progress.savedMistakes ?? []).map((m) => m.id)}
          onSaveMistakes={handleSaveMistakes}
          onComplete={handleLessonComplete}
          onExit={() => setActivePlan(null)}
        />
      )}

      {/* PWA Installation Guide Modal */}
      {isInstallGuideOpen && <PWAInstallGuideModal onClose={() => setIsInstallGuideOpen(false)} />}
    </div>
  );
}

export default App;
