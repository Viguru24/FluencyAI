import React, { useMemo, useState } from 'react';
import { X, LifeBuoy, Volume2, Search } from 'lucide-react';
import type { HelpPhrase, NativeLanguage } from '../../types';
import { speakEnglish } from '../../services/speech';

interface Props {
  phrases: HelpPhrase[];
  nativeLanguage: NativeLanguage;
  accent: 'UK' | 'US';
  audioSpeed: number;
  onClose: () => void;
  onUsed: () => void;
}

const placeholders: Partial<Record<NativeLanguage, string>> = {
  Spanish: 'Ej: ¿Puede repetir más despacio?',
  French: 'Ex : Pouvez-vous répéter ?',
  Mandarin: '例如：请再说一遍',
  Japanese: '例：もう一度言ってください',
  Portuguese: 'Ex: Pode repetir mais devagar?',
  Arabic: 'مثال: هل يمكنك التكرار ببطء؟',
  German: 'z. B. Können Sie das wiederholen?',
  Vietnamese: 'VD: Bạn có thể nói chậm hơn không?',
};

export const HowDoISaySheet: React.FC<Props> = ({ phrases, nativeLanguage, accent, audioSpeed, onClose, onUsed }) => {
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState(false);

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return phrases;
    const hit = phrases.filter((p) => p.keywords.some((k) => q.includes(k.toLowerCase())));
    return hit.length ? hit : phrases;
  }, [query, phrases]);

  const play = (text: string) => {
    onUsed();
    speakEnglish(text, { rate: Math.min(audioSpeed, 0.85), accent });
  };

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-h-[80%] overflow-y-auto bg-white rounded-t-3xl p-5 space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="How do I say help"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900">How do I say…?</h3>
              <p className="text-xs text-slate-500">Ask in {nativeLanguage} — no pressure, the roleplay is paused.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200" aria-label="Close help">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAsked(true);
          }}
          className="relative"
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAsked(false);
            }}
            placeholder={placeholders[nativeLanguage] ?? 'Type what you want to say…'}
            className="w-full pl-9 pr-20 py-3 rounded-2xl bg-slate-100 focus:bg-white border border-transparent focus:border-brand-400 text-sm focus:outline-none"
            dir={nativeLanguage === 'Arabic' ? 'rtl' : 'ltr'}
          />
          <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold">
            Ask
          </button>
        </form>

        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {asked && query ? 'Try saying this in English' : 'Quick rescue phrases'}
        </div>

        <div className="space-y-2">
          {matches.map((p) => (
            <div key={p.id} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900">{p.english}</p>
                <p className="text-[11px] font-mono text-slate-500">{p.ipa}</p>
                <p className="text-xs text-slate-600">{p.note}</p>
              </div>
              <button
                onClick={() => play(p.english)}
                className="flex-shrink-0 p-2.5 rounded-xl bg-brand-100 text-brand-700 hover:bg-brand-200 active:scale-95"
                aria-label={`Listen: ${p.english}`}
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
