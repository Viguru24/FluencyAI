import React, { useEffect, useMemo, useState } from 'react';
import { Volume2, BookmarkPlus, BookmarkCheck, Home, ArrowRight, Ear, Mic, MessageCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { LessonPlan, LessonSessionResult, PhrasingUpgrade } from '../../types';
import { speakEnglish, playChime } from '../../services/speech';
import { buildUpgrades, computeScores } from '../../services/lessonAnalysis';

interface Props {
  plan: LessonPlan;
  result: LessonSessionResult;
  audioSpeed: number;
  alreadySavedIds: string[];
  onSaveMistakes: (upgrades: PhrasingUpgrade[]) => void;
  onFinish: () => void;
}

const Dial: React.FC<{ value: number }> = ({ value }) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1200);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const r = 70;
  const c = 2 * Math.PI * r;
  const label = value >= 85 ? 'Excellent' : value >= 70 ? 'Great progress' : value >= 55 ? 'Good effort' : 'Keep going';

  return (
    <div className="relative w-48 h-48" role="img" aria-label={`Overall fluency and pronunciation ${value} percent`}>
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <circle
          cx="80" cy="80" r={r} fill="none" stroke="url(#dialGrad)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-slate-900">{shown}%</span>
        <span className="text-xs font-bold text-emerald-600">{label}</span>
      </div>
    </div>
  );
};

export const ScorecardStage: React.FC<Props> = ({ plan, result, audioSpeed, alreadySavedIds, onSaveMistakes, onFinish }) => {
  const scores = useMemo(() => {
    const base = computeScores(plan, result);
    if (typeof result.fluencyScore === 'number') {
      const fluency = Math.max(50, Math.min(100, Math.round(result.fluencyScore)));
      const overall = Math.round(fluency * 0.45 + base.pronunciation * 0.35 + base.listening * 0.2);
      return { ...base, fluency, overall };
    }
    return base;
  }, [plan, result]);

  const upgrades = useMemo(() => {
    if (result.dynamicUpgrades && result.dynamicUpgrades.length > 0) {
      return result.dynamicUpgrades;
    }
    return buildUpgrades(plan, result.userTurns);
  }, [plan, result.dynamicUpgrades, result.userTurns]);

  const [saved, setSaved] = useState(() => upgrades.every((u) => alreadySavedIds.includes(u.id)));

  useEffect(() => {
    playChime('streak');
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.35 }, colors: ['#0ea5e9', '#10b981', '#fbbf24'] });
  }, []);

  const subScores = [
    { label: 'Fluency', value: scores.fluency, icon: MessageCircle, color: 'text-brand-600 bg-brand-50' },
    { label: 'Pronunciation', value: scores.pronunciation, icon: Mic, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Listening', value: scores.listening, icon: Ear, color: 'text-lavender-600 bg-lavender-50' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <div className="text-center space-y-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold border border-brand-200">
            Stage 3 of 3 · Pronunciation &amp; British Phrasing Scorecard
          </span>
          <h2 className="text-xl font-extrabold text-slate-900">Well done — you spoke English for real!</h2>
          <p className="text-sm text-slate-600">{plan.title}</p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <Dial value={scores.overall} />
          <p className="text-xs font-semibold text-slate-500">Overall Fluency &amp; Pronunciation</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {subScores.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-3 rounded-2xl bg-white border border-slate-200 text-center shadow-sm">
              <div className={`w-8 h-8 mx-auto rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-lg font-black text-slate-900 mt-1">{value}%</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4 text-[11px] font-semibold text-slate-500">
          <span>🗣️ {result.userTurns.length} replies</span>
          <span>👂 {result.revealsUsed} text reveals</span>
          <span>🛟 {result.helpRequests} help requests</span>
        </div>

        {/* Grammar & Phrasing Upgrades */}
        <section className="space-y-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">British English Phrasing Upgrades</h3>
            <p className="text-xs text-slate-500">Small changes that make you sound more natural. You were understood — these are bonus points!</p>
          </div>

          {upgrades.map((u) => (
            <div key={u.id} className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                <div className="text-[10px] font-black text-amber-700 uppercase tracking-wider">What you said</div>
                <p className="text-sm text-amber-900 mt-0.5">“{u.whatYouSaid}”</p>
              </div>
              <div className="px-4 py-3 bg-emerald-50">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                    More natural {plan.persona.accent === 'UK' ? 'British' : 'American'} English
                  </div>
                  <button
                    onClick={() => speakEnglish(u.moreNatural, { rate: audioSpeed, accent: plan.persona.accent })}
                    className="p-1.5 rounded-lg bg-white text-emerald-700 border border-emerald-200 active:scale-95"
                    aria-label={`Listen: ${u.moreNatural}`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm font-bold text-emerald-900 mt-0.5">“{u.moreNatural}”</p>
                <p className="text-xs text-slate-600 mt-1.5">
                  <span className="font-bold text-slate-700">{u.category}: </span>
                  {u.explanation}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Dynamic Phrases to Review from Gemini analysis */}
        {result.phrasesToReview && result.phrasesToReview.length > 0 && (
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Recommended Phrases to Review</h3>
              <p className="text-xs text-slate-500">Essential British expressions to practice before your next session.</p>
            </div>
            <div className="space-y-2">
              {result.phrasesToReview.map((phrase, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-black flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate">“{phrase}”</span>
                  </div>
                  <button
                    onClick={() => speakEnglish(phrase, { rate: audioSpeed, accent: plan.persona.accent })}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-brand-50 text-brand-600 border border-slate-200 transition active:scale-95 flex-shrink-0"
                    aria-label={`Listen to ${phrase}`}
                    title="Listen with native British pronunciation"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-white space-y-2">
        <button
          onClick={() => {
            if (saved) return;
            onSaveMistakes(upgrades);
            setSaved(true);
            playChime('success');
          }}
          className={`w-full py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-95 ${
            saved ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-soft'
          }`}
        >
          {saved ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
          {saved ? `Saved ${upgrades.length} phrases to tomorrow’s review` : 'Save Mistakes to Tomorrow’s Review'}
        </button>
        <button
          onClick={onFinish}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-emerald-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-soft active:scale-95"
        >
          <Home className="w-4 h-4" /> Collect +{plan.xpReward} XP &amp; Finish <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
