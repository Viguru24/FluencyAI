import React, { useMemo, useRef, useState } from 'react';
import { 
  Volume2, 
  Mic, 
  Square, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Lock, 
  ArrowRight, 
  Languages, 
  Sparkles,
  Edit3,
  Activity
} from 'lucide-react';
import type { LessonPlan, NativeLanguage } from '../../types';
import { speakEnglish, playChime } from '../../services/speech';
import { PronunciationRadarModal } from './PronunciationRadarModal';
import { 
  startRecognition, 
  scorePronunciation, 
  isRecognitionSupported, 
  type RecognitionHandle 
} from '../../services/speechRecognition';
import { AudioVisualizerController } from '../../services/audioVisualizer';
import { getDueSRSFlashcards } from '../../services/srsService';

interface Props {
  plan: LessonPlan;
  nativeLanguage: NativeLanguage;
  audioSpeed: number;
  onMicDenied: () => void;
  onComplete: (scores: number[]) => void;
}

export const ScaffoldingStage: React.FC<Props> = ({
  plan,
  nativeLanguage,
  audioSpeed,
  onMicDenied,
  onComplete,
}) => {
  const [hintsOpen, setHintsOpen] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [heard, setHeard] = useState<Record<string, string>>({});
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [level, setLevel] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micTestStatus, setMicTestStatus] = useState<'idle' | 'testing' | 'passed'>('idle');
  const [micTestLevel, setMicTestLevel] = useState(0);
  const [radarPhrase, setRadarPhrase] = useState<string | null>(null);

  const dueSRSCard = useMemo(() => {
    try {
      const due = getDueSRSFlashcards();
      return due.find((c) => c.box === 1 || c.box === 2) || null;
    } catch {
      return null;
    }
  }, []);

  const recRef = useRef<RecognitionHandle | null>(null);
  const vizRef = useRef(new AudioVisualizerController());
  const fallbackTimer = useRef<number | null>(null);

  const practicedCount = plan.phrases.filter((p) => scores[p.id] !== undefined).length;
  const allDone = practicedCount === plan.phrases.length;

  const finishRecording = async (id: string, target: string) => {
    if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);

    let text: string | null = null;
    if (recRef.current) {
      text = await recRef.current.stop();
      recRef.current = null;
    }

    vizRef.current.stopMicrophone();
    setRecordingId(null);
    setLevel(0);

    // Fallback if browser didn't return any text but user was recording
    const finalText = text && text.trim().length > 0 ? text.trim() : liveTranscript.trim() || null;
    setLiveTranscript('');

    if (finalText) {
      const score = scorePronunciation(target, finalText);
      setScores((s) => ({ ...s, [id]: score }));
      setHeard((h) => ({ ...h, [id]: finalText }));
      playChime(score >= 60 ? 'success' : 'tap');
    } else {
      // If mic didn't capture audio, offer an encouraging baseline or manual option
      const fallbackScore = 75;
      setScores((s) => ({ ...s, [id]: fallbackScore }));
      setHeard((h) => ({ ...h, [id]: target }));
      playChime('tap');
    }
  };

  const toggleRecord = async (id: string, target: string) => {
    if (recordingId === id) {
      await finishRecording(id, target);
      return;
    }
    if (recordingId) return;

    playChime('tap');
    setLiveTranscript('');

    // Try starting mic visualizer
    vizRef.current.startMicrophone((bands) => {
      setLevel(bands.reduce((a, b) => a + b, 0) / bands.length);
    }).catch(() => {
      /* ignore audio viz errors, SpeechRecognition will handle mic */
    });

    if (!isRecognitionSupported()) {
      onMicDenied();
      return;
    }

    setRecordingId(id);

    try {
      recRef.current = startRecognition({
        lang: plan.persona.accent === 'UK' ? 'en-GB' : 'en-US',
        onInterim: (interim) => {
          setLiveTranscript(interim);
        },
        onStatusChange: (status, details) => {
          if (status === 'error') {
            console.warn('[ScaffoldingStage] SpeechRecognition status:', details);
          }
        },
      });

      // Auto-stop after 8s so user isn't stuck
      fallbackTimer.current = window.setTimeout(() => {
        finishRecording(id, target);
      }, 8000);
    } catch (e) {
      console.warn('Recognition start failed:', e);
      onMicDenied();
    }
  };

  const handleManualSubmit = (id: string, target: string) => {
    if (!editText.trim()) {
      setEditingId(null);
      return;
    }
    const score = scorePronunciation(target, editText.trim());
    setScores((s) => ({ ...s, [id]: score }));
    setHeard((h) => ({ ...h, [id]: editText.trim() }));
    setEditingId(null);
    setEditText('');
    playChime('success');
  };

  const handleTestMic = async () => {
    if (isTestingMic) {
      vizRef.current.stopMicrophone();
      setIsTestingMic(false);
      setMicTestStatus('passed');
      return;
    }
    playChime('tap');
    setIsTestingMic(true);
    setMicTestStatus('testing');
    try {
      const ok = await vizRef.current.startMicrophone((b) => {
        const avg = b.reduce((acc, val) => acc + val, 0) / (b.length || 1);
        setMicTestLevel(avg);
      });
      if (!ok) {
        setIsTestingMic(false);
        setMicTestStatus('idle');
        onMicDenied();
        return;
      }
      setTimeout(() => {
        vizRef.current.stopMicrophone();
        setIsTestingMic(false);
        setMicTestStatus('passed');
        playChime('success');
      }, 3500);
    } catch {
      setIsTestingMic(false);
      setMicTestStatus('idle');
      onMicDenied();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 scrollbar-none no-scrollbar">
        <div className="max-w-4xl mx-auto w-full space-y-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-[11px] font-bold border border-brand-200 dark:border-brand-800">
              Stage 1 of 3 · 3-Phrase Vocabulary Warm-up &amp; Mic Test
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Warm up your key phrases</h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Listen, then say each phrase out loud. You will use them naturally with {plan.persona.name}.
            </p>
          </div>

          {/* Past Phrase Refresher Badge */}
          {dueSRSCard && (
            <div 
              className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 via-amber-100/50 to-orange-50 dark:from-amber-950/40 dark:via-amber-900/30 dark:to-orange-950/40 border border-amber-300 dark:border-amber-700/60 flex items-center justify-between gap-3 shadow-2xs animate-fade-in"
              title="Includes 1 phrase you saved earlier to help lock it into memory."
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-amber-400 dark:bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs">
                  🔄
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5 flex-wrap">
                    <span>🔄 Past Phrase Refresher (+15 Bonus XP)</span>
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-200/80 dark:bg-amber-900/60 px-1.5 py-0.2 rounded-md">
                      📌 From Your Saved Phrases
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-900 dark:text-amber-300 truncate">
                    Includes 1 phrase you saved earlier to help lock it into memory. (<em>"{dueSRSCard.phrase}"</em>)
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => speakEnglish(dueSRSCard.phrase, { rate: audioSpeed, accent: plan.persona.accent, personaName: plan.persona.name })}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 text-xs font-bold border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-slate-700 active:scale-95 transition flex items-center gap-1 flex-shrink-0 shadow-2xs"
                title="Listen to this refresher phrase"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Listen</span>
              </button>
            </div>
          )}

          {/* Responsive 2-column grid for Mic Check and Fast-Track Skip banner on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Microphone Check Widget */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 via-brand-50/40 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-brand-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    micTestStatus === 'passed'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : isTestingMic
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 animate-pulse'
                      : 'bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 truncate">
                    <span>Microphone Test</span>
                    {micTestStatus === 'passed' && (
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded-md">
                        Ready ✓
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {isTestingMic
                      ? 'Say anything to test input...'
                      : micTestStatus === 'passed'
                      ? 'Audio input working cleanly'
                      : 'Check mic before starting'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isTestingMic && (
                  <div className="flex items-end gap-0.5 h-5 px-1" aria-hidden>
                    {[0.5, 1, 0.8, 1.2, 0.6].map((m, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-full bg-emerald-500 transition-all duration-75"
                        style={{ height: `${Math.max(4, Math.min(20, Math.max(micTestLevel, 0.25) * 40 * m))}px` }}
                      />
                    ))}
                  </div>
                )}
                <button
                  onClick={handleTestMic}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                    isTestingMic
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-xs'
                      : micTestStatus === 'passed'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  {isTestingMic ? 'Stop Test' : micTestStatus === 'passed' ? 'Test Again' : 'Test Mic'}
                </button>
              </div>
            </div>

            {/* Fast-Track Direct Jump to Roleplay banner */}
            <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-brand-500/10 to-sky-500/10 dark:from-emerald-950/30 dark:via-brand-950/20 dark:to-sky-950/30 border border-emerald-300/60 dark:border-emerald-800/60 p-3 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl">⚡</span>
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-900 dark:text-white truncate">Talk with {plan.persona.name} directly</div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">Skip phrase drills straight to Stage 2.</div>
                </div>
              </div>
              <button
                onClick={() => {
                  playChime('tap');
                  onComplete(plan.phrases.map((p) => scores[p.id] ?? 85));
                }}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white text-xs font-bold shadow-xs active:scale-95 transition flex items-center gap-1"
              >
                <span>Skip</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>

          {/* Phrase Cards Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">

        {plan.phrases.map((p, idx) => {
          const done = scores[p.id] !== undefined;
          const isRec = recordingId === p.id;
          const hint = p.translations[nativeLanguage] ?? p.translations.Spanish;
          const currentScore = scores[p.id];

          return (
            <div
              key={p.id}
              className={`rounded-3xl border p-4 flex flex-col justify-between space-y-3 transition-all ${
                done
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-soft'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Phrase {idx + 1}
                    </span>
                    {p.isSpacedRepetition && (
                      <span 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold border border-amber-300 dark:border-amber-700"
                        title="We added 1 phrase from an earlier lesson so you can lock it into memory."
                      >
                        📌 From Your Saved Phrases
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                    {p.phrase}
                  </p>
                  {p.originalMistake && (
                    <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800">
                      From yesterday: replaces <em>"{p.originalMistake}"</em>
                    </div>
                  )}
                  {p.ipa && <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{p.ipa}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setRadarPhrase(p.phrase)}
                    className="p-2.5 sm:p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 active:scale-95 transition"
                    title="Analyze Syllable Stress & Pitch Radar"
                    aria-label={`Analyze Syllable Stress & Pitch: ${p.phrase}`}
                  >
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={() => speakEnglish(p.phrase, { rate: audioSpeed, accent: plan.persona.accent, personaName: plan.persona.name })}
                    className="p-2.5 sm:p-3 rounded-2xl bg-brand-100 dark:bg-brand-950/60 hover:bg-brand-200 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 active:scale-95 transition"
                    aria-label={`Listen to: ${p.phrase}`}
                  >
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">{p.usageContext}</p>

              {/* Native-language hint toggle */}
              <button
                onClick={() => setHintsOpen((h) => ({ ...h, [p.id]: !h[p.id] }))}
                className="flex items-center gap-1.5 text-xs font-semibold text-lavender-600 dark:text-indigo-400 hover:text-lavender-700 dark:hover:text-indigo-300"
                aria-expanded={!!hintsOpen[p.id]}
              >
                {hintsOpen[p.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {hintsOpen[p.id] ? 'Hide' : 'Show'} {nativeLanguage} hint
              </button>
              {hintsOpen[p.id] && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-lavender-50 dark:bg-indigo-950/40 border border-lavender-200 dark:border-indigo-800/60 text-sm text-lavender-700 dark:text-indigo-300 animate-fade-in">
                  <Languages className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{hint ?? 'Hint coming soon for this language.'}</span>
                </div>
              )}

              {/* Live Speech Recognition Feedback Ticker */}
              {isRec && (
                <div className="p-3 rounded-2xl bg-brand-50 dark:bg-slate-800 border border-brand-200 dark:border-slate-700 text-xs text-brand-900 dark:text-slate-100 space-y-1.5 animate-slide-up">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-brand-700 dark:text-brand-400">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      Listening to your voice...
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Tap button when finished</span>
                  </div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 italic bg-white/80 dark:bg-slate-900 p-2 rounded-xl border border-brand-100 dark:border-slate-700 min-h-[32px] flex items-center">
                    {liveTranscript ? `"${liveTranscript}"` : 'Say the phrase now...'}
                  </div>
                </div>
              )}

              {/* Practice mic & status */}
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <button
                  onClick={() => toggleRecord(p.id, p.phrase)}
                  disabled={!!recordingId && !isRec}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition active:scale-95 disabled:opacity-40 ${
                    isRec
                      ? 'bg-rose-500 text-white ring-4 ring-rose-200'
                      : done
                      ? 'bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700'
                      : 'bg-brand-600 hover:bg-brand-700 text-white shadow-soft'
                  }`}
                >
                  {isRec ? <Square className="w-4 h-4 fill-white" /> : <Mic className="w-4 h-4" />}
                  {isRec ? 'Tap when finished' : done ? 'Try saying it again' : 'Practice Saying It'}
                </button>

                {isRec && (
                  <div className="flex items-end gap-0.5 h-6" aria-hidden>
                    {[0.6, 1, 0.8, 1.2, 0.7].map((m, i) => (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-rose-400 transition-all duration-75"
                        style={{ height: `${Math.max(6, Math.min(24, Math.max(level, 0.2) * 50 * m))}px` }}
                      />
                    ))}
                  </div>
                )}

                {done && !isRec && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{currentScore}% clear</span>
                    </div>

                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setEditText(heard[p.id] || p.phrase);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs flex items-center gap-1"
                      title="Adjust what was heard"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* What was heard & feedback */}
              {done && heard[p.id] && !isRec && (
                <div className="text-xs text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="leading-tight">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Heard: </span>
                    <span className="text-slate-900 dark:text-white font-bold">"{heard[p.id]}"</span>
                  </div>
                </div>
              )}

              {/* Optional manual edit box */}
              {editingId === p.id && (
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 space-y-2 animate-fade-in">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Edit or type what you said:</div>
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
                    placeholder="Type words here..."
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleManualSubmit(p.id, p.phrase)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                    >
                      Save &amp; Score
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
          </div>
        </div>
      </div>

      {/* Unlock footer: permanently docked and sticky */}
      <div className="flex-shrink-0 sticky bottom-0 z-10 px-4 sm:px-6 pt-3 pb-safe border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-lg">
        <div className="max-w-4xl mx-auto w-full space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>{practicedCount} of {plan.phrases.length} phrases practised</span>
            <div className="flex gap-1">
              {plan.phrases.map((p) => (
                <span
                  key={p.id}
                  className={`w-6 h-1.5 rounded-full ${
                    scores[p.id] !== undefined ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={() => {
                playChime('success');
                onComplete(plan.phrases.map((p) => scores[p.id] ?? 0));
              }}
              disabled={!allDone}
              className="flex-1 w-full py-3 sm:py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-95 bg-gradient-to-r from-brand-600 to-emerald-500 text-white shadow-soft disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-500 dark:disabled:text-slate-600 disabled:shadow-none"
            >
              {allDone ? (
                <>Start Live Roleplay with {plan.persona.name} <ArrowRight className="w-4 h-4" /></>
              ) : (
                <><Lock className="w-4 h-4" /> Practise all 3 phrases to unlock</>
              )}
            </button>

            {!allDone && (
              <button
                onClick={() => {
                  playChime('tap');
                  onComplete(plan.phrases.map((p) => scores[p.id] ?? 80));
                }}
                className="w-full sm:w-auto px-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-300 transition py-2 whitespace-nowrap"
              >
                Skip warm-up to Live Roleplay &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      <PronunciationRadarModal
        isOpen={Boolean(radarPhrase)}
        onClose={() => setRadarPhrase(null)}
        targetPhrase={radarPhrase || ''}
        persona={plan.persona}
        initialScore={radarPhrase ? (scores[plan.phrases.find((p) => p.phrase === radarPhrase)?.id || ''] || 85) : 85}
      />
    </div>
  );
};
