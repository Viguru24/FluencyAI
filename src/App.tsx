import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DailyGoalCard } from './components/DailyGoalCard';
import { RoleplayList } from './components/RoleplayList';
import { StartDailyLessonFAB } from './components/StartDailyLessonFAB';
import { PWAInstallGuideModal } from './components/PWAInstallGuideModal';
import { LessonFlow } from './components/lesson/LessonFlow';
import { JamesTestAreaModal } from './components/JamesTestAreaModal';
import { roleplayScenarios, initialUserProgress } from './data/mockData';
import { getDailyLessonPlan, getLessonPlanForScenario } from './data/lessonPlans';
import type { UserProgress, LessonPlan, PhrasingUpgrade, LessonStage } from './types';
import { registerServiceWorker } from './pwa';
import { RefreshCw, Sparkles, BookmarkCheck } from 'lucide-react';
import { ToastContainer } from './components/ToastContainer';
import { playChime } from './services/speech';
import { authService, mergeUserProgressWithRemote } from './services/authService';

const STORAGE_KEY = 'fluencyai_user_progress_v1';
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
      return mergeUserProgressWithRemote(local, currentUser);
    }
    return local;
  });

  const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);
  const [lessonInitialStage, setLessonInitialStage] = useState<LessonStage>('scaffolding');
  const [isJamesTestOpen, setIsJamesTestOpen] = useState(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);

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

  const openDailyLesson = (initialStage: LessonStage = 'scaffolding') => {
    setLessonInitialStage(initialStage);
    setActivePlan(getDailyLessonPlan());
  };
  const openScenario = (scenarioId: string, initialStage: LessonStage = 'scaffolding') => {
    setLessonInitialStage(initialStage);
    setActivePlan(getLessonPlanForScenario(scenarioId));
  };

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
      />

      {/* Main Mobile App Container with pb-32 to guarantee floating button never overlaps Conversational Roleplays heading */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4 pb-32 space-y-5">
        {/* Daily Goal & Welcoming Section */}
        <DailyGoalCard progress={progress} onUpdateProgress={setProgress} onStartLesson={() => openDailyLesson('scaffolding')} />

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
          scenarios={roleplayScenarios}
          progress={progress}
          onSelectScenario={(scenario) => openScenario(scenario.id)}
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
          audioSpeed={progress.audioSpeed}
          savedMistakeIds={(progress.savedMistakes ?? []).map((m) => m.id)}
          initialStage={lessonInitialStage}
          onSaveMistakes={handleSaveMistakes}
          onComplete={handleLessonComplete}
          onExit={() => setActivePlan(null)}
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
    </div>
  );
}

export default App;
