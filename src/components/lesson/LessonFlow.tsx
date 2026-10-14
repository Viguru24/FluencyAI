import React, { useState } from 'react';
import { X, MicOff, Check } from 'lucide-react';
import type { LessonPlan, LessonStage, LessonSessionResult, NativeLanguage, PhrasingUpgrade } from '../../types';
import { stopSpeaking } from '../../services/speech';
import { ScaffoldingStage } from './ScaffoldingStage';
import { RoleplayStage, type RoleplayStats } from './RoleplayStage';
import { ScorecardStage } from './ScorecardStage';

interface Props {
  plan: LessonPlan;
  nativeLanguage: NativeLanguage;
  audioSpeed: number;
  savedMistakeIds: string[];
  onSaveMistakes: (plan: LessonPlan, upgrades: PhrasingUpgrade[]) => void;
  onComplete: (plan: LessonPlan) => void;
  onExit: () => void;
}

const STAGES: { key: LessonStage; label: string }[] = [
  { key: 'scaffolding', label: 'Prep' },
  { key: 'roleplay', label: 'Roleplay' },
  { key: 'scorecard', label: 'Scorecard' },
];

export const LessonFlow: React.FC<Props> = ({ plan, nativeLanguage, audioSpeed, savedMistakeIds, onSaveMistakes, onComplete, onExit }) => {
  const [stage, setStage] = useState<LessonStage>('scaffolding');
  const [phraseScores, setPhraseScores] = useState<number[]>([]);
  const [result, setResult] = useState<LessonSessionResult | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const stageIndex = STAGES.findIndex((s) => s.key === stage);

  const handleClose = () => {
    if (stage === 'scorecard') return onExit();
    setConfirmExit(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4 animate-fade-in">
      <div className="relative w-full sm:max-w-lg h-full sm:h-[92vh] bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header with stage stepper */}
        <header className="px-4 py-3 bg-gradient-to-r from-brand-600 via-sky-600 to-emerald-600 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-100">{plan.contextLabel}</div>
              <h1 className="text-sm font-extrabold truncate">{plan.title}</h1>
            </div>
            <button onClick={handleClose} className="p-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95" aria-label="Exit lesson">
              <X className="w-5 h-5" />
            </button>
          </div>
          <ol className="mt-3 flex items-center gap-2" aria-label="Lesson progress">
            {STAGES.map((s, i) => {
              const done = i < stageIndex;
              const active = i === stageIndex;
              return (
                <li key={s.key} className="flex-1 flex items-center gap-1.5" aria-current={active ? 'step' : undefined}>
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                      done ? 'bg-emerald-300 text-emerald-900' : active ? 'bg-white text-brand-700' : 'bg-white/25 text-white'
                    }`}
                  >
                    {done ? <Check className="w-3 h-3" /> : i + 1}
                  </span>
                  <span className={`text-[11px] font-bold ${active ? 'text-white' : 'text-white/70'}`}>{s.label}</span>
                  {i < STAGES.length - 1 && <span className={`flex-1 h-0.5 rounded ${done ? 'bg-emerald-300' : 'bg-white/25'}`} />}
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

        <div className="flex-1 min-h-0">
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
              onMicDenied={() => setMicDenied(true)}
              onEnd={(stats: RoleplayStats) => {
                setResult({ phraseScores, ...stats });
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
              onFinish={() => onComplete(plan)}
            />
          )}
        </div>

        {/* Exit confirmation */}
        {confirmExit && (
          <div className="absolute inset-0 z-40 bg-slate-900/50 flex items-center justify-center p-6 animate-fade-in">
            <div className="w-full max-w-xs bg-white rounded-3xl p-5 space-y-3 text-center shadow-2xl">
              <h3 className="font-extrabold text-slate-900">Leave this lesson?</h3>
              <p className="text-sm text-slate-600">Your progress in this lesson won’t be saved. You can start again any time.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setConfirmExit(false)} className="flex-1 py-2.5 rounded-2xl bg-brand-600 text-white text-sm font-bold">
                  Keep going
                </button>
                <button
                  onClick={() => {
                    stopSpeaking();
                    onExit();
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-sm font-bold"
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
