import React, { useState } from 'react';
import { X, MicOff, Check } from 'lucide-react';
import type { CEFRLevel, LessonPlan, LessonStage, LessonSessionResult, NativeLanguage, PhrasingUpgrade } from '../../types';
import type { XPCalculationResult } from '../../store/rewardSystem';
import { stopSpeaking } from '../../services/speech';
import { ScaffoldingStage } from './ScaffoldingStage';
import { RoleplayStage, type RoleplayStats } from './RoleplayStage';
import { ScorecardStage } from './ScorecardStage';
import { ThemeToggle } from '../ThemeToggle';

interface Props {
  plan: LessonPlan;
  nativeLanguage: NativeLanguage;
  audioSpeed: number;
  userLevel?: CEFRLevel;
  savedMistakeIds: string[];
  initialStage?: LessonStage;
  onSaveMistakes: (plan: LessonPlan, upgrades: PhrasingUpgrade[]) => void;
  onComplete: (plan: LessonPlan, customXPCalc?: XPCalculationResult) => void;
  onExit: () => void;
}

const STAGES: { key: LessonStage; label: string }[] = [
  { key: 'scaffolding', label: '1. Prep' },
  { key: 'roleplay', label: '2. Roleplay' },
  { key: 'scorecard', label: '3. Scorecard' },
];

export const LessonFlow: React.FC<Props> = ({
  plan,
  nativeLanguage,
  audioSpeed,
  userLevel,
  savedMistakeIds,
  initialStage = 'scaffolding',
  onSaveMistakes,
  onComplete,
  onExit
}) => {
  const [stage, setStage] = useState<LessonStage>(initialStage);
  const [phraseScores, setPhraseScores] = useState<number[]>([]);
  const [result, setResult] = useState<LessonSessionResult | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const stageIndex = STAGES.findIndex((s) => s.key === stage);

  const handleClose = () => {
    if (stage === 'scorecard') return onExit();
    setConfirmExit(true);
  };

  const handleStageSelect = (targetStage: LessonStage) => {
    stopSpeaking();
    setMicDenied(false);
    if (targetStage === 'roleplay' && phraseScores.length === 0) {
      setPhraseScores([85, 90, 88]); // default warm-up baseline if skipping straight to roleplay
    }
    setStage(targetStage);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fade-in">
      <div className="relative w-full max-w-5xl h-[100dvh] max-h-[100dvh] sm:h-[88dvh] sm:max-h-[88dvh] bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl shadow-2xl border border-transparent sm:border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header with interactive stage stepper */}
        <header className="px-3.5 sm:px-6 pt-safe pb-2.5 sm:py-3 bg-gradient-to-r from-brand-600 via-sky-600 to-emerald-600 text-white flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-100 truncate">
                {plan.contextLabel}
              </div>
              <h1 className="text-xs sm:text-sm font-extrabold truncate">{plan.title}</h1>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {stage === 'scaffolding' && (
                <button
                  onClick={() => handleStageSelect('roleplay')}
                  className="px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-400 text-emerald-950 font-extrabold text-[11px] sm:text-xs shadow-xs hover:bg-emerald-300 transition active:scale-95"
                  title="Skip phrase drills and jump straight to talking with Coach"
                >
                  ⚡ Skip Prep
                </button>
              )}
              <ThemeToggle variant="icon-only" />
              <button
                onClick={handleClose}
                className="p-1.5 sm:p-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95"
                aria-label="Exit lesson"
              >
                <X className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
          <ol className="mt-2 sm:mt-3 flex items-center gap-1 sm:gap-1.5" aria-label="Lesson progress">
            {STAGES.map((s, i) => {
              const done = i < stageIndex;
              const active = i === stageIndex;
              return (
                <li key={s.key} className="flex-1 flex items-center gap-1 min-w-0" aria-current={active ? 'step' : undefined}>
                  <button
                    type="button"
                    onClick={() => handleStageSelect(s.key)}
                    className={`flex-1 flex items-center gap-1.5 py-1 px-1.5 rounded-lg transition active:scale-95 text-left min-w-0 ${
                      active ? 'bg-white/20 shadow-xs' : 'hover:bg-white/10 opacity-80 hover:opacity-100'
                    }`}
                    title={`Click to jump to ${s.label}`}
                  >
                    <span
                      className={`w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                        done ? 'bg-emerald-300 text-emerald-900' : active ? 'bg-white text-brand-700' : 'bg-white/25 text-white'
                      }`}
                    >
                      {done ? <Check className="w-3 h-3" /> : i + 1}
                    </span>
                    <span className={`text-[10px] sm:text-[11px] font-bold truncate ${active ? 'text-white' : 'text-white/80'}`}>
                      {s.label}
                    </span>
                  </button>
                  {i < STAGES.length - 1 && (
                    <span className={`w-2 sm:w-3 h-0.5 rounded flex-shrink-0 ${done ? 'bg-emerald-300' : 'bg-white/25'}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </header>

        {/* Microphone permission banner */}
        {micDenied && (
          <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex items-start gap-2 text-xs text-rose-800">
            <MicOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <strong>Microphone blocked.</strong> Allow mic access in your browser’s address bar (🔒 icon), then tap a mic button again.
              The lesson also works over <code>localhost</code> or HTTPS only.
            </div>
            <button onClick={() => setMicDenied(false)} className="font-bold underline">OK</button>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {stage === 'scaffolding' && (
            <ScaffoldingStage
              plan={plan}
              nativeLanguage={nativeLanguage}
              audioSpeed={audioSpeed}
              onMicDenied={() => setMicDenied(true)}
              onComplete={(scores) => {
                setPhraseScores(scores);
                setMicDenied(false);
                setStage('roleplay');
              }}
            />
          )}

          {stage === 'roleplay' && (
            <RoleplayStage
              plan={plan}
              nativeLanguage={nativeLanguage}
              audioSpeed={audioSpeed}
              userLevel={userLevel}
              phraseScores={phraseScores}
              onMicDenied={() => setMicDenied(true)}
              onEnd={(stats: RoleplayStats) => {
                setResult({
                  phraseScores,
                  ...stats,
                  usedTargetPhraseIds: stats.usedTargetPhraseIds || [],
                  unblurredTurnCount: stats.unblurredTurnCount ?? stats.revealsUsed,
                });
                setMicDenied(false);
                setStage('scorecard');
              }}
            />
          )}

          {stage === 'scorecard' && result && (
            <ScorecardStage
              plan={plan}
              result={result}
              audioSpeed={audioSpeed}
              alreadySavedIds={savedMistakeIds}
              onSaveMistakes={(ups) => onSaveMistakes(plan, ups)}
              onFinish={(customXPCalc) => onComplete(plan, customXPCalc)}
            />
          )}
        </div>

        {/* Exit confirmation */}
        {confirmExit && (
          <div className="absolute inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-6 animate-fade-in">
            <div className="w-full max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 text-center shadow-2xl">
              <h3 className="font-extrabold text-slate-900 dark:text-white">Leave this lesson?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">Your progress in this lesson won’t be saved. You can start again any time.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setConfirmExit(false)} className="flex-1 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold active:scale-95 transition">
                  Keep going
                </button>
                <button
                  onClick={() => {
                    stopSpeaking();
                    onExit();
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold active:scale-95 transition border border-transparent dark:border-slate-700"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
