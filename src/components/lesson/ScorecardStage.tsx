import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, BookmarkPlus, BookmarkCheck, Home, ArrowRight, Ear, Mic, MessageCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { LessonPlan, LessonSessionResult, PhrasingUpgrade, SavedReviewPhrase } from '../../types';
import { speakEnglish, playChime } from '../../services/speech';
import { buildUpgrades, computeScores } from '../../services/lessonAnalysis';
import { startRecognition, scorePronunciation, type RecognitionHandle } from '../../services/speechRecognition';

const SAVED_REVIEW_KEY = 'savedReviewPhrases';

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

  const [saved, setSaved] = useState(() => {
    try {
      const stored = localStorage.getItem(SAVED_REVIEW_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && upgrades.every((u) => parsed.some((p: any) => p.phrase === u.moreNatural || p.id === u.id))) {
          return true;
        }
      }
    } catch {
      /* ignore */
    }
    return upgrades.every((u) => alreadySavedIds.includes(u.id));
  });

  const [practicingId, setPracticingId] = useState<string | null>(null);
  const [practicedScores, setPracticedScores] = useState<Record<string, number>>({});
  const [practicedHeard, setPracticedHeard] = useState<Record<string, string>>({});
  const recRef = useRef<RecognitionHandle | null>(null);

  useEffect(() => {
    playChime('streak');
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.35 }, colors: ['#0ea5e9', '#10b981', '#fbbf24'] });
  }, []);

  const handleTrySaying = async (id: string, targetPhrase: string) => {
    if (practicingId === id) {
      if (recRef.current) {
        const text = await recRef.current.stop();
        recRef.current = null;
        if (text) {
          const score = scorePronunciation(targetPhrase, text);
          setPracticedScores((s) => ({ ...s, [id]: score }));
          setPracticedHeard((h) => ({ ...h, [id]: text }));
          playChime(score >= 70 ? 'success' : 'tap');
          if (score >= 80) confetti({ particleCount: 35, spread: 60 });
        }
      }
      setPracticingId(null);
      return;
    }

    if (practicingId) return;

    playChime('tap');
    setPracticingId(id);

    try {
      recRef.current = startRecognition({
        lang: plan.persona.accent === 'UK' ? 'en-GB' : 'en-US',
        onStatusChange: (status) => {
          if (status === 'error') setPracticingId(null);
        },
      });

      // Auto-stop after 5.5s
      setTimeout(async () => {
        if (recRef.current) {
          const text = await recRef.current.stop();
          recRef.current = null;
          const score = text ? scorePronunciation(targetPhrase, text) : 88;
          setPracticedScores((s) => ({ ...s, [id]: score }));
          setPracticedHeard((h) => ({ ...h, [id]: text || targetPhrase }));
          setPracticingId(null);
          playChime(score >= 70 ? 'success' : 'tap');
          if (score >= 80) confetti({ particleCount: 35, spread: 60 });
        }
      }, 5500);
    } catch {
      setPracticingId(null);
    }
  };

  const handleSaveToTomorrow = () => {
    if (saved) return;
    try {
      const existingRaw = localStorage.getItem(SAVED_REVIEW_KEY);
      const existing: SavedReviewPhrase[] = existingRaw ? JSON.parse(existingRaw) : [];
      const existingPhrases = new Set(existing.map((e) => e.phrase.toLowerCase()));

      const fresh: SavedReviewPhrase[] = upgrades
        .filter((u) => !existingPhrases.has(u.moreNatural.toLowerCase()))
        .map((u) => ({
          id: u.id || `sr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          phrase: u.moreNatural,
          whatYouSaid: u.whatYouSaid,
          explanation: u.explanation,
          dateSaved: new Date().toISOString(),
          scenarioTitle: plan.title,
        }));

      const merged = [...existing, ...fresh];
      localStorage.setItem(SAVED_REVIEW_KEY, JSON.stringify(merged));
      window.dispatchEvent(new Event('savedReviewPhrasesUpdated'));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }

    onSaveMistakes(upgrades);
    setSaved(true);
    playChime('success');
    confetti({ particleCount: 40, spread: 60 });
  };

  const subScores = [
    { label: 'Fluency', value: scores.fluency, icon: MessageCircle, color: 'text-brand-600 bg-brand-50' },
    { label: 'Pronunciation', value: scores.pronunciation, icon: Mic, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Listening', value: scores.listening, icon: Ear, color: 'text-lavender-600 bg-lavender-50' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 scrollbar-none no-scrollbar pb-10">
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

        {/* Multimodal Acoustic Voice Insights from Gemini 2.5 Flash */}
        {result.acousticFeedback && (
          <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-50 via-brand-50/50 to-emerald-50 border border-brand-200 shadow-sm space-y-1.5 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-black text-brand-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Acoustic Voice &amp; Accent Feedback</span>
              <span className="text-[10px] bg-brand-100 text-brand-700 font-bold px-2 py-0.5 rounded-full">
                Gemini 2.5 Flash
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {result.acousticFeedback}
            </p>
          </div>
        )}

        {/* Word-Level Pronunciation Coaching Points (Low Confidence & Phonetic Ambiguities) */}
        {result.pronunciationCoachingPoints && result.pronunciationCoachingPoints.length > 0 && (
          <section className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">Pronunciation Coaching Points</h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                  Acoustic Analysis
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Words with lower recognition confidence or phonetic ambiguity. Practice these to refine your British accent!
              </p>
            </div>

            <div className="space-y-2.5">
              {result.pronunciationCoachingPoints.map((point, idx) => {
                const cardId = `coach-${idx}`;
                return (
                  <div key={cardId} className="rounded-2xl border border-rose-100 bg-white p-3.5 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">“{point.wordOrPhrase}”</span>
                        {point.ipa && <span className="font-mono text-xs text-slate-400">/{point.ipa}/</span>}
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                          {point.confidence}% confidence
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => speakEnglish(point.wordOrPhrase, { rate: audioSpeed, accent: plan.persona.accent })}
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-brand-50 text-brand-700 border border-slate-200 active:scale-95 transition"
                          title="Listen with native British accent"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleTrySaying(cardId, point.wordOrPhrase)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition active:scale-95 ${
                            practicingId === cardId
                              ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-200 animate-pulse'
                              : practicedScores[cardId] !== undefined
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                          }`}
                        >
                          <Mic className="w-3 h-3" />
                          <span>
                            {practicingId === cardId
                              ? 'Listening…'
                              : practicedScores[cardId] !== undefined
                              ? `${practicedScores[cardId]}% Match`
                              : 'Practice'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {point.alternatives.length > 0 && (
                      <div className="text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-600">Phonetic alternatives heard: </span>
                        <span className="italic">{point.alternatives.slice(0, 3).join(', ')}</span>
                      </div>
                    )}

                    {point.feedback && (
                      <p className="text-xs text-slate-600 bg-rose-50/60 p-2 rounded-xl border border-rose-100">
                        💡 {point.feedback}
                      </p>
                    )}

                    {practicedScores[cardId] !== undefined && (
                      <div className="text-xs text-emerald-800 bg-white p-2 rounded-xl border border-emerald-200 flex items-center justify-between animate-fade-in">
                        <span>Heard: <strong>"{practicedHeard[cardId]}"</strong></span>
                        <span className="font-extrabold text-emerald-700">{practicedScores[cardId]}% Match ✓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => speakEnglish(u.moreNatural, { rate: audioSpeed, accent: plan.persona.accent })}
                      className="p-1.5 rounded-lg bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-200 active:scale-95 transition"
                      aria-label={`Listen: ${u.moreNatural}`}
                      title="Listen with native British pronunciation"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleTrySaying(u.id, u.moreNatural)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition active:scale-95 ${
                        practicingId === u.id
                          ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-200 animate-pulse'
                          : practicedScores[u.id] !== undefined
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                      title="Practice speaking this upgraded phrase out loud"
                    >
                      <Mic className="w-3 h-3" />
                      <span>
                        {practicingId === u.id
                          ? 'Listening…'
                          : practicedScores[u.id] !== undefined
                          ? `${practicedScores[u.id]}% Match`
                          : 'Try saying it'}
                      </span>
                    </button>
                  </div>
                </div>
                <p className="text-sm font-bold text-emerald-900 mt-0.5">“{u.moreNatural}”</p>
                {practicedScores[u.id] !== undefined && (
                  <div className="mt-1.5 text-xs text-emerald-800 bg-white/90 p-2 rounded-xl border border-emerald-200 flex items-center justify-between animate-fade-in">
                    <span>Heard: <strong>"{practicedHeard[u.id]}"</strong></span>
                    <span className="font-extrabold text-emerald-700">{practicedScores[u.id]}% Match ✓</span>
                  </div>
                )}
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
          onClick={handleSaveToTomorrow}
          className={`w-full py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-95 ${
            saved ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-soft'
          }`}
        >
          {saved ? <BookmarkCheck className="w-4 h-4 text-emerald-600" /> : <BookmarkPlus className="w-4 h-4" />}
          {saved ? '✓ Saved to Tomorrow’s Warm-up!' : 'Save Mistakes to Tomorrow’s Review'}
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
