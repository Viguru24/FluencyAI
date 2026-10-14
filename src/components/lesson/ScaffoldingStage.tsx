import React, { useRef, useState } from 'react';
import { Volume2, Mic, Square, Eye, EyeOff, CheckCircle2, Lock, ArrowRight, Languages } from 'lucide-react';
import type { LessonPlan, NativeLanguage } from '../../types';
import { speakEnglish, playChime } from '../../services/speech';
import { startRecognition, scorePronunciation, isRecognitionSupported, type RecognitionHandle } from '../../services/speechRecognition';
import { AudioVisualizerController } from '../../services/audioVisualizer';

interface Props {
  plan: LessonPlan;
  nativeLanguage: NativeLanguage;
  audioSpeed: number;
  onMicDenied: () => void;
  onComplete: (scores: number[]) => void;
}

export const ScaffoldingStage: React.FC<Props> = ({ plan, nativeLanguage, audioSpeed, onMicDenied, onComplete }) => {
  const [hintsOpen, setHintsOpen] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [heard, setHeard] = useState<Record<string, string>>({});
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const recRef = useRef<RecognitionHandle | null>(null);
  const vizRef = useRef(new AudioVisualizerController());
  const fallbackTimer = useRef<number | null>(null);

  const practicedCount = plan.phrases.filter((p) => scores[p.id] !== undefined).length;
  const allDone = practicedCount === plan.phrases.length;

  const finishRecording = async (id: string, target: string) => {
    if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
    recRef.current?.stop();
    const text = recRef.current ? await recRef.current.result : null;
    recRef.current = null;
    vizRef.current.stopMicrophone();
    setRecordingId(null);
    setLevel(0);

    // If recognition isn't available, award an encouraging mock score so the flow continues
    const score = text ? Math.max(55, scorePronunciation(target, text)) : 78 + Math.floor(Math.random() * 15);
    setScores((s) => ({ ...s, [id]: score }));
    setHeard((h) => ({ ...h, [id]: text ?? '(Speech recognition unavailable — demo score)' }));
    playChime(score >= 70 ? 'success' : 'tap');
  };

  const toggleRecord = async (id: string, target: string) => {
    if (recordingId === id) {
      finishRecording(id, target);
      return;
    }
    if (recordingId) return;

    playChime('tap');
    const granted = await vizRef.current.startMicrophone((bands) => {
      setLevel(bands.reduce((a, b) => a + b, 0) / bands.length);
    });
    if (!granted) {
      onMicDenied();
      return;
    }
    setRecordingId(id);
    recRef.current = isRecognitionSupported() ? startRecognition(plan.persona.accent === 'UK' ? 'en-GB' : 'en-US') : null;
    // Auto-stop after 6s so learners don't get stuck
    fallbackTimer.current = window.setTimeout(() => finishRecording(id, target), 6000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold border border-brand-200">
            Stage 1 of 3 · Pre-Chat Prep
          </span>
          <h2 className="text-xl font-extrabold text-slate-900">Warm up your key phrases</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Listen, then say each phrase out loud once. You’ll use them with {plan.persona.name} in a moment.
          </p>
        </div>

        {plan.phrases.map((p, idx) => {
          const done = scores[p.id] !== undefined;
          const isRec = recordingId === p.id;
          const hint = p.translations[nativeLanguage] ?? p.translations.Spanish;
          return (
            <div
              key={p.id}
              className={`rounded-3xl border p-4 space-y-3 transition-all ${
                done ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200 shadow-soft'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phrase {idx + 1}</div>
                  <p className="text-lg font-extrabold text-slate-900 leading-snug">{p.phrase}</p>
                  {p.ipa && <p className="text-xs font-mono text-slate-500">{p.ipa}</p>}
                </div>
                <button
                  onClick={() => speakEnglish(p.phrase, { rate: audioSpeed, accent: plan.persona.accent })}
                  className="flex-shrink-0 p-3 rounded-2xl bg-brand-100 hover:bg-brand-200 text-brand-700 active:scale-95 transition"
                  aria-label={`Listen to: ${p.phrase}`}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600">{p.usageContext}</p>

              {/* Native-language hint toggle */}
              <button
                onClick={() => setHintsOpen((h) => ({ ...h, [p.id]: !h[p.id] }))}
                className="flex items-center gap-1.5 text-xs font-semibold text-lavender-600 hover:text-lavender-700"
                aria-expanded={!!hintsOpen[p.id]}
              >
                {hintsOpen[p.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {hintsOpen[p.id] ? 'Hide' : 'Show'} {nativeLanguage} hint
              </button>
              {hintsOpen[p.id] && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-lavender-50 border border-lavender-200 text-sm text-lavender-700 animate-fade-in">
                  <Languages className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{hint ?? 'Hint coming soon for this language.'}</span>
                </div>
              )}

              {/* Practice mic */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => toggleRecord(p.id, p.phrase)}
                  disabled={!!recordingId && !isRec}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition active:scale-95 disabled:opacity-40 ${
                    isRec
                      ? 'bg-rose-500 text-white ring-4 ring-rose-200'
                      : done
                      ? 'bg-white border border-emerald-300 text-emerald-700'
                      : 'bg-brand-600 hover:bg-brand-700 text-white shadow-soft'
                  }`}
                >
                  {isRec ? <Square className="w-4 h-4 fill-white" /> : <Mic className="w-4 h-4" />}
                  {isRec ? 'Tap when finished' : done ? 'Try again' : 'Practice Saying It'}
                </button>

                {isRec && (
                  <div className="flex items-end gap-0.5 h-6" aria-hidden>
                    {[0.6, 1, 0.8, 1.2, 0.7].map((m, i) => (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-rose-400 transition-all duration-75"
                        style={{ height: `${Math.max(4, Math.min(24, level * 60 * m))}px` }}
                      />
                    ))}
                  </div>
                )}

                {done && !isRec && (
                  <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    {scores[p.id]}% clear
                  </div>
                )}
              </div>
              {done && heard[p.id] && !isRec && (
                <p className="text-[11px] text-slate-500 italic">We heard: “{heard[p.id]}”</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Unlock footer */}
      <div className="p-4 border-t border-slate-200 bg-white space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{practicedCount} of {plan.phrases.length} phrases practised</span>
          <div className="flex gap-1">
            {plan.phrases.map((p) => (
              <span key={p.id} className={`w-6 h-1.5 rounded-full ${scores[p.id] !== undefined ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            playChime('success');
            onComplete(plan.phrases.map((p) => scores[p.id] ?? 0));
          }}
          disabled={!allDone}
          className="w-full py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-95 bg-gradient-to-r from-brand-600 to-emerald-500 text-white shadow-soft disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none"
        >
          {allDone ? (
            <>Start Live Roleplay with {plan.persona.name} <ArrowRight className="w-4 h-4" /></>
          ) : (
            <><Lock className="w-4 h-4" /> Practise all 3 phrases to unlock</>
          )}
        </button>
      </div>
    </div>
  );
};
