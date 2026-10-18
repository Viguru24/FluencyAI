import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  Volume2,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Pencil,
  Check,
  HelpCircle,
  Brain,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { CEFRLevel, PlacementAssessmentResult } from '../types';
import { speakEnglish, stopSpeaking, playChime } from '../services/speech';
import {
  startRecognition,
  isRecognitionSupported,
  type RecognitionHandle,
} from '../services/speechRecognition';
import { AudioVisualizerController } from '../services/audioVisualizer';
import { AudioRecorderController, type RecordedAudioClip } from '../services/audioRecorder';
import { WaveformVisualizer } from './lesson/WaveformVisualizer';
import { evaluatePlacementAssessment, transcribeAudioWithAI } from '../services/geminiService';

interface PlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompletePlacement: (assessedLevel: CEFRLevel, details: PlacementAssessmentResult) => void;
  onSkipPlacement?: () => void;
  audioSpeed?: number;
  initialLevel?: CEFRLevel;
}

interface QuestionStep {
  title: string;
  badge: string;
  escalation: string;
  question: string;
  hint: string;
  sampleStarter: string;
}

const QUESTIONS: QuestionStep[] = [
  {
    title: 'Part 1 of 3: Everyday Life & Foundations',
    badge: 'A1 - A2 Baseline',
    escalation: 'Everyday Vocabulary',
    question:
      'To start off, could you tell me a little bit about yourself, what you like doing in your free time, or where you’re from?',
    hint: 'Share your background, daily routines, or favorite hobbies in 1-3 natural sentences.',
    sampleStarter: 'e.g. "I’m from Madrid and I work in software. In my free time, I really enjoy playing football and..."',
  },
  {
    title: 'Part 2 of 3: Past Experience & Resolution',
    badge: 'B1 - B2 Competence',
    escalation: 'Narrative Past Tense',
    question:
      'Brilliant! Now, tell me about an interesting challenge or project you worked on recently — what was the situation and how did you resolve it?',
    hint: 'Describe what happened, the concrete steps you took, and what the final outcome was.',
    sampleStarter: 'e.g. "Recently, our team faced a tight deadline. I decided to organise daily syncs and..."',
  },
  {
    title: 'Part 3 of 3: Perspective & Nuance',
    badge: 'B2 - C1 Complexity',
    escalation: 'Abstract Reasoning & Idioms',
    question:
      'Great answer. Lastly, what are your thoughts on how artificial intelligence and technology are shaping the way people work and communicate today?',
    hint: 'Share your perspective using reasons, comparisons, or conditional thoughts ("Although...", "In my opinion...", "If...").',
    sampleStarter: 'e.g. "I believe AI will streamline repetitive tasks, although we must be cautious about..."',
  },
];

const CEFR_DESCRIPTIONS: Record<CEFRLevel, { label: string; color: string; desc: string }> = {
  A1: {
    label: 'Beginner (A1)',
    color: 'from-amber-400 to-orange-500 text-amber-950',
    desc: 'Focus on everyday essentials, simple greetings, and basic daily phrases with slow, clear pacing.',
  },
  A2: {
    label: 'Elementary (A2)',
    color: 'from-amber-400 to-amber-600 text-amber-950',
    desc: 'Build sentences comfortably for routine social exchanges, travel, and straightforward workplace chats.',
  },
  B1: {
    label: 'Intermediate (B1)',
    color: 'from-blue-500 to-indigo-600 text-white',
    desc: 'Communicate naturally in British offices, express past events smoothly, and grasp standard workplace idioms.',
  },
  B2: {
    label: 'Upper Intermediate (B2)',
    color: 'from-brand-500 to-purple-600 text-white',
    desc: 'Engage fluently in nuanced debates, handle customer de-escalations, and master natural phrasal verbs.',
  },
  C1: {
    label: 'Advanced (C1)',
    color: 'from-emerald-500 to-teal-600 text-white',
    desc: 'Converse with subtle British understatement, authentic executive presence, and industry-specific precision.',
  },
};

export const PlacementModal: React.FC<PlacementModalProps> = ({
  isOpen,
  onClose,
  onCompletePlacement,
  onSkipPlacement,
  audioSpeed = 0.9,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [activeInputText, setActiveInputText] = useState<string>('');
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isEditingText, setIsEditingText] = useState<boolean>(false);
  const [inputMode, setInputMode] = useState<'voice' | 'type'>('voice');
  const [bands, setBands] = useState<number[]>([]);
  const [result, setResult] = useState<PlacementAssessmentResult | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);

  const vizRef = useRef(new AudioVisualizerController());
  const recorderRef = useRef(new AudioRecorderController());
  const recRef = useRef<RecognitionHandle | null>(null);
  const liveTranscriptRef = useRef<string>('');

  const cleanupAudio = () => {
    stopSpeaking();
    setIsAiSpeaking(false);
    try {
      recRef.current?.stop().catch(() => {});
    } catch {
      /* ignore */
    }
    recRef.current = null;
    try {
      recorderRef.current.stop().catch(() => {});
    } catch {
      /* ignore */
    }
    vizRef.current.stopMicrophone();
    setIsRecording(false);
    setIsTranscribing(false);
    setBands([]);
  };

  // Play question audio on step change
  useEffect(() => {
    if (!isOpen || currentStep >= QUESTIONS.length || result) return;

    // Speak James's question
    const q = QUESTIONS[currentStep].question;
    speakEnglish(q, {
      rate: audioSpeed,
      onStart: () => setIsAiSpeaking(true),
      onEnd: () => setIsAiSpeaking(false),
    });

    return () => {
      stopSpeaking();
      setIsAiSpeaking(false);
    };
  }, [currentStep, isOpen, result, audioSpeed]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  if (!isOpen) return null;

  const currentQ = QUESTIONS[Math.min(currentStep, QUESTIONS.length - 1)];

  const handleSpeakQuestion = () => {
    playChime('tap');
    stopSpeaking();
    setIsAiSpeaking(true);
    speakEnglish(currentQ.question, {
      rate: audioSpeed,
      onEnd: () => setIsAiSpeaking(false),
    });
  };

  const handleToggleRecord = async () => {
    setMicError(null);

    // If currently recording, STOP recording and finalize speech transcript
    if (isRecording) {
      playChime('tap');
      setIsRecording(false);
      vizRef.current.stopMicrophone();
      setBands([]);

      let audioClip: RecordedAudioClip | null = null;
      try {
        audioClip = await recorderRef.current.stop();
      } catch (err) {
        console.warn('[PlacementModal] AudioRecorder stop error:', err);
      }

      let webSpeechTranscript = '';
      if (recRef.current) {
        try {
          const recText = await recRef.current.stop();
          if (recText) webSpeechTranscript = recText.trim();
        } catch (err) {
          console.warn('[PlacementModal] SpeechRecognition stop error:', err);
        }
        recRef.current = null;
      }

      let finalSpoken = liveTranscriptRef.current.trim() || webSpeechTranscript;

      // If Web Speech API was empty (e.g. Firefox, Android exclusivity, or network pause),
      // transcribe the captured audio using Gemini Multimodal AI!
      if (!finalSpoken && audioClip?.base64) {
        setIsTranscribing(true);
        try {
          const aiText = await transcribeAudioWithAI({
            base64: audioClip.base64,
            mimeType: audioClip.mimeType,
            blob: audioClip.blob,
          });
          if (aiText && aiText.trim()) {
            finalSpoken = aiText.trim();
          }
        } catch (err) {
          console.warn('[PlacementModal] AI transcription error:', err);
        } finally {
          setIsTranscribing(false);
        }
      }

      if (finalSpoken) {
        setActiveInputText((prev) => {
          const existing = prev.trim();
          if (!existing) return finalSpoken;
          if (existing.toLowerCase().includes(finalSpoken.toLowerCase())) return existing;
          return `${existing} ${finalSpoken}`;
        });
      }

      liveTranscriptRef.current = '';
      return;
    }

    // START recording
    stopSpeaking();
    setIsAiSpeaking(false);
    playChime('tap');
    setIsRecording(true);
    liveTranscriptRef.current = '';

    // 1. Start browser Web Speech API IMMEDIATELY at tick 0 for zero speech latency
    if (isRecognitionSupported()) {
      try {
        recRef.current = startRecognition({
          lang: 'en-GB',
          silenceTimeoutMs: 15000,
          onInterim: (text: string) => {
            liveTranscriptRef.current = text;
            if (text.trim()) {
              setActiveInputText(text.trim());
            }
          },
          onStatusChange: (status: 'listening' | 'heard' | 'error' | 'stopped') => {
            if (status === 'error') {
              console.warn('[PlacementModal] Web Speech API status: error (AudioRecorder will use AI fallback if needed)');
            }
          },
        });
      } catch (e) {
        console.warn('[PlacementModal] Could not start speech recognition:', e);
      }
    }

    // 2. Request microphone and start audio visualizer
    const ok = await vizRef.current.startMicrophone((newBands: number[]) => setBands(newBands));
    if (!ok) {
      recRef.current?.stop();
      recRef.current = null;
      setIsRecording(false);
      setMicError('Microphone access was blocked or is unavailable. Please allow microphone permissions in your browser or switch to Type mode.');
      return;
    }

    // 3. Start audio recording via MediaRecorder for guaranteed AI fallback
    const stream = vizRef.current.getStream();
    await recorderRef.current.start(stream);
  };

  const handleNextStep = async () => {
    const trimmed = activeInputText.trim();
    if (!trimmed) return;

    playChime('tap');
    cleanupAudio();

    const updatedAnswers = [...answers];
    updatedAnswers[currentStep] = trimmed;
    setAnswers(updatedAnswers);

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setActiveInputText(answers[currentStep + 1] || '');
      setIsEditingText(false);
      setMicError(null);
    } else {
      // All 3 questions answered! Begin evaluation
      setIsAnalyzing(true);
      try {
        const assessment = await evaluatePlacementAssessment(updatedAnswers);
        setResult(assessment);
        setIsAnalyzing(false);

        // Fire celebration confetti
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {
          /* confetti optional */
        }
        playChime('success');
      } catch (err) {
        console.warn('Placement assessment failed:', err);
        setIsAnalyzing(false);
      }
    }
  };

  const handleConfirmLevel = () => {
    if (!result) return;
    playChime('success');
    onCompletePlacement(result.level, result);
    onClose();
  };

  const handleRetake = () => {
    playChime('tap');
    setAnswers(['', '', '']);
    setActiveInputText('');
    setCurrentStep(0);
    setResult(null);
    setIsAnalyzing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[92dvh] sm:max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl pb-safe bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col transition-all">
        {/* Header with British Coach branding */}
        <div className="sticky top-0 z-10 px-4 sm:px-5 py-4 bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner shrink-0">
              🧑‍💼
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  CEFR Spoken Placement Check
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-brand-500/30 border border-brand-400/40 text-brand-300 text-[10px] font-bold uppercase tracking-wider">
                  James • UK Coach
                </span>
              </div>
              <p className="text-xs text-brand-100/80 truncate">
                Quick 3-question evaluation to calibrate James’s vocabulary & pace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                cleanupAudio();
                onClose();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95"
              aria-label="Back to home"
              title="Back to home page"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Home</span>
            </button>
            <button
              onClick={() => {
                cleanupAudio();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar (if not on results view) */}
        {!result && !isAnalyzing && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 flex shrink-0">
            {[0, 1, 2].map((stepIdx) => (
              <div
                key={stepIdx}
                className={`h-full flex-1 transition-all duration-300 ${
                  currentStep >= stepIdx ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        )}

        {/* Main Body */}
        <div className="p-4 sm:p-6 md:p-8 space-y-5">
          {/* STATE 1: Question in Progress */}
          {!result && !isAnalyzing && (
            <div className="space-y-4">
              {/* Question card */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black tracking-wider uppercase text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-full border border-brand-100 dark:border-brand-800">
                    {currentQ.title}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {currentQ.badge}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                    "{currentQ.question}"
                  </p>
                  <button
                    onClick={handleSpeakQuestion}
                    className={`p-2 rounded-xl border flex-shrink-0 transition active:scale-95 ${
                      isAiSpeaking
                        ? 'bg-brand-600 border-brand-600 text-white animate-pulse'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400'
                    }`}
                    title="Listen to James speak this question"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                  <HelpCircle className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                  <span>{currentQ.hint}</span>
                </div>
              </div>

              {/* Input section: Voice Visualizer or Typing fallback */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>Your Spoken Answer</span>
                    {activeInputText.trim().length > 0 && (
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        ({activeInputText.trim().split(/\s+/).length} words)
                      </span>
                    )}
                  </label>

                  {/* Mode switcher: Voice vs Type */}
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      onClick={() => {
                        playChime('tap');
                        setInputMode('voice');
                      }}
                      className={`px-2 py-0.5 rounded-md font-semibold transition ${
                        inputMode === 'voice'
                          ? 'bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      🎙️ Speak
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button
                      onClick={() => {
                        playChime('tap');
                        setInputMode('type');
                      }}
                      className={`px-2 py-0.5 rounded-md font-semibold transition ${
                        inputMode === 'type'
                          ? 'bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      ⌨️ Type
                    </button>
                  </div>
                </div>

                {/* Microphone permission or hardware error notice */}
                {micError && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5 animate-fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                    <div className="flex-1 space-y-1.5">
                      <p className="leading-relaxed">{micError}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setInputMode('type');
                          setMicError(null);
                        }}
                        className="font-bold underline hover:no-underline text-amber-800 dark:text-amber-200 inline-flex items-center gap-1"
                      >
                        Switch to Type mode &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {inputMode === 'voice' ? (
                  <div className="space-y-3">
                    {/* Visualizer & Mic Area */}
                    <div className="relative rounded-2xl bg-slate-900 text-white p-5 flex flex-col items-center justify-center space-y-3 overflow-hidden shadow-inner">
                      <div className="absolute inset-0 bg-radial from-brand-900/40 via-transparent to-transparent pointer-events-none" />

                      {isTranscribing ? (
                        <div className="w-full space-y-2 py-2 flex flex-col items-center justify-center">
                          <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                          <p className="text-xs text-brand-200 font-semibold">
                            Transcribing your speech with AI...
                          </p>
                        </div>
                      ) : isRecording ? (
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-center gap-2 text-rose-400 text-xs font-bold animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            Listening... Speak clearly in English (tap mic when done)
                          </div>
                          <WaveformVisualizer mode="user" bands={bands} />
                        </div>
                      ) : (
                        <div className="text-center space-y-1">
                          <p className="text-xs text-slate-300">
                            Tap the microphone and answer naturally. Don’t worry about perfection!
                          </p>
                        </div>
                      )}

                      {/* Giant Mic Button */}
                      <button
                        type="button"
                        onClick={handleToggleRecord}
                        disabled={isTranscribing}
                        aria-label={isRecording ? 'Finish recording answer' : 'Start speaking answer'}
                        title={isRecording ? 'Tap to finish recording' : 'Tap to start recording'}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          isRecording
                            ? 'bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-400/40 animate-pulse'
                            : 'bg-gradient-to-tr from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-brand-500/30'
                        }`}
                      >
                        {isTranscribing ? (
                          <Loader2 className="w-7 h-7 animate-spin text-white" />
                        ) : (
                          <Mic className={`w-7 h-7 ${isRecording ? 'scale-110 text-white' : 'text-white'}`} />
                        )}
                      </button>
                    </div>

                    {/* Spoken Text Preview / Editable Box */}
                    <div className="relative p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 text-sm">
                      {activeInputText ? (
                        <div className="space-y-2">
                          {isEditingText ? (
                            <textarea
                              value={activeInputText}
                              onChange={(e) => setActiveInputText(e.target.value)}
                              rows={3}
                              className="w-full p-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                              placeholder="Edit your speech transcript..."
                            />
                          ) : (
                            <p className="text-slate-800 dark:text-slate-100 leading-relaxed italic">
                              "{activeInputText}"
                            </p>
                          )}
                          <div className="flex items-center justify-between pt-1">
                            <button
                              onClick={() => setIsEditingText(!isEditingText)}
                              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1"
                            >
                              {isEditingText ? (
                                <>
                                  <Check className="w-3.5 h-3.5" /> Done Editing
                                </>
                              ) : (
                                <>
                                  <Pencil className="w-3.5 h-3.5" /> Edit Transcript
                                </>
                              )}
                            </button>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Captured
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                          Your live transcript will appear here as you speak.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Type Mode */
                  <div className="space-y-2">
                    <textarea
                      value={activeInputText}
                      onChange={(e) => setActiveInputText(e.target.value)}
                      rows={4}
                      className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
                      placeholder={currentQ.sampleStarter}
                    />
                    <p className="text-[11px] text-slate-400">
                      Feel free to type in English. We evaluate grammar, vocabulary breadth, and sentence connectors.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2.5">
                {currentStep > 0 ? (
                  <button
                    onClick={() => {
                      playChime('tap');
                      setCurrentStep((p) => p - 1);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Back
                  </button>
                ) : onSkipPlacement ? (
                  <button
                    onClick={() => {
                      playChime('tap');
                      cleanupAudio();
                      onSkipPlacement();
                      onClose();
                    }}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Skip Placement
                  </button>
                ) : null}

                <button
                  onClick={handleNextStep}
                  disabled={!activeInputText.trim() || activeInputText.trim().split(/\s+/).length < 2}
                  className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-md transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span>
                    {currentStep === QUESTIONS.length - 1
                      ? 'Finish & Evaluate CEFR Level'
                      : 'Next Question'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: Analyzing answers */}
          {isAnalyzing && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-brand-50 flex items-center justify-center border border-brand-200 shadow-soft">
                  <Brain className="w-10 h-10 text-brand-600 animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
              </div>

              <div className="space-y-1 max-w-sm">
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  Assessing Spoken English & Grammar
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Evaluating sentence complexity, vocabulary breadth, past tense narrative flow, and CEFR oral benchmarks...
                </p>
              </div>
            </div>
          )}

          {/* STATE 3: Assessment Result Display */}
          {result && (
            <div className="space-y-5">
              {/* Level Badge Banner */}
              <div
                className={`relative overflow-hidden p-5 rounded-3xl bg-gradient-to-br ${
                  CEFR_DESCRIPTIONS[result.level]?.color || 'from-brand-500 to-indigo-600 text-white'
                } shadow-soft`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-black uppercase tracking-wider opacity-90">
                      Assessed CEFR Placement Level
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      Level {result.level}
                    </h2>
                    <p className="text-xs font-semibold opacity-95">
                      {result.title}
                    </p>
                  </div>
                  <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner flex-shrink-0">
                    🏆
                  </div>
                </div>

                <p className="text-xs mt-3.5 pt-3 border-t border-white/20 leading-relaxed opacity-95">
                  {CEFR_DESCRIPTIONS[result.level]?.desc}
                </p>
              </div>

              {/* Fluency & Grammar Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Spoken Fluency</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white">{result.fluencyScore}%</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Conversational pacing & coherence</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Grammar & Syntax</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white">{result.grammarScore}%</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Connectors & sentence structure</p>
                </div>
              </div>

              {/* Coach Summary */}
              <div className="p-4 rounded-2xl bg-brand-50/70 dark:bg-brand-950/60 border border-brand-200/70 dark:border-brand-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-900 dark:text-brand-200">
                  <span>🧑‍💼 James’s Assessment</span>
                </div>
                <p className="text-xs text-brand-950 dark:text-brand-100 leading-relaxed font-medium">
                  "{result.summary}"
                </p>
              </div>

              {/* Strengths & Next Steps */}
              <div className="space-y-2 text-xs">
                {result.strengths.length > 0 && (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Key Strengths
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-emerald-900 dark:text-emerald-200 text-[11px]">
                      {result.strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.recommendations.length > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 text-amber-950 dark:text-amber-100 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Coaching Recommendations
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-900 dark:text-amber-200 text-[11px]">
                      {result.recommendations.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Confirmation Note */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>
                  Your level is saved locally and synced to your VPS user profile so James will calibrate all dialogue complexity automatically.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={handleRetake}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retake
                </button>

                <button
                  onClick={handleConfirmLevel}
                  className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-md transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>Apply Level & Continue</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
