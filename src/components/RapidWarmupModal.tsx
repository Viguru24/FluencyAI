import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Zap, Sparkles, Volume2, Award, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import { speakEnglish, playChime, stopSpeaking } from '../services/speech';
import { startRecognition, type RecognitionHandle } from '../services/speechRecognition';
import { recordActivity } from '../services/activityService';
import { calculateEarnedXP, awardGamificationXP } from '../store/rewardSystem';
import type { AIPersona } from '../types';

interface RapidWarmupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardXP: (xp: number) => void;
  persona: AIPersona;
}

const WARMUP_QUESTIONS = [
  "To start our warm-up: what was the highlight of your week so far?",
  "Wonderful! If you could spend an afternoon exploring any UK town or city, where would you go?",
  "Splendid! Lastly, tell me about something you're looking forward to this weekend.",
];

export const RapidWarmupModal: React.FC<RapidWarmupModalProps> = ({
  isOpen,
  onClose,
  onRewardXP,
  persona,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const timerRef = useRef<number | null>(null);
  const recRef = useRef<RecognitionHandle | null>(null);
  const completedPromptsTranscriptRef = useRef('');
  const currentPromptTranscriptRef = useRef('');

  const handleCompleteWarmup = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    recRef.current?.abort();
    stopSpeaking();
    setIsRecording(false);
    setIsAiSpeaking(false);
    setIsFinished(true);

    playChime('streak');
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });

    // Calculate dynamic XP (+50 Base XP + Streak & Pronunciation bonus)
    const xpCalc = calculateEarnedXP('sprint-60s', 50);
    awardGamificationXP(xpCalc, 2);
    recordActivity(2, xpCalc.totalEarnedXP);
    onRewardXP(xpCalc.totalEarnedXP);
  }, [onRewardXP]);

  const startListening = React.useCallback(() => {
    setIsRecording(true);
    currentPromptTranscriptRef.current = '';
    try {
      recRef.current = startRecognition({
        lang: 'en-GB',
        silenceTimeoutMs: 60000,
        initialSilenceTimeoutMs: 60000,
        onInterim: (text) => {
          currentPromptTranscriptRef.current = text;
          const combined = [completedPromptsTranscriptRef.current, text]
            .filter(Boolean)
            .join(' ')
            .trim();
          setSpokenTranscript(combined);
          const words = combined ? combined.split(/\s+/).filter(Boolean) : [];
          setWordCount(words.length);
        },
        onStatusChange: (status) => {
          if (status === 'error' || status === 'stopped') {
            setIsRecording(false);
          }
        },
      });
    } catch {
      setIsRecording(false);
    }
  }, []);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      completedPromptsTranscriptRef.current = '';
      currentPromptTranscriptRef.current = '';
      queueMicrotask(() => {
        setSecondsRemaining(60);
        setQuestionIndex(0);
        setSpokenTranscript('');
        setIsFinished(false);
        setWordCount(0);
      });

      // Speak first question
      const q = WARMUP_QUESTIONS[0];
      speakEnglish(q, {
        personaName: persona.name,
        rate: persona.rate || 0.94,
        pitch: persona.pitch || 1.0,
        onStart: () => setIsAiSpeaking(true),
        onEnd: () => {
          setIsAiSpeaking(false);
          startListening();
        },
      });

      // Start 60s countdown timer
      timerRef.current = window.setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            handleCompleteWarmup();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopSpeaking();
      recRef.current?.abort();
    };
  }, [isOpen, persona.name, persona.rate, persona.pitch, handleCompleteWarmup, startListening]);

  const handleNextPrompt = () => {
    if (questionIndex + 1 < WARMUP_QUESTIONS.length) {
      playChime('tap');
      if (currentPromptTranscriptRef.current.trim()) {
        completedPromptsTranscriptRef.current = [
          completedPromptsTranscriptRef.current,
          currentPromptTranscriptRef.current.trim(),
        ]
          .filter(Boolean)
          .join(' ')
          .trim();
        currentPromptTranscriptRef.current = '';
      }
      const nextIdx = questionIndex + 1;
      setQuestionIndex(nextIdx);
      const q = WARMUP_QUESTIONS[nextIdx];

      recRef.current?.abort();
      setIsRecording(false);

      speakEnglish(q, {
        personaName: persona.name,
        rate: persona.rate || 0.94,
        pitch: persona.pitch || 1.0,
        onStart: () => setIsAiSpeaking(true),
        onEnd: () => {
          setIsAiSpeaking(false);
          startListening();
        },
      });
    } else {
      handleCompleteWarmup();
    }
  };

  if (!isOpen) return null;

  const timerPercent = Math.round((secondsRemaining / 60) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-950 via-slate-900 to-rose-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                60s Spoken Velocity Sprint
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                  Rapid Fire
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Spontaneous response drill with {persona.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-center">
          {!isFinished ? (
            <>
              {/* Radial Timer & Word Counter Bar */}
              <div className="flex items-center justify-center gap-8">
                {/* Circular timer indicator */}
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="#334155"
                      strokeWidth="6"
                      fill="transparent"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="#f59e0b"
                      strokeWidth="6"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 * (1 - timerPercent / 100)}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-amber-400">{secondsRemaining}s</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Left</span>
                  </div>
                </div>

                {/* Words spoken stats */}
                <div className="text-left space-y-1">
                  <div className="text-3xl font-black text-emerald-400 flex items-center gap-1.5">
                    {wordCount}
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Words</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Prompt {questionIndex + 1} of {WARMUP_QUESTIONS.length}
                  </p>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    <Flame className="w-3 h-3" /> Velocity: {Math.round(wordCount / Math.max(1, (61 - secondsRemaining) / 60))} WPM
                  </span>
                </div>
              </div>

              {/* Current Question Box */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 text-left space-y-2">
                <div className="flex items-center justify-between text-xs text-indigo-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className={`w-3.5 h-3.5 ${isAiSpeaking ? 'animate-bounce text-amber-300' : ''}`} />
                    {persona.name} asks:
                  </span>
                  {isRecording && (
                    <span className="flex items-center gap-1 text-emerald-400 animate-pulse">
                      <Mic className="w-3.5 h-3.5" /> Mic Active
                    </span>
                  )}
                </div>
                <p className="text-base font-bold text-slate-100 leading-snug">
                  &ldquo;{WARMUP_QUESTIONS[questionIndex]}&rdquo;
                </p>
              </div>

              {/* Live Transcript Preview */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-left min-h-[50px] max-h-24 overflow-y-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Spoken Stream:
                </span>
                <p className="text-xs text-slate-300 italic">
                  {spokenTranscript || 'Speak continuously! Tell your coach whatever comes to mind...'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5">
                <button
                  onClick={handleNextPrompt}
                  className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition shadow-lg shadow-indigo-600/30"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Next Prompt &rarr;
                </button>
                <button
                  onClick={handleCompleteWarmup}
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs active:scale-95 transition"
                >
                  Finish Early
                </button>
              </div>
            </>
          ) : (
            /* Completed Screen */
            <div className="py-6 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-xl font-black text-white">Warmup Sprint Complete!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Splendid work overcoming hesitation. Speaking continuously builds rapid cognitive retrieval in British English.
                </p>
              </div>

              {/* Stats Card */}
              <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 max-w-xs mx-auto flex justify-around text-center">
                <div>
                  <div className="text-xl font-black text-emerald-400">{wordCount}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Words</div>
                </div>
                <div className="w-px bg-slate-700" />
                <div>
                  <div className="text-xl font-black text-amber-400">+50</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">XP Bonus</div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/30 active:scale-95 transition"
              >
                Collect XP &amp; Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
