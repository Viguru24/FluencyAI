import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Eye, EyeOff, LifeBuoy, Volume2, Flag, Loader2, Pencil, Check } from 'lucide-react';
import type { LessonPlan, NativeLanguage, PhrasingUpgrade, PronunciationCoachingPoint } from '../../types';
import { speakEnglish, stopSpeaking, playChime } from '../../services/speech';
import {
  startRecognition,
  isRecognitionSupported,
  type RecognitionHandle,
  type SpokenSegmentAnalysis,
} from '../../services/speechRecognition';
import { AudioRecorderController, type RecordedAudioClip } from '../../services/audioRecorder';
import { AudioVisualizerController } from '../../services/audioVisualizer';
import { WaveformVisualizer } from './WaveformVisualizer';
import { HowDoISaySheet } from './HowDoISaySheet';
import {
  generateJamesReply,
  generateGeminiScorecard,
  type AudioAttachment,
} from '../../services/geminiService';

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
  pronunciationScore?: number;
  listeningScore?: number;
  dynamicUpgrades?: PhrasingUpgrade[];
  phrasesToReview?: string[];
  pronunciationCoachingPoints?: PronunciationCoachingPoint[];
  acousticFeedback?: string;
}

interface Props {
  plan: LessonPlan;
  nativeLanguage: NativeLanguage;
  audioSpeed: number;
  phraseScores?: number[];
  onMicDenied: () => void;
  onEnd: (stats: RoleplayStats) => void;
}

const HOLD_THRESHOLD_MS = 350;

export const RoleplayStage: React.FC<Props> = ({
  plan,
  nativeLanguage,
  audioSpeed,
  phraseScores = [],
  onMicDenied,
  onEnd,
}) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [aiIndex, setAiIndex] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzingScorecard, setIsAnalyzingScorecard] = useState(false);
  const [livePreview, setLivePreview] = useState('');
  const [isEditingBubble, setIsEditingBubble] = useState(false);
  const [bubbleEditValue, setBubbleEditValue] = useState('');
  const [bands, setBands] = useState<number[]>([]);
  const [revealAll, setRevealAll] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [revealsUsed, setRevealsUsed] = useState(0);
  const [helpRequests, setHelpRequests] = useState(0);

  const vizRef = useRef(new AudioVisualizerController());
  const recorderRef = useRef(new AudioRecorderController());
  const recRef = useRef<RecognitionHandle | null>(null);
  const recordedClipsRef = useRef<AudioAttachment[]>([]);
  const pronunciationMetadataRef = useRef<SpokenSegmentAnalysis[]>([]);
  const pressStart = useRef(0);
  const userTurnCount = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEditingBubbleRef = useRef(false);
  isEditingBubbleRef.current = isEditingBubble;

  const userTurnsCount = turns.filter((t) => t.speaker === 'user').length;
  const currentTurn = userTurnsCount + 1;


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
    const recorder = recorderRef.current;
    return () => {
      window.clearTimeout(t);
      stopSpeaking();
      viz.stopMicrophone();
      recorder.stop();
      recRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, livePreview]);

  // Forward ref for stopRecording so the 6s silence timeout callback can invoke it cleanly
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});

  const startRecording = async () => {
    if (isRecording || isProcessing) return;
    stopSpeaking();
    setIsAiSpeaking(false);

    const ok = await vizRef.current.startMicrophone(setBands);
    if (!ok) {
      onMicDenied();
      return;
    }

    // Simultaneously start MediaRecorder using the active microphone stream
    const activeStream = vizRef.current.getStream();
    await recorderRef.current.start(activeStream);

    playChime('tap');
    setIsRecording(true);
    setLivePreview('');
    setIsEditingBubble(false);
    setBubbleEditValue('');

    // Pause-Tolerant Speaking Mode:
    // Continuous = true, interimResults = true, maxAlternatives = 3
    // 6-second silence timeout before auto-send
    recRef.current = isRecognitionSupported()
      ? startRecognition({
          lang: plan.persona.accent === 'UK' ? 'en-GB' : 'en-US',
          silenceTimeoutMs: 6000,
          onInterim: (text) => {
            if (!isEditingBubbleRef.current) {
              setLivePreview(text);
            }
          },
          onSilenceTimeout: () => {
            // Auto-send turn after 6 full seconds of learner silence
            stopRecordingRef.current();
          },
        })
      : null;
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsProcessing(true);
    setIsEditingBubble(false);

    // Stop MediaRecorder and capture audio clip for Gemini 2.5 Flash
    let audioClip: RecordedAudioClip | null = null;
    try {
      audioClip = await recorderRef.current.stop();
    } catch (e) {
      console.warn('[RoleplayStage] Failed to stop audio recorder:', e);
    }

    // Stop audio visualizer
    vizRef.current.stopMicrophone();

    let heard: string | null = null;
    if (recRef.current) {
      const details = await recRef.current.stopWithDetails();
      recRef.current = null;
      if (details) {
        heard = details.transcript;
        // Accumulate segments with lower confidence (< 0.80) or phonetic ambiguity
        const flaggedSegments = details.segments.filter(
          (s) => s.isLowConfidence || (s.confidence > 0 && s.confidence < 0.8) || s.alternatives.length > 0
        );
        if (flaggedSegments.length > 0) {
          pronunciationMetadataRef.current.push(...flaggedSegments);
        }
      }
    }

    // If learner manually edited text via the pencil icon, prioritize their edit
    const finalTranscript = bubbleEditValue.trim() || livePreview.trim() || heard?.trim() || '';
    setLivePreview('');
    setBubbleEditValue('');

    // Store audio attachment for multimodal Gemini analysis
    let audioAttachment: AudioAttachment | null = null;
    if (audioClip && audioClip.base64) {
      audioAttachment = {
        base64: audioClip.base64,
        mimeType: audioClip.mimeType,
      };
      recordedClipsRef.current.push(audioAttachment);
    }

    const idx = userTurnCount.current++;
    const fallback = plan.mockUserReplies[idx % plan.mockUserReplies.length];
    const userSpokeReal = Boolean(finalTranscript.length > 0);
    const text = userSpokeReal ? finalTranscript : fallback;

    const newTurns: Turn[] = [
      ...turns,
      { id: `u-${idx}`, speaker: 'user', text, revealed: true, isMock: !userSpokeReal },
    ];
    setTurns(newTurns);

    try {
      const historyForGemini = newTurns.map((t) => ({ speaker: t.speaker, text: t.text }));

      // Dynamic conversational turn without hard turn cutoffs:
      // James listens, riffs, and asks relevant follow-up questions for as many turns as the user wants
      const aiReply = await generateJamesReply(
        historyForGemini,
        plan.title,
        plan.aiTurns,
        plan.persona,
        audioAttachment
      );

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

  stopRecordingRef.current = stopRecording;


  // Push-to-talk and Tap-to-speak handler
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
    recorderRef.current.stop();
    recRef.current?.stop();

    const userTurnsList = turns.filter((t) => t.speaker === 'user').map((t) => t.text);
    setIsAnalyzingScorecard(true);

    try {
      // Send multimodal audio recordings & low-confidence phonetic metadata to Gemini 2.5 Flash / FreeLLMAPI
      const scorecard = await generateGeminiScorecard({
        plan,
        userTurns: userTurnsList,
        phraseScores,
        defaultUpgrades: plan.upgrades,
        audioClips: recordedClipsRef.current,
        pronunciationMetadata: pronunciationMetadataRef.current,
      });

      onEnd({
        userTurns: userTurnsList,
        revealsUsed,
        helpRequests,
        aiTurnsHeard: turns.filter((t) => t.speaker === 'ai').length,
        fluencyScore: scorecard?.fluency,
        pronunciationScore: scorecard?.pronunciation,
        listeningScore: scorecard?.listening,
        dynamicUpgrades: scorecard?.upgrades,
        pronunciationCoachingPoints: scorecard?.pronunciationCoachingPoints,
        acousticFeedback: scorecard?.acousticFeedback,
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
    ? 'Speaking… take your time to think · tap when finished'
    : isProcessing
    ? `${plan.persona.name} is listening & thinking…`
    : isAiSpeaking
    ? `${plan.persona.name} is speaking — listen carefully`
    : userTurnsCount >= 3
    ? 'Keep chatting freely, or click "Finish & Get Scorecard"'
    : 'Your turn — tap the mic to speak';

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-b from-slate-50 to-white">
      {/* Stage tag with Turn Count badge + reveal toggle */}
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold border border-brand-200">
          Stage 2 · Turn {currentTurn} · Open Conversation
        </span>

        <button
          onClick={() => {
            playChime('tap');
            setRevealAll((r) => !r);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
            revealAll
              ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 shadow-xs hover:bg-slate-50'
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
        <p className="text-sm font-semibold text-slate-600 mb-2 px-6 text-center" aria-live="polite">
          {statusText}
        </p>
      </div>

      {/* Live transcript with min-h-[140px], pt-4, and scrollbar-none to prevent top blur clipping */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-[140px] overflow-y-auto px-4 pt-4 pb-12 space-y-2.5 scrollbar-none no-scrollbar"
      >
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
                    <span className={`block py-0.5 transition-all duration-300 ${hidden ? 'blur-[5px] select-none' : ''}`}>
                      {t.text}
                    </span>
                    {hidden && (
                      <span className="block mt-1 text-[11px] font-bold text-brand-600">
                        Listen first · tap to reveal
                      </span>
                    )}
                  </button>
                ) : (
                  <>
                    <span>{t.text}</span>
                    {t.isMock && (
                      <span className="block mt-1 text-[10px] text-brand-100">
                        Demo transcript (speech-to-text unavailable)
                      </span>
                    )}
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
      </div>

      {/* Controls Container with Pause-Tolerant Live Preview Bubble */}
      <div className="relative px-4 pb-5 pt-3 border-t border-slate-200 bg-white/95 backdrop-blur">
        {/* Live Preview Bubble Floating Above the Mic Button */}
        {isRecording && (
          <div className="absolute -top-28 left-4 right-4 z-20 animate-slide-up">
            <div className="relative bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-brand-200/90 shadow-xl text-slate-800">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-700">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Pause-Tolerant Speaking</span>
                  <span className="text-slate-400 font-normal">· Take time to think</span>
                </div>
                <button
                  onClick={() => {
                    if (isEditingBubble) {
                      setIsEditingBubble(false);
                      recRef.current?.pauseSilenceTimer(false);
                    } else {
                      setBubbleEditValue(livePreview || '');
                      setIsEditingBubble(true);
                      recRef.current?.pauseSilenceTimer(true);
                    }
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition flex items-center gap-1 text-[11px] font-medium"
                  title="Edit word or accent correction"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{isEditingBubble ? 'Cancel' : 'Edit word'}</span>
                </button>
              </div>

              {isEditingBubble ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bubbleEditValue}
                    onChange={(e) => setBubbleEditValue(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-xs rounded-xl border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900"
                    placeholder="Correct misheard word..."
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setLivePreview(bubbleEditValue);
                      setIsEditingBubble(false);
                      recRef.current?.pauseSilenceTimer(false);
                    }}
                    className="px-2.5 py-1 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-brand-700 active:scale-95 transition flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Apply
                  </button>
                </div>
              ) : (
                <p className="text-xs font-medium text-slate-800 italic leading-relaxed min-h-[24px] flex items-center">
                  {livePreview ? `“${livePreview}”` : 'Speak naturally — pauses will not cut you off…'}
                </p>
              )}

              {/* Downward pointer to mic */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 border-r border-b border-brand-200/90" />
            </div>
          </div>
        )}

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

          {/* Big Push-to-Talk / Tap-to-Finish Mic Button */}
          <div className="flex flex-col items-center">
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
              disabled={isProcessing || isAnalyzingScorecard}
              className={`relative w-24 h-24 rounded-full flex flex-col items-center justify-center text-white shadow-fab transition-all active:scale-95 touch-none select-none disabled:opacity-40 ${
                isRecording ? 'bg-rose-500 scale-105 ring-4 ring-rose-200' : 'bg-gradient-to-br from-brand-600 to-emerald-500'
              }`}
              aria-label={isRecording ? 'Tap to finish and send' : 'Tap or hold to speak'}
            >
              {isRecording && <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-30" />}
              {isProcessing ? (
                <Loader2 className="w-9 h-9 animate-spin" />
              ) : isRecording ? (
                <>
                  <Square className="w-7 h-7 fill-white mb-0.5" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-rose-100">Send</span>
                </>
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </button>
            {isRecording && (
              <span className="text-[10px] font-bold text-rose-600 mt-1.5 animate-pulse">
                Tap to Finish &amp; Send
              </span>
            )}
          </div>

          <button
            onClick={endRoleplay}
            disabled={isAnalyzingScorecard || isProcessing || userTurnsCount === 0}
            className="flex flex-col items-center gap-1 w-24 text-slate-700 disabled:opacity-40 transition-all"
          >
            <span
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                userTurnsCount >= 3
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-soft shadow-emerald-500/20 animate-pulse-subtle'
                  : userTurnsCount >= 1
                  ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Flag className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-extrabold text-center leading-tight">
              {userTurnsCount >= 1 ? 'Finish & Get Scorecard' : 'Speak first'}
            </span>
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

      {/* Scorecard Grading Overlay with Multimodal Gemini AI */}
      {isAnalyzingScorecard && (
        <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mb-4 shadow-soft">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Grading Your Spoken Roleplay</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            James &amp; Gemini AI are listening to your recorded audio to evaluate British phrasing, intonation, syllable stress, and natural office vocabulary…
          </p>
        </div>
      )}
    </div>
  );
};
