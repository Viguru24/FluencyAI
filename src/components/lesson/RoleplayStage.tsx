import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Eye, EyeOff, LifeBuoy, Volume2, Flag, Loader2 } from 'lucide-react';
import type { LessonPlan, NativeLanguage, PhrasingUpgrade } from '../../types';
import { speakEnglish, stopSpeaking, playChime } from '../../services/speech';
import { startRecognition, isRecognitionSupported, type RecognitionHandle } from '../../services/speechRecognition';
import { AudioVisualizerController } from '../../services/audioVisualizer';
import { WaveformVisualizer } from './WaveformVisualizer';
import { HowDoISaySheet } from './HowDoISaySheet';
import { generateJamesReply, generateGeminiScorecard } from '../../services/geminiService';

interface Turn {
  id: string;
  speaker: 'ai' | 'user';
  text: string;
  revealed: boolean;
  isMock?: boolean;
}

export interface RoleplayStats {
  userTurns: string[];
  revealsUsed: number;
  helpRequests: number;
  aiTurnsHeard: number;
  fluencyScore?: number;
  dynamicUpgrades?: PhrasingUpgrade[];
  phrasesToReview?: string[];
}

interface Props {
  plan: LessonPlan;
  nativeLanguage: NativeLanguage;
  audioSpeed: number;
  onMicDenied: () => void;
  onEnd: (stats: RoleplayStats) => void;
}

const HOLD_THRESHOLD_MS = 350;
const MAX_TURNS = 5;

export const RoleplayStage: React.FC<Props> = ({ plan, nativeLanguage, audioSpeed, onMicDenied, onEnd }) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [aiIndex, setAiIndex] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzingScorecard, setIsAnalyzingScorecard] = useState(false);
  const [interim, setInterim] = useState('');
  const [bands, setBands] = useState<number[]>([]);
  const [revealAll, setRevealAll] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [revealsUsed, setRevealsUsed] = useState(0);
  const [helpRequests, setHelpRequests] = useState(0);

  const vizRef = useRef(new AudioVisualizerController());
  const recRef = useRef<RecognitionHandle | null>(null);
  const pressStart = useRef(0);
  const userTurnCount = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userTurnsCount = turns.filter((t) => t.speaker === 'user').length;
  const currentTurn = Math.min(MAX_TURNS, userTurnsCount + 1);
  const conversationOver = userTurnsCount >= MAX_TURNS || aiIndex >= plan.aiTurns.length;

  const speakAi = useCallback(
    (text: string) => {
      speakEnglish(text, {
        rate: audioSpeed,
        accent: plan.persona.accent,
        onStart: () => setIsAiSpeaking(true),
        onEnd: () => setIsAiSpeaking(false),
      });
      setIsAiSpeaking(true);
    },
    [audioSpeed, plan.persona.accent]
  );

  const pushAiTurn = useCallback(
    (index: number) => {
      const text = plan.aiTurns[index];
      if (!text) return;
      setTurns((t) => [...t, { id: `ai-${index}`, speaker: 'ai', text, revealed: false }]);
      setAiIndex(index + 1);
      speakAi(text);
    },
    [plan.aiTurns, speakAi]
  );

  // Kick off with James's opening line
  useEffect(() => {
    const t = window.setTimeout(() => pushAiTurn(0), 500);
    const viz = vizRef.current;
    return () => {
      window.clearTimeout(t);
      stopSpeaking();
      viz.stopMicrophone();
      recRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, interim]);

  const startRecording = async () => {
    if (isRecording || isProcessing || conversationOver) return;
    stopSpeaking();
    setIsAiSpeaking(false);
    const ok = await vizRef.current.startMicrophone(setBands);
    if (!ok) {
      onMicDenied();
      return;
    }
    playChime('tap');
    setIsRecording(true);
    setInterim('');
    recRef.current = isRecognitionSupported()
      ? startRecognition({
          lang: plan.persona.accent === 'UK' ? 'en-GB' : 'en-US',
          onInterim: (text) => setInterim(text),
        })
      : null;
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsProcessing(true);
    vizRef.current.stopMicrophone();

    let heard: string | null = null;
    if (recRef.current) {
      heard = await recRef.current.stop();
      recRef.current = null;
    }
    setInterim('');

    const idx = userTurnCount.current++;
    const fallback = plan.mockUserReplies[idx % plan.mockUserReplies.length];
    const userSpokeReal = Boolean(heard && heard.trim().length > 0);
    const text = userSpokeReal ? heard!.trim() : fallback;

    const newTurns: Turn[] = [
      ...turns,
      { id: `u-${idx}`, speaker: 'user', text, revealed: true, isMock: !userSpokeReal },
    ];
    setTurns(newTurns);

    const completedUserTurns = newTurns.filter((t) => t.speaker === 'user').length;
    const isFinished = completedUserTurns >= MAX_TURNS;

    try {
      const historyForGemini = newTurns.map((t) => ({ speaker: t.speaker, text: t.text }));
      let aiReply = '';

      if (isFinished) {
        // When 5 turns are completed, James warmly wraps up the first day sprint
        aiReply = await generateJamesReply(
          [
            ...historyForGemini,
            {
              speaker: 'user',
              text: '[Learner has completed all 5 roleplay turns. Conclude warmly in 1-2 British English sentences as James thanking them for their great first day and welcoming them to view their scorecard.]',
            },
          ],
          plan.title,
          ['Brilliant effort today! You’ve done wonderfully on your first day — let’s check out your scorecard.'],
          plan.persona
        );
      } else {
        aiReply = await generateJamesReply(historyForGemini, plan.title, plan.aiTurns, plan.persona);
      }

      setTurns((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, speaker: 'ai', text: aiReply, revealed: false },
      ]);
      setAiIndex((i) => i + 1);
      speakAi(aiReply);
    } catch (err) {
      console.warn('Error fetching tutor reply:', err);
      const fallbackAi = plan.aiTurns[Math.min(aiIndex, plan.aiTurns.length - 1)] || 'Splendid! Lovely chatting with you.';
      setTurns((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, speaker: 'ai', text: fallbackAi, revealed: false },
      ]);
      setAiIndex((i) => i + 1);
      speakAi(fallbackAi);
    } finally {
      setIsProcessing(false);
    }
  };

  // One button, two styles:
  //  • Push-to-talk: press & hold, release to send.
  //  • Tap-to-speak: quick tap to start, tap again to send.
  const pressAction = useRef<'start' | 'stop' | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    pressStart.current = Date.now();
    if (isRecording) {
      pressAction.current = 'stop';
    } else {
      pressAction.current = 'start';
      startRecording();
    }
  };
  const onPointerUp = () => {
    const action = pressAction.current;
    pressAction.current = null;
    if (!action) return;
    const held = Date.now() - pressStart.current;
    if (action === 'stop' || held > HOLD_THRESHOLD_MS) stopRecording();
  };

  const revealTurn = (id: string) => {
    const target = turns.find((x) => x.id === id);
    if (!target || target.revealed) return;
    setRevealsUsed((n) => n + 1);
    setTurns((t) => t.map((x) => (x.id === id ? { ...x, revealed: true } : x)));
  };

  const endRoleplay = async () => {
    stopSpeaking();
    vizRef.current.stopMicrophone();
    recRef.current?.stop();

    const userTurnsList = turns.filter((t) => t.speaker === 'user').map((t) => t.text);
    setIsAnalyzingScorecard(true);

    try {
      const scorecard = await generateGeminiScorecard({
        plan,
        userTurns: userTurnsList,
        defaultUpgrades: plan.upgrades,
      });
      onEnd({
        userTurns: userTurnsList,
        revealsUsed,
        helpRequests,
        aiTurnsHeard: turns.filter((t) => t.speaker === 'ai').length,
        fluencyScore: scorecard?.fluency,
        dynamicUpgrades: scorecard?.upgrades,
      });
    } catch (err) {
      console.warn('Scorecard analysis error:', err);
      onEnd({
        userTurns: userTurnsList,
        revealsUsed,
        helpRequests,
        aiTurnsHeard: turns.filter((t) => t.speaker === 'ai').length,
      });
    } finally {
      setIsAnalyzingScorecard(false);
    }
  };

  const mode = isRecording ? 'user' : isAiSpeaking ? 'ai' : 'idle';
  const statusText = isRecording
    ? 'Listening… release or tap to send'
    : isProcessing
    ? `${plan.persona.name} is thinking…`
    : isAiSpeaking
    ? `${plan.persona.name} is speaking — listen carefully`
    : conversationOver
    ? 'Conversation complete — great work!'
    : 'Your turn — hold or tap the mic to speak';

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-b from-slate-50 to-white">
      {/* Stage tag with Turn Count badge + reveal toggle */}
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold border border-brand-200">
          Stage 2 · Turn {currentTurn} of {MAX_TURNS}
        </span>
        <button
          onClick={() => {
            playChime('tap');
            setRevealAll((r) => !r);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
            revealAll ? 'bg-brand-600 text-white border-brand-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:bg-slate-50'
          }`}
          aria-pressed={revealAll}
          title="Toggle blurred transcript for ear training"
        >
          {revealAll ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {revealAll ? 'Transcript: Revealed' : 'Transcript: Blurred'}
        </button>
      </div>

      {/* Persona + waveform */}
      <div className="flex flex-col items-center pt-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{plan.persona.avatar}</span>
          <div className="text-left">
            <div className="text-sm font-extrabold text-slate-900">{plan.persona.name}</div>
            <div className="text-[11px] text-slate-500">
              {plan.persona.role} · {plan.persona.accent === 'UK' ? '🇬🇧 British' : '🇺🇸 American'}
            </div>
          </div>
        </div>
        <WaveformVisualizer mode={mode} bands={bands} />
        <p className="text-sm font-semibold text-slate-600 mb-2 px-6 text-center" aria-live="polite">{statusText}</p>
      </div>

      {/* Live transcript with min-h-[140px], pt-4, and scrollbar-none to prevent top blur clipping */}
      <div ref={scrollRef} className="flex-1 min-h-[140px] overflow-y-auto px-4 pt-4 pb-10 space-y-2.5 scrollbar-none no-scrollbar">
        {turns.map((t) => {
          const hidden = t.speaker === 'ai' && !t.revealed && !revealAll;
          return (
            <div key={t.id} className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  t.speaker === 'user'
                    ? 'bg-brand-600 text-white rounded-br-md'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                }`}
              >
                {t.speaker === 'ai' ? (
                  <button
                    onClick={() => revealTurn(t.id)}
                    className="text-left w-full"
                    aria-label={hidden ? 'Hidden text. Tap to reveal.' : t.text}
                  >
                    <span className={`block py-0.5 transition-all duration-300 ${hidden ? 'blur-[5px] select-none' : ''}`}>{t.text}</span>
                    {hidden && <span className="block mt-1 text-[11px] font-bold text-brand-600">Listen first · tap to reveal</span>}
                  </button>
                ) : (
                  <>
                    <span>{t.text}</span>
                    {t.isMock && <span className="block mt-1 text-[10px] text-brand-100">Demo transcript (speech-to-text unavailable)</span>}
                  </>
                )}
                {t.speaker === 'ai' && (
                  <button
                    onClick={() => speakAi(t.text)}
                    className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-brand-600"
                  >
                    <Volume2 className="w-3 h-3" /> Replay
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {interim && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm bg-brand-100 text-brand-900 italic">{interim}…</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 pb-5 pt-3 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              stopSpeaking();
              setHelpOpen(true);
              setHelpRequests((n) => n + 1);
            }}
            className="flex flex-col items-center gap-1 w-20 text-amber-700"
          >
            <span className="w-12 h-12 rounded-2xl bg-amber-100 hover:bg-amber-200 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold leading-tight text-center">How do I say…?</span>
          </button>

          {/* Big push-to-talk button */}
          <button
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (isRecording) stopRecording();
                else startRecording();
              }
            }}
            disabled={isProcessing || isAnalyzingScorecard || conversationOver}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white shadow-fab transition-all active:scale-95 touch-none select-none disabled:opacity-40 ${
              isRecording ? 'bg-rose-500 scale-110' : 'bg-gradient-to-br from-brand-600 to-emerald-500'
            }`}
            aria-label={isRecording ? 'Stop speaking' : 'Hold or tap to speak'}
          >
            {isRecording && <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-40" />}
            {isProcessing ? (
              <Loader2 className="w-9 h-9 animate-spin" />
            ) : isRecording ? (
              <Square className="w-8 h-8 fill-white" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
          </button>

          <button
            onClick={endRoleplay}
            disabled={isAnalyzingScorecard}
            className="flex flex-col items-center gap-1 w-20 text-slate-600"
          >
            <span
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                conversationOver ? 'bg-emerald-500 text-white animate-bounce-subtle' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <Flag className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold">{conversationOver ? 'See results' : 'End roleplay'}</span>
          </button>
        </div>
      </div>

      {helpOpen && (
        <HowDoISaySheet
          phrases={plan.helpPhrases}
          nativeLanguage={nativeLanguage}
          accent={plan.persona.accent}
          audioSpeed={audioSpeed}
          onClose={() => setHelpOpen(false)}
          onUsed={() => {}}
        />
      )}

      {/* Scorecard Grading Overlay with Gemini AI */}
      {isAnalyzingScorecard && (
        <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mb-4 shadow-soft">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Grading Your Spoken Roleplay</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            James &amp; Gemini AI are evaluating your British phrasing, politeness, and natural office vocabulary…
          </p>
        </div>
      )}
    </div>
  );
};
