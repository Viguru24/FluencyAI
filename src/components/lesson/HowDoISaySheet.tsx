import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, LifeBuoy, Volume2, Search, Mic, Square, Loader2, Globe, Sparkles } from 'lucide-react';
import type { HelpPhrase, NativeLanguage } from '../../types';
import { speakEnglish, stopSpeaking, playChime } from '../../services/speech';
import {
  NATIVE_LANG_TO_BCP47,
  startRecognition,
  isRecognitionSupported,
  type RecognitionHandle,
} from '../../services/speechRecognition';
import { translateHowDoISay } from '../../services/geminiService';

interface Props {
  phrases: HelpPhrase[];
  nativeLanguage: NativeLanguage;
  accent: 'UK' | 'US';
  audioSpeed: number;
  scenarioTitle?: string;
  onClose: () => void;
  onUsed: () => void;
}

const SUPPORTED_LANGUAGES: NativeLanguage[] = [
  'German',
  'Spanish',
  'French',
  'Portuguese',
  'Mandarin',
  'Japanese',
  'Arabic',
  'Vietnamese',
];

const placeholders: Record<NativeLanguage, string> = {
  Spanish: 'Ej: ¿Puede repetir más despacio?',
  French: 'Ex : Pouvez-vous répéter ?',
  Mandarin: '例如：请再说一遍',
  Japanese: '例：もう一度言ってください',
  Portuguese: 'Ex: Pode repetir mais devagar?',
  Arabic: 'مثال: هل يمكنك التكرار ببطء؟',
  German: 'z. B. Können Sie das wiederholen?',
  Vietnamese: 'VD: Bạn có thể nói chậm hơn không?',
};

export const HowDoISaySheet: React.FC<Props> = ({
  phrases,
  nativeLanguage,
  accent,
  audioSpeed,
  scenarioTitle,
  onClose,
  onUsed,
}) => {
  const [selectedLang, setSelectedLang] = useState<NativeLanguage>(nativeLanguage);
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState(false);
  const [isListeningNative, setIsListeningNative] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<HelpPhrase[]>([]);
  const recRef = useRef<RecognitionHandle | null>(null);
  const queryRef = useRef('');

  // Immediately pause any active English speech synthesis on mount
  useEffect(() => {
    stopSpeaking();
    return () => {
      if (recRef.current) {
        recRef.current.stop().catch(() => {});
        recRef.current = null;
      }
    };
  }, []);

  const bcp47Locale = NATIVE_LANG_TO_BCP47[selectedLang] || 'en-GB';

  const triggerTranslationLookup = async (textToLookup: string) => {
    const clean = textToLookup.trim();
    if (!clean) return;
    setAsked(true);
    setIsTranslating(true);
    try {
      const generated = await translateHowDoISay(clean, selectedLang, scenarioTitle);
      setAiSuggestions(generated);
      playChime('success');
    } catch {
      setAiSuggestions([]);
    } finally {
      setIsTranslating(false);
    }
  };

  const stopNativeMicAndTranslate = async () => {
    if (!recRef.current) {
      setIsListeningNative(false);
      return;
    }
    const handle = recRef.current;
    recRef.current = null;
    setIsListeningNative(false);
    playChime('micStop');
    const finalTranscript = await handle.stop();
    const text = (finalTranscript || queryRef.current || query).trim();
    if (text) {
      setQuery(text);
      queryRef.current = text;
      await triggerTranslationLookup(text);
    }
  };

  const handleToggleNativeMic = async () => {
    if (isListeningNative) {
      await stopNativeMicAndTranslate();
      return;
    }

    stopSpeaking();
    playChime('micStart');
    setIsListeningNative(true);
    setAsked(false);

    if (!isRecognitionSupported()) {
      setIsListeningNative(false);
      return;
    }

    recRef.current = startRecognition({
      lang: bcp47Locale,
      silenceTimeoutMs: 2600,
      onInterim: (interimText) => {
        queryRef.current = interimText;
        setQuery(interimText);
      },
      onSilenceTimeout: () => {
        stopNativeMicAndTranslate();
      },
      onStatusChange: (status) => {
        if (status === 'error') {
          setIsListeningNative(false);
          recRef.current = null;
        }
      },
    });
  };

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return phrases;
    const hit = phrases.filter(
      (p) =>
        p.keywords.some((k) => q.includes(k.toLowerCase())) ||
        p.english.toLowerCase().includes(q) ||
        p.note.toLowerCase().includes(q)
    );
    if (aiSuggestions.length > 0) {
      return [...aiSuggestions, ...(hit.length ? hit : phrases.slice(0, 2))];
    }
    return hit.length ? hit : phrases;
  }, [query, phrases, aiSuggestions]);

  const play = (text: string) => {
    onUsed();
    speakEnglish(text, { rate: audioSpeed < 0.9 ? 0.92 : audioSpeed, accent });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[88dvh] overflow-y-auto overscroll-contain no-scrollbar scrollbar-none bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-t-3xl sm:rounded-3xl pb-safe p-4 sm:p-6 md:p-8 space-y-4 animate-slide-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="How do I say help"
      >
        <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                  How do I say…?
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                  ⏸️ Roleplay paused — no pressure
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Speak or type in {selectedLang} ({bcp47Locale}) for instant British phrasing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition shrink-0"
            aria-label="Close help"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Native Language Selector & Voice Input Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Globe className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>Your language:</span>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value as NativeLanguage)}
              className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
              aria-label="Select native language for voice input"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang} ({NATIVE_LANG_TO_BCP47[lang]})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleToggleNativeMic}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-extrabold transition active:scale-95 shadow-xs ${
              isListeningNative
                ? 'bg-rose-500 hover:bg-rose-600 text-white ring-4 ring-rose-200 dark:ring-rose-900/50 animate-pulse'
                : 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white'
            }`}
          >
            {isListeningNative ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Listening in {selectedLang}… (Tap to finish)</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>🎤 Speak in {selectedLang}</span>
              </>
            )}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            triggerTranslationLookup(query);
          }}
          className="relative"
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              queryRef.current = e.target.value;
              setAsked(false);
            }}
            placeholder={placeholders[selectedLang] ?? 'Type or speak what you want to say…'}
            className="w-full pl-9 pr-20 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-brand-400 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            dir={selectedLang === 'Arabic' ? 'rtl' : 'ltr'}
          />
          <button
            type="submit"
            disabled={isTranslating}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1"
          >
            {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ask'}
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <span>
            {asked && query ? 'Natural British English Options' : 'Quick rescue phrases'}
          </span>
          {isTranslating && (
            <span className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 normal-case">
              <Sparkles className="w-3 h-3 animate-spin" /> Translating to natural British English…
            </span>
          )}
        </div>

        <div className="space-y-2">
          {matches.map((p) => (
            <div
              key={p.id}
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 flex items-start justify-between gap-3"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{p.english}</p>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{p.ipa}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{p.note}</p>
              </div>
              <button
                onClick={() => play(p.english)}
                className="flex-shrink-0 p-2.5 rounded-xl bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-900/80 border border-transparent dark:border-brand-800 active:scale-95 transition"
                aria-label={`Listen: ${p.english}`}
                title="Tap to hear pronunciation"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
