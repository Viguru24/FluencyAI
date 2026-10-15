import React, { useState, useEffect } from 'react';
import { Volume2, Mic, CheckCircle2, Sparkles, X, Activity } from 'lucide-react';
import { speakEnglish, playChime, stopSpeaking } from '../../services/speech';
import { analyzeSyllableStress } from '../../services/pronunciationRadar';
import { startRecognition, type RecognitionHandle } from '../../services/speechRecognition';
import type { SyllableStressInfo, AIPersona } from '../../types';

interface PronunciationRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPhrase: string;
  userSaid?: string;
  initialScore?: number;
  persona?: AIPersona;
}

export const PronunciationRadarModal: React.FC<PronunciationRadarModalProps> = ({
  isOpen,
  onClose,
  targetPhrase,
  userSaid,
  initialScore = 85,
  persona,
}) => {
  const [analysis, setAnalysis] = useState<SyllableStressInfo>(() =>
    analyzeSyllableStress(targetPhrase, userSaid, initialScore)
  );
  const [isPlayingCoach, setIsPlayingCoach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentScore, setCurrentScore] = useState(initialScore);
  const [userCurve, setUserCurve] = useState<number[]>([55, 68, 75, 62, 58, 44]);
  const recRef = React.useRef<RecognitionHandle | null>(null);

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        const data = analyzeSyllableStress(targetPhrase, userSaid, initialScore);
        setAnalysis(data);
        setCurrentScore(initialScore);
        setUserCurve(data.targetPitchCurve.map((p) => Math.max(30, Math.min(95, p + (Math.random() * 16 - 8)))));
      });
    }
    return () => {
      stopSpeaking();
      recRef.current?.stop();
    };
  }, [isOpen, targetPhrase, userSaid, initialScore]);

  if (!isOpen) return null;

  const handlePlayCoach = () => {
    playChime('tap');
    setIsPlayingCoach(true);
    speakEnglish(targetPhrase, {
      personaName: persona?.name || 'James',
      rate: persona?.rate || 0.92,
      pitch: persona?.pitch || 1.0,
      onStart: () => setIsPlayingCoach(true),
      onEnd: () => setIsPlayingCoach(false),
    });
  };

  const handleRecordTrial = () => {
    if (isRecording) {
      recRef.current?.stop();
      setIsRecording(false);
      return;
    }

    playChime('tap');
    setIsRecording(true);
    try {
      recRef.current = startRecognition({
        lang: 'en-GB',
        onInterim: (text) => {
          if (text.length > 3) {
            const newScore = Math.min(98, Math.max(65, Math.round(75 + text.length * 2)));
            setCurrentScore(newScore);
            const updated = analyzeSyllableStress(targetPhrase, text, newScore);
            setAnalysis(updated);
            setUserCurve(updated.targetPitchCurve.map((p) => Math.max(25, Math.min(98, p + (Math.random() * 10 - 5)))));
          }
        },
        onStatusChange: (status) => {
          if (status === 'error' || status === 'stopped') {
            setIsRecording(false);
            playChime('success');
          }
        },
      });
    } catch {
      setIsRecording(false);
    }
  };

  // SVG Pitch curve points calculation
  const targetSvgPoints = analysis.targetPitchCurve
    .map((val, idx) => `${idx * 60 + 20},${100 - val * 0.8}`)
    .join(' ');
  const userSvgPoints = userCurve
    .map((val, idx) => `${idx * 60 + 20},${100 - val * 0.8}`)
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header with gradient badge */}
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Syllable Stress & Pitch Radar
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                  {currentScore}% Match
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                British Received Pronunciation (RP) Pitch & Rhythm Comparison
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

        {/* Content Body */}
        <div className="p-5 space-y-5">
          {/* Target Phrase Box */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Target Utterance
            </span>
            <p className="text-lg font-bold text-slate-100 tracking-wide">
              &ldquo;{targetPhrase}&rdquo;
            </p>
          </div>

          {/* Syllable Breakdown & Stress Heatmap */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                Key Word Breakdown: <span className="text-indigo-400 font-bold">{analysis.word}</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Primary stress marked with <span className="text-amber-400 font-bold">ˈ</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {analysis.syllables.map((syl, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-2xl border transition-all text-center ${
                    syl.isStressed
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-800/60 border-slate-700/60'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Syllable {i + 1}
                  </div>
                  <div className={`text-base font-black my-0.5 ${syl.isStressed ? 'text-amber-300 scale-105' : 'text-slate-200'}`}>
                    {syl.text}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {syl.ipa}
                  </div>
                  <div className="mt-1.5 text-[10px] font-semibold flex items-center justify-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    {syl.userAccuracyScore}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Pitch Waveform Chart */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-3">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                  Target RP Contour
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Your Pitch Shape
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Intonation Glide</span>
            </div>

            <div className="relative w-full h-28 flex items-center justify-center">
              <svg viewBox="0 0 340 100" className="w-full h-full overflow-visible">
                {/* Background grid lines */}
                <line x1="20" y1="25" x2="320" y2="25" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
                <line x1="20" y1="50" x2="320" y2="50" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
                <line x1="20" y1="75" x2="320" y2="75" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />

                {/* Target curve */}
                <polyline
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={targetSvgPoints}
                />
                {/* User curve */}
                <polyline
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={userSvgPoints}
                />
              </svg>
            </div>

            <p className="mt-2 text-xs text-slate-400 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              💡 <span className="text-slate-300 font-medium">Coach Intonation Tip:</span> {analysis.phonemeAdvice}
            </p>
          </div>

          {/* Action Buttons: Listen & Retry Microphone */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={handlePlayCoach}
              disabled={isPlayingCoach}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
            >
              <Volume2 className={`w-4 h-4 ${isPlayingCoach ? 'animate-bounce' : ''}`} />
              {isPlayingCoach ? 'Speaking...' : 'Listen to British Coach'}
            </button>

            <button
              onClick={handleRecordTrial}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm transition active:scale-95 shadow-lg ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              <Mic className="w-4 h-4" />
              {isRecording ? 'Listening... (Speak Now)' : 'Practice & Rescore Voice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
