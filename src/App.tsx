import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DailyGoalCard } from './components/DailyGoalCard';
import { RoleplayList } from './components/RoleplayList';
import { StartDailyLessonFAB } from './components/StartDailyLessonFAB';
import { RoleplayModal } from './components/RoleplayModal';
import { DailyLessonModal } from './components/DailyLessonModal';
import { PWAInstallGuideModal } from './components/PWAInstallGuideModal';
import { roleplayScenarios, dailyLessonMock, initialUserProgress } from './data/mockData';
import type { UserProgress, RoleplayScenario } from './types';
import { registerServiceWorker } from './pwa';
import { RefreshCw, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'fluencyai_user_progress_v1';

export function App() {
  // Load saved progress or fallback to initial
  const [progress, setProgress] = useState<UserProgress>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not read user progress from localStorage', e);
    }
    return initialUserProgress;
  });

  const [activeScenario, setActiveScenario] = useState<RoleplayScenario | null>(null);
  const [isDailyLessonOpen, setIsDailyLessonOpen] = useState(false);
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

  // Update handlers
  const handleScenarioCompleted = (scenarioId: string, earnedXP: number, minutes: number) => {
    setProgress((prev) => {
      const alreadyCompleted = prev.completedScenarioIds.includes(scenarioId);
      const nextCompletedIds = alreadyCompleted
        ? prev.completedScenarioIds
        : [...prev.completedScenarioIds, scenarioId];

      return {
        ...prev,
        completedScenarioIds: nextCompletedIds,
        completedXP: Math.min(prev.dailyGoalXP, prev.completedXP + earnedXP),
        completedMinutes: Math.min(prev.dailyGoalMinutes, prev.completedMinutes + minutes),
      };
    });
  };

  const handleLessonCompleted = () => {
    setProgress((prev) => ({
      ...prev,
      hasCompletedDailyLessonToday: true,
      completedXP: Math.min(prev.dailyGoalXP, prev.completedXP + dailyLessonMock.xpReward),
      completedMinutes: Math.min(
        prev.dailyGoalMinutes,
        prev.completedMinutes + dailyLessonMock.estimatedMinutes
      ),
    }));
    setIsDailyLessonOpen(false);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-28">
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

      {/* Main Mobile App Container */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4 space-y-5">
        {/* Daily Goal & Welcoming Section */}
        <DailyGoalCard
          progress={progress}
          onUpdateProgress={setProgress}
          onStartLesson={() => setIsDailyLessonOpen(true)}
        />

        {/* Upcoming Roleplay Scenarios Section */}
        <RoleplayList
          scenarios={roleplayScenarios}
          progress={progress}
          onSelectScenario={(scenario) => setActiveScenario(scenario)}
        />
      </main>

      {/* Floating Action Button: Start Daily Lesson */}
      <StartDailyLessonFAB
        onStartLesson={() => setIsDailyLessonOpen(true)}
        isCompletedToday={progress.hasCompletedDailyLessonToday}
      />

      {/* Roleplay Conversation Modal */}
      {activeScenario && (
        <RoleplayModal
          scenario={activeScenario}
          progress={progress}
          onClose={() => setActiveScenario(null)}
          onComplete={handleScenarioCompleted}
        />
      )}

      {/* Daily Lesson Modal */}
      {isDailyLessonOpen && (
        <DailyLessonModal
          lesson={dailyLessonMock}
          progress={progress}
          onClose={() => setIsDailyLessonOpen(false)}
          onCompleteLesson={handleLessonCompleted}
        />
      )}

      {/* PWA Installation Guide Modal */}
      {isInstallGuideOpen && (
        <PWAInstallGuideModal onClose={() => setIsInstallGuideOpen(false)} />
      )}
    </div>
  );
}

export default App;
