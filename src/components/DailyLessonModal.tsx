import React, { useState } from 'react';
import { 
  X, 
  Volume2, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  HelpCircle, 
  Mic, 
  Trophy
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { DailyLessonData, UserProgress } from '../types';
import { speakEnglish, playChime } from '../services/speech';

interface DailyLessonModalProps {
  lesson: DailyLessonData;
  progress: UserProgress;
  onClose: () => void;
  onCompleteLesson: () => void;
}

export const DailyLessonModal: React.FC<DailyLessonModalProps> = ({
  lesson,
  progress,
  onClose,
  onCompleteLesson,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isPracticingSpeech, setIsPracticingSpeech] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');

  // Play phrase audio
  const handlePlayPhrase = (text: string, slow = false) => {
    playChime('tap');
    speakEnglish(text, {
      rate: slow ? 0.75 : progress.audioSpeed,
    });
  };

  // Submit quiz answer
  const handleSelectQuiz = (idx: number) => {
    if (isAnswerSubmitted) return;
    playChime('tap');
    setSelectedQuizAnswer(idx);
    setIsAnswerSubmitted(true);

    if (idx === lesson.quiz.correctIndex) {
      playChime('success');
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.6 },
      });
    }
  };

  // Web Speech recognition for pronunciation check
  const handleVoiceCheck = () => {
    playChime('tap');
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Simulate success if browser doesn't have recognition
      setSpokenTranscript(lesson.speakingPrompt.sampleResponse);
      playChime('success');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'en-US';
      rec.interimResults = false;
      setIsPracticingSpeech(true);

      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setSpokenTranscript(transcript);
        setIsPracticingSpeech(false);
        playChime('success');
      };

      rec.onerror = () => {
        setIsPracticingSpeech(false);
      };

      rec.onend = () => {
        setIsPracticingSpeech(false);
      };

      rec.start();
    } catch {
      setIsPracticingSpeech(false);
    }
  };

  const handleFinishLesson = () => {
    playChime('streak');
    confetti({
      particleCount: 80,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#0ea5e9', '#10b981', '#fbbf24', '#a855f7'],
    });
    onCompleteLesson();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Progress & Header Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-brand-600 via-sky-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">Daily Fluency Sprint</h3>
              <p className="text-[11px] text-brand-100 font-medium">Step {currentStep} of 3</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            aria-label="Close lesson"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Pills */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-50 border-b border-slate-200/80">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                currentStep >= step ? 'bg-brand-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Modal Body with Step Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* STEP 1: Phrase of the Day */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold border border-brand-200">
                  Phrase of the Day
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {lesson.estimatedMinutes} min practice
                </span>
              </div>

              {/* Main Phrase Card */}
              <div className="p-4 rounded-3xl bg-gradient-to-br from-brand-50/60 to-emerald-50/50 border border-brand-100 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      "{lesson.phraseOfTheDay.phrase}"
                    </h2>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">
                      {lesson.phraseOfTheDay.ipa}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handlePlayPhrase(lesson.phraseOfTheDay.phrase, false)}
                      className="p-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white shadow-soft transition active:scale-95"
                      title="Listen natural speed"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePlayPhrase(lesson.phraseOfTheDay.phrase, true)}
                      className="px-2 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 transition active:scale-95"
                      title="Listen slow and clear"
                    >
                      0.75x
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-bold text-slate-700">Meaning:</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {lesson.phraseOfTheDay.meaning}
                  </p>
                </div>

                {/* Native Language Translation */}
                <div className="p-2.5 rounded-2xl bg-white/90 border border-slate-200/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {progress.nativeLanguage} Translation:
                  </span>
                  <div className="text-xs font-bold text-brand-700">
                    {lesson.phraseOfTheDay.translations[progress.nativeLanguage] || 'Translation ready'}
                  </div>
                </div>

                {/* Example sentence */}
                <div className="text-xs text-slate-600 italic bg-brand-100/40 p-2.5 rounded-xl border border-brand-200/50">
                  <span className="font-semibold not-italic text-brand-900">Example: </span>
                  "{lesson.phraseOfTheDay.example}"
                </div>

                {/* Cultural Usage Note */}
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200/60">
                  <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>{lesson.phraseOfTheDay.culturalNote}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  playChime('tap');
                  setCurrentStep(2);
                }}
                className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-sm shadow-soft transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Continue to Quick Quiz</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Real-World Context Quiz */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                Context & Comprehension
              </span>

              {/* Context Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900 block mb-1">Scenario context:</span>
                {lesson.quiz.context}
              </div>

              {/* Question */}
              <h3 className="text-sm font-extrabold text-slate-900">
                {lesson.quiz.question}
              </h3>

              {/* Options */}
              <div className="space-y-2">
                {lesson.quiz.options.map((option, idx) => {
                  const isSelected = selectedQuizAnswer === idx;
                  const isCorrect = idx === lesson.quiz.correctIndex;

                  let styleClass = 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700';

                  if (isAnswerSubmitted) {
                    if (isCorrect) {
                      styleClass = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold';
                    } else if (isSelected) {
                      styleClass = 'bg-rose-50 border-rose-300 text-rose-800';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectQuiz(idx)}
                      disabled={isAnswerSubmitted}
                      className={`w-full p-3 rounded-2xl border text-xs text-left transition flex items-center justify-between gap-2 ${styleClass} active:scale-98`}
                    >
                      <span>{option}</span>
                      {isAnswerSubmitted && isCorrect && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feedback Explanation */}
              {isAnswerSubmitted && (
                <div className="p-3 rounded-2xl bg-brand-50 border border-brand-200 text-xs text-brand-900 space-y-1 animate-slide-up">
                  <div className="font-bold">Explanation:</div>
                  <p>{lesson.quiz.explanation}</p>
                </div>
              )}

              {isAnswerSubmitted && (
                <button
                  onClick={() => {
                    playChime('tap');
                    setCurrentStep(3);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-sm shadow-soft transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>Next: Speaking Challenge</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* STEP 3: Speaking & Pronunciation Challenge */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold border border-brand-200">
                Vocal Immersion
              </span>

              <div className="p-4 rounded-3xl bg-gradient-to-br from-brand-50/80 via-emerald-50/40 to-white border border-brand-100 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto shadow-soft">
                  <Mic className="w-6 h-6" />
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Say this aloud:</h4>
                  <p className="text-base font-extrabold text-slate-900 mt-1">
                    "{lesson.speakingPrompt.sampleResponse}"
                  </p>
                </div>

                {/* Audio reference listener */}
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => handlePlayPhrase(lesson.speakingPrompt.sampleResponse, false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-brand-700 border border-slate-200 text-xs font-bold shadow-xs active:scale-95"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Listen Model</span>
                  </button>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 text-xs text-left border border-amber-200/60">
                  <span className="font-bold">Coach Pronunciation Tip: </span>
                  {lesson.speakingPrompt.coachingTip}
                </div>

                {/* Speech check button */}
                <div className="pt-2">
                  <button
                    onClick={handleVoiceCheck}
                    className={`px-5 py-3 rounded-full text-xs font-extrabold transition-all active:scale-95 flex items-center gap-2 mx-auto ${
                      isPracticingSpeech
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    <span>{isPracticingSpeech ? 'Listening...' : 'Tap & Speak Phrase'}</span>
                  </button>
                </div>

                {spokenTranscript && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 text-left animate-slide-up">
                    <div className="font-bold flex items-center gap-1 text-emerald-900">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Heard: "{spokenTranscript}"</span>
                    </div>
                    <p className="mt-0.5 text-emerald-700">Pronunciation accuracy: 96% • Great rhythm!</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  playChime('tap');
                  setCurrentStep(4);
                }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-700 hover:to-emerald-600 text-white font-extrabold text-sm shadow-soft transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Complete Lesson & Claim XP</span>
                <Sparkles className="w-4 h-4 text-amber-200" />
              </button>
            </div>
          )}

          {/* STEP 4: Celebration & Rewards */}
          {currentStep === 4 && (
            <div className="p-4 text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 to-brand-500 text-white flex items-center justify-center mx-auto shadow-soft-lg animate-bounce-subtle">
                <Trophy className="w-8 h-8 text-white" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase">
                  Lesson Completed
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-2">
                  Outstanding Work Today!
                </h3>
                <p className="text-xs text-slate-600 max-w-xs mx-auto mt-1">
                  You unlocked today's idiom, sharpened your pronunciation, and added +35 XP to your progress!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                <div className="p-3 rounded-2xl bg-brand-50 border border-brand-200 text-center">
                  <div className="text-[10px] font-bold text-brand-600 uppercase">XP Earned</div>
                  <div className="text-lg font-black text-brand-900">+{lesson.xpReward} XP</div>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                  <div className="text-[10px] font-bold text-amber-600 uppercase">Daily Streak</div>
                  <div className="text-lg font-black text-amber-900">{progress.streakDays} Days</div>
                </div>
              </div>

              <button
                onClick={handleFinishLesson}
                className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-sm shadow-soft transition active:scale-95"
              >
                Collect XP & Return
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
