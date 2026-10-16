import React, { useEffect, useState } from 'react';
import {
  X,
  Volume2,
  BookmarkPlus,
  BookmarkCheck,
  ExternalLink,
  BookOpen,
  Loader2,
} from 'lucide-react';
import {
  cleanWordToken,
  lookupWordDefinition,
  type DictionaryEntry,
} from '../services/dictionaryService';
import { speakEnglish, playChime } from '../services/speech';
import { addPhrasesToSRS, getSRSFlashcards } from '../services/srsService';
import { toast } from '../services/toast';
import type { AIPersona } from '../types';

interface InteractiveTranscriptTextProps {
  text: string;
  disabled?: boolean;
  onSelectWord: (word: string, contextSentence: string) => void;
  className?: string;
}

/**
 * Renders conversational text where each word can be tapped to open the instant
 * British Dictionary & Audio Phonetics popover.
 */
export const InteractiveTranscriptText: React.FC<InteractiveTranscriptTextProps> = ({
  text,
  disabled = false,
  onSelectWord,
  className = '',
}) => {
  if (disabled) {
    return <span className={className}>{text}</span>;
  }

  const tokens = text.split(/(\s+)/);

  return (
    <span className={className}>
      {tokens.map((token, idx) => {
        if (/^\s+$/.test(token)) {
          return <React.Fragment key={idx}>{token}</React.Fragment>;
        }
        const cleaned = cleanWordToken(token);
        if (!cleaned || cleaned.length < 2) {
          return <React.Fragment key={idx}>{token}</React.Fragment>;
        }

        return (
          <span
            key={idx}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              playChime('tap');
              onSelectWord(cleaned, text);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                playChime('tap');
                onSelectWord(cleaned, text);
              }
            }}
            title={`Tap to look up "${cleaned}"`}
            className="cursor-pointer rounded px-0.5 -mx-0.5 hover:bg-brand-500/15 hover:underline decoration-brand-400/70 decoration-dotted underline-offset-4 transition-colors"
          >
            {token}
          </span>
        );
      })}
    </span>
  );
};

interface WordLookupModalProps {
  word: string | null;
  contextSentence?: string;
  scenarioTitle?: string;
  persona?: AIPersona;
  audioSpeed?: number;
  onClose: () => void;
}

export const WordLookupModal: React.FC<WordLookupModalProps> = ({
  word,
  contextSentence,
  scenarioTitle,
  persona,
  audioSpeed = 0.9,
  onClose,
}) => {
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!word) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoading(true);
        setEntry(null);
        const existing = getSRSFlashcards().some(
          (c) => c.phrase.toLowerCase().trim() === word.toLowerCase().trim()
        );
        setIsSaved(existing);
      }
    });

    lookupWordDefinition(word)
      .then((res) => {
        if (!cancelled) {
          setEntry(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [word]);

  if (!word) return null;

  const handlePlayAudio = () => {
    playChime('tap');
    setIsPlaying(true);

    if (entry?.audioUrl) {
      const audio = new Audio(entry.audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        speakEnglish(entry.word || word, {
          rate: audioSpeed,
          accent: persona?.accent || 'UK',
          personaName: persona?.name || 'James',
          onEnd: () => setIsPlaying(false),
        });
      };
      audio.play().catch(() => {
        speakEnglish(entry.word || word, {
          rate: audioSpeed,
          accent: persona?.accent || 'UK',
          personaName: persona?.name || 'James',
          onEnd: () => setIsPlaying(false),
        });
      });
    } else {
      speakEnglish(entry?.word || word, {
        rate: audioSpeed,
        accent: persona?.accent || 'UK',
        personaName: persona?.name || 'James',
        onEnd: () => setIsPlaying(false),
      });
    }
  };

  const handleSaveToSRS = () => {
    if (!entry || isSaved) return;
    playChime('success');
    const primaryMeaning = entry.meanings[0];

    addPhrasesToSRS(
      [
        {
          id: `dict-${entry.word}-${Date.now()}`,
          phrase: entry.word,
          ipa: entry.ipa,
          usageContext: `${primaryMeaning?.partOfSpeech || 'Vocabulary'} • ${
            scenarioTitle || 'Tap-to-Define'
          }`,
          explanation:
            primaryMeaning?.definition ||
            contextSentence ||
            'Saved from live conversation lookup',
          whatYouSaid: contextSentence,
          dateSaved: new Date().toISOString(),
          scenarioTitle: scenarioTitle || 'Vocabulary Lookup',
        },
      ],
      scenarioTitle
    );

    setIsSaved(true);
    toast.success(`"${entry.word}" added to your SRS Flashcard deck!`, 'Saved to SRS');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-70 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-slide-up"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-brand-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-brand-100">
              Instant British Dictionary
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-white/15 hover:bg-white/25 text-white transition"
            aria-label="Close dictionary lookup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600 dark:text-brand-400" />
              <span className="text-xs font-semibold">Looking up &ldquo;{word}&rdquo;…</span>
            </div>
          ) : entry ? (
            <>
              {/* Word, IPA & Audio Button */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white capitalize tracking-tight">
                    {entry.word}
                  </h3>
                  {entry.ipa && (
                    <span className="inline-block mt-0.5 text-xs font-mono font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-lg border border-brand-200/70 dark:border-brand-800">
                      {entry.ipa}
                    </span>
                  )}
                </div>

                <button
                  onClick={handlePlayAudio}
                  className="px-3.5 py-2 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-bounce' : ''}`} />
                  <span>{entry.audioUrl ? 'UK Audio' : 'Pronounce'}</span>
                </button>
              </div>

              {/* Meanings List */}
              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {entry.meanings.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 space-y-1"
                  >
                    <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">
                      {m.partOfSpeech}
                    </span>
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                      {m.definition}
                    </p>
                    {m.example && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-0.5">
                        &ldquo;{m.example}&rdquo;
                      </p>
                    )}
                    {m.synonyms.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1">
                        {m.synonyms.map((syn, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          >
                            {syn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Context quote if available */}
              {contextSentence && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 rounded-xl px-3 py-2">
                  <strong className="text-amber-900 dark:text-amber-300">In conversation:</strong> &ldquo;{contextSentence}&rdquo;
                </div>
              )}

              {/* Actions: Save to SRS + YouGlish UK */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveToSRS}
                  disabled={isSaved}
                  className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                    isSaved
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-xs'
                  }`}
                >
                  {isSaved ? (
                    <>
                      <BookmarkCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Saved in SRS Deck</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-4 h-4" />
                      <span>Save to SRS Deck</span>
                    </>
                  )}
                </button>

                <a
                  href={entry.youglishUkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => playChime('tap')}
                  className="py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  title="Hear real British speakers use this word in context on YouGlish"
                >
                  <span>🇬🇧 YouGlish</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
