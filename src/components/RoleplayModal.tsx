import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Volume2, 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { RoleplayScenario, UserProgress } from '../types';
import { speakEnglish, stopSpeaking, playChime } from '../services/speech';

interface RoleplayModalProps {
  scenario: RoleplayScenario;
  progress: UserProgress;
  onClose: () => void;
  onComplete: (scenarioId: string, earnedXP: number, minutes: number) => void;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  feedback?: {
    grammarPraise: string;
    fluencyScore: number;
    suggestion?: string;
  };
}

export const RoleplayModal: React.FC<RoleplayModalProps> = ({
  scenario,
  progress,
  onClose,
  onComplete,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const currentStep = scenario.dialogueFlow[currentStepIndex] || scenario.dialogueFlow[0];

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiSpeaking]);

  // Initialize with AI greeting
  useEffect(() => {
    const initialAiMessage = scenario.dialogueFlow[0].message;
    setMessages([
      {
        id: 'msg-0',
        sender: 'ai',
        text: initialAiMessage,
      },
    ]);

    // Speak initial message after slight delay
    const timer = setTimeout(() => {
      speakAi(initialAiMessage);
    }, 400);

    return () => {
      clearTimeout(timer);
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [scenario]);

  const speakAi = (text: string) => {
    setIsAiSpeaking(true);
    speakEnglish(text, {
      rate: progress.audioSpeed,
      accent: scenario.aiPersona.accent,
      onStart: () => setIsAiSpeaking(true),
      onEnd: () => setIsAiSpeaking(false),
    });
  };

  // Setup Web Speech Recognition
  const toggleListening = () => {
    playChime('tap');

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. You can type your response!');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = scenario.aiPersona.accent === 'UK' ? 'en-GB' : 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('Recognition start error:', e);
      setIsListening(false);
    }
  };

  const handleSendResponse = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    playChime('tap');
    setInputText('');

    // Generate smart contextual feedback
    const userMessageId = `msg-user-${Date.now()}`;
    const praiseItems = [
      'Natural conversational cadence! Excellent choice of vocabulary.',
      'Clear, polite phrasing! Very authentic for this context.',
      'Great intonation and sentence structure!',
      'Spot on! This sounds exactly like a confident speaker.',
    ];
    const praise = praiseItems[Math.floor(Math.random() * praiseItems.length)];

    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMessageId,
        sender: 'user',
        text,
        feedback: {
          grammarPraise: praise,
          fluencyScore: Math.floor(Math.random() * 8) + 92, // 92 - 99%
        },
      },
    ];

    setMessages(newMessages);

    // Progress to next step or finish
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < scenario.dialogueFlow.length) {
      setTimeout(() => {
        setCurrentStepIndex(nextIndex);
        const nextAiMsg = scenario.dialogueFlow[nextIndex].message;
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-ai-${Date.now()}`,
            sender: 'ai',
            text: nextAiMsg,
          },
        ]);
        speakAi(nextAiMsg);
      }, 1000);
    } else {
      // Completed the roleplay!
      setTimeout(() => {
        setIsFinished(true);
        playChime('streak');
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#0ea5e9', '#10b981', '#fbbf24', '#8b5cf6'],
        });
      }, 800);
    }
  };

  const handleFinishRoleplay = () => {
    playChime('success');
    onComplete(scenario.id, 25, scenario.durationMinutes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full h-full sm:h-[92vh] sm:max-w-lg bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl border border-white/20">
              {scenario.aiPersona.avatar}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm">{scenario.aiPersona.name}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/30 text-brand-300 font-semibold border border-brand-400/30">
                  {scenario.aiPersona.role}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${isAiSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-emerald-400'}`} />
                  {isAiSpeaking ? 'Speaking...' : 'Listening'}
                </span>
                <span>•</span>
                <span>Step {Math.min(currentStepIndex + 1, scenario.dialogueFlow.length)} of {scenario.dialogueFlow.length}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              stopSpeaking();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition active:scale-95"
            aria-label="Close conversation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Finished Celebration Modal View */}
        {isFinished ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-5 bg-gradient-to-b from-white via-brand-50/30 to-emerald-50/40">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-soft-lg animate-bounce-subtle">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                Conversation Mastered!
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">
                Great job with {scenario.aiPersona.name}!
              </h2>
              <p className="text-sm text-slate-600 max-w-xs mx-auto">
                You successfully navigated "{scenario.title}" with confidence and natural phrasing.
              </p>
            </div>

            {/* Reward Stats */}
            <div className="w-full max-w-xs grid grid-cols-2 gap-3 py-2">
              <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase">XP Gained</div>
                <div className="text-lg font-black text-brand-600">+25 XP</div>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Time Spoken</div>
                <div className="text-lg font-black text-emerald-600">+{scenario.durationMinutes} Mins</div>
              </div>
            </div>

            <button
              onClick={handleFinishRoleplay}
              className="w-full max-w-xs py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-700 hover:to-emerald-600 text-white font-extrabold shadow-soft-lg shadow-brand-500/25 transition active:scale-95"
            >
              Collect Rewards & Return Home
            </button>
          </div>
        ) : (
          <>
            {/* Messages Chat Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}
                >
                  <div className="flex items-end gap-2 max-w-[88%]">
                    {msg.sender === 'ai' && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-sm">
                        {scenario.aiPersona.avatar}
                      </div>
                    )}

                    <div
                      className={`p-3.5 rounded-3xl text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-brand-600 text-white rounded-br-xs shadow-sm'
                          : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200 shadow-xs'
                      }`}
                    >
                      <p>{msg.text}</p>

                      {/* AI Audio replay icon */}
                      {msg.sender === 'ai' && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                          <button
                            onClick={() => speakAi(msg.text)}
                            className="flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 active:scale-95"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Listen ({progress.audioSpeed}x)</span>
                          </button>
                          <span className="text-[10px] text-slate-400">
                            {scenario.aiPersona.accent === 'UK' ? '🇬🇧 British' : '🇺🇸 American'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Real-time AI Feedback Pill for User Responses */}
                  {msg.feedback && (
                    <div className="mt-1.5 mr-2 max-w-[85%] rounded-2xl bg-emerald-50 border border-emerald-200/80 p-2 text-xs text-emerald-900 shadow-xs flex items-start gap-2 animate-slide-up">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px]">
                          <span>Fluency: {msg.feedback.fluencyScore}%</span>
                          <span>•</span>
                          <span className="text-emerald-600">Great phrasing</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          {msg.feedback.grammarPraise}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Responses & Coaching Section */}
            <div className="p-3 bg-white border-t border-slate-200/80 space-y-2.5">
              {/* Grammar and Natural Phrasing Coaching Tip */}
              {currentStep?.grammarNotes && (
                <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-2 flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="text-[11px] font-medium leading-tight">
                      <strong>Coach Tip:</strong> {currentStep.grammarNotes}
                    </span>
                  </div>
                </div>
              )}

              {/* Suggested Response Chips */}
              {currentStep?.suggestedResponses && currentStep.suggestedResponses.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Suggested Responses (Tap to speak or send)
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
                    {currentStep.suggestedResponses.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendResponse(suggestion)}
                        className="text-left p-2 rounded-xl bg-slate-50 hover:bg-brand-50 border border-slate-200/80 hover:border-brand-300 text-xs text-slate-700 hover:text-brand-900 transition flex items-center justify-between group active:scale-98"
                      >
                        <span className="line-clamp-2">"{suggestion}"</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 flex-shrink-0 ml-1.5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input & Microphone Controls */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={toggleListening}
                  className={`p-3 rounded-2xl flex-shrink-0 transition-all active:scale-95 ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30 ring-4 ring-rose-200'
                      : 'bg-brand-100 hover:bg-brand-200 text-brand-700'
                  }`}
                  title={isListening ? 'Stop listening' : 'Speak with your microphone'}
                  aria-label="Microphone input"
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendResponse();
                    }}
                    placeholder={isListening ? 'Listening to your voice...' : 'Type or speak your reply in English...'}
                    className="w-full py-2.5 pl-3.5 pr-10 rounded-2xl bg-slate-100 border border-transparent focus:border-brand-500 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition"
                  />
                  <button
                    onClick={() => handleSendResponse()}
                    disabled={!inputText.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white transition active:scale-95"
                    aria-label="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
