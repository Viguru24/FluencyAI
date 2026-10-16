import React, { useState, useEffect } from 'react';
import { 
  X, 
  RotateCw, 
  Volume2, 
  Mic, 
  Sparkles, 
  Award, 
  Repeat, 
  Layers,
  Download,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getDueSRSFlashcards, reviewSRSFlashcard, getSRSFlashcards, triggerDeckDownload } from '../services/srsService';
import { speakEnglish, playChime } from '../services/speech';
import { startRecognition, type RecognitionHandle } from '../services/speechRecognition';
import { calculateEarnedXP, awardGamificationXP } from '../store/rewardSystem';
import type { SRSFlashcard, AIPersona } from '../types';

interface SRSFlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardXP?: (xp: number) => void;
  persona?: AIPersona;
}

export const SRSFlashcardModal: React.FC<SRSFlashcardModalProps> = ({
  isOpen,
  onClose,
  onRewardXP,
  persona,
}) => {
  const [cards, setCards] = useState<SRSFlashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMatchScore, setVoiceMatchScore] = useState<number | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [allCardsStats, setAllCardsStats] = useState<SRSFlashcard[]>([]);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const recRef = React.useRef<RecognitionHandle | null>(null);

  const handleExport = (format: 'anki' | 'csv') => {
    const all = getSRSFlashcards();
    if (all.length === 0) return;
    playChime('success');
    triggerDeckDownload(all, format);
    setExportSuccess(format === 'anki' ? 'Anki .tsv' : 'CSV');
    setTimeout(() => setExportSuccess(null), 3500);
  };

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        const due = getDueSRSFlashcards();
        const all = getSRSFlashcards();
        setCards(due.length > 0 ? due : all.slice(0, 5));
        setAllCardsStats(all);
        setCurrentIndex(0);
        setIsFlipped(false);
        setReviewedCount(0);
        setVoiceMatchScore(null);
        setExportSuccess(null);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];
  const isFinished = currentIndex >= cards.length;

  const handleFlip = () => {
    playChime('tap');
    setIsFlipped((f) => !f);
  };

  const handleSpeak = (text: string) => {
    setIsSpeaking(true);
    speakEnglish(text, {
      personaName: persona?.name || 'James',
      rate: persona?.rate || 0.94,
      pitch: persona?.pitch || 1.0,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  };

  const handleVoiceTest = () => {
    if (isRecording) {
      recRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!currentCard) return;
    playChime('tap');
    setIsRecording(true);

    try {
      recRef.current = startRecognition({
        lang: 'en-GB',
        onInterim: (text) => {
          if (text.length > 3) {
            const cleanTarget = currentCard.phrase.toLowerCase().replace(/[^a-z0-9 ]/g, '');
            const cleanUser = text.toLowerCase().replace(/[^a-z0-9 ]/g, '');
            const match = cleanTarget.includes(cleanUser) || cleanUser.includes(cleanTarget) ? 95 : 78;
            setVoiceMatchScore(match);
          }
        },
        onStatusChange: (status) => {
          if (status === 'stopped' || status === 'error') {
            setIsRecording(false);
            if (!isFlipped) setIsFlipped(true);
          }
        },
      });
    } catch {
      setIsRecording(false);
    }
  };

  const handleReviewResult = (success: boolean) => {
    if (!currentCard) return;
    playChime(success ? 'success' : 'tap');

    reviewSRSFlashcard(currentCard.id, success);
    setReviewedCount((c) => c + 1);

    if (success) {
      onRewardXP?.(15);
      confetti({ particleCount: 25, spread: 50, origin: { y: 0.7 } });
    }

    if (currentIndex + 1 >= cards.length) {
      // Completed drill!
      playChime('streak');
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.5 } });
      const xpCalc = calculateEarnedXP('srs-session', 20);
      awardGamificationXP(xpCalc, 2);
    }

    setIsFlipped(false);
    setVoiceMatchScore(null);
    setCurrentIndex((i) => i + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Spaced Repetition (SRS) Studio
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                  Leitner 5-Box
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Daily memory calibration with voice recall verification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative group">
              <button
                type="button"
                className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                title="Export Deck"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-48 py-1.5 bg-slate-850 border border-slate-700 rounded-2xl shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-30">
                <button
                  type="button"
                  onClick={() => handleExport('anki')}
                  className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-750 hover:text-amber-300 flex items-center gap-2 transition"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Anki Deck (.tsv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-750 hover:text-emerald-300 flex items-center gap-2 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Spreadsheet (.csv)</span>
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Export Notification Toast */}
        {exportSuccess && (
          <div className="px-5 py-2 bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Exported {exportSuccess} successfully! You can import this directly into your Anki deck.</span>
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-4">
          {!isFinished && currentCard ? (
            <>
              {/* Progress & Box Indicator */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold">
                  Card {currentIndex + 1} of {cards.length}
                </span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((b) => (
                    <span
                      key={b}
                      className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center border transition-all ${
                        b === currentCard.box
                          ? 'bg-amber-500 text-slate-950 border-amber-400 scale-110 shadow-md shadow-amber-500/30'
                          : b < currentCard.box
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                          : 'bg-slate-800/60 text-slate-500 border-slate-700/60'
                      }`}
                    >
                      B{b}
                    </span>
                  ))}
                </div>
              </div>

              {/* 3D Flip Card Container */}
              <div
                onClick={handleFlip}
                className="cursor-pointer min-h-[220px] rounded-3xl p-6 border transition-all duration-300 relative flex flex-col justify-between group select-none shadow-xl bg-gradient-to-br from-slate-800/90 via-slate-850 to-slate-900 border-slate-700/80 hover:border-amber-500/50"
              >
                {!isFlipped ? (
                  /* Card Front: Recall challenge */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider">
                        {currentCard.context}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <RotateCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                        Tap to reveal upgrade
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Scenario Challenge:
                      </h4>
                      <p className="text-xl font-extrabold text-slate-100 leading-snug">
                        {currentCard.meaning}
                      </p>
                    </div>

                    {currentCard.scenarioTitle && (
                      <p className="text-xs text-slate-400 italic">
                        Context: {currentCard.scenarioTitle}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Card Back: Target British Natural Upgrade */
                  <div className="space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                        ✓ Natural British Upgrade
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeak(currentCard.phrase);
                        }}
                        className="p-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 active:scale-95 transition"
                        title="Listen to British pronunciation"
                      >
                        <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-bounce text-amber-300' : ''}`} />
                      </button>
                    </div>

                    <p className="text-xl font-black text-amber-300 leading-snug tracking-wide">
                      &ldquo;{currentCard.phrase}&rdquo;
                    </p>

                    {currentCard.ipa && (
                      <p className="text-xs font-mono text-slate-400">{currentCard.ipa}</p>
                    )}

                    <div className="pt-1 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                      💡 {currentCard.meaning}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 mt-2">
                  <span>Box {currentCard.box} • Interval: {currentCard.box === 1 ? '1 day' : `${currentCard.box * 3} days`}</span>
                  <span className="text-amber-400/90 font-medium">Click card to flip</span>
                </div>
              </div>

              {/* Voice Verification / Retry Mic */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleVoiceTest}
                  className={`flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 border ${
                    isRecording
                      ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  {isRecording ? 'Listening (Speak upgrade now)...' : 'Test Spoken Recall with Mic'}
                </button>
                {voiceMatchScore !== null && (
                  <span className="px-3 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold animate-fade-in">
                    {voiceMatchScore}% Recall Match!
                  </span>
                )}
              </div>

              {/* Leitner Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => handleReviewResult(false)}
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 text-rose-300 hover:text-rose-200 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <Repeat className="w-4 h-4" />
                  Still Practicing (Keep in Box 1)
                </button>
                <button
                  onClick={() => handleReviewResult(true)}
                  className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Mastered! Advance to Box {Math.min(5, currentCard.box + 1)} (+15 XP)
                </button>
              </div>
            </>
          ) : (
            /* Finished All Due Cards Today */
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center text-3xl">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-black text-white">Daily Review Complete!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  You reviewed {reviewedCount} phrase{reviewedCount === 1 ? '' : 's'}. Spaced repetition strengthens your memory and ensures phrases come effortlessly when speaking.
                </p>
              </div>

              {/* Summary Stats */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 max-w-sm mx-auto text-xs text-slate-300 flex justify-around">
                <div>
                  <div className="text-lg font-black text-amber-400">+{reviewedCount * 15}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">XP Earned</div>
                </div>
                <div className="w-px bg-slate-700" />
                <div>
                  <div className="text-lg font-black text-emerald-400">{allCardsStats.length}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total In Deck</div>
                </div>
              </div>

              {/* 1-Click Anki / CSV Export Card */}
              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 max-w-sm mx-auto text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    Export Flashcards
                  </span>
                  <span className="text-[10px] text-slate-400">{allCardsStats.length} Total Cards</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleExport('anki')}
                    className="py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-750 text-slate-200 hover:text-amber-300 border border-slate-750 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Anki (.tsv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-750 text-slate-200 hover:text-emerald-300 border border-slate-750 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Spreadsheet (.csv)</span>
                  </button>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition active:scale-95 shadow-lg shadow-indigo-600/30"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
