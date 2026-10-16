import React, { useState } from 'react';
import { X, Volume2, CheckCircle2, UserCheck, Sparkles } from 'lucide-react';
import { ALL_PERSONAS, setActivePersona } from '../data/personas';
import { speakEnglish, playChime, stopSpeaking } from '../services/speech';
import type { AIPersona, PersonaId } from '../types';

interface PersonaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePersona: AIPersona;
  onSelectPersona: (persona: AIPersona) => void;
}

export const PersonaSelectorModal: React.FC<PersonaSelectorModalProps> = ({
  isOpen,
  onClose,
  activePersona,
  onSelectPersona,
}) => {
  const [auditioningId, setAuditioningId] = useState<PersonaId | null>(null);

  if (!isOpen) return null;

  const personas = Object.values(ALL_PERSONAS);

  const handleAudition = (persona: AIPersona) => {
    stopSpeaking();
    playChime('tap');
    setAuditioningId(persona.id as PersonaId);

    const phrase = persona.sampleVoicePhrase || persona.greeting;
    speakEnglish(phrase, {
      personaName: persona.name,
      rate: persona.rate || 0.94,
      pitch: persona.pitch || 1.0,
      accent: persona.accent || 'UK',
      voicePreferences: persona.ttsVoicePreference,
      gender: persona.gender,
      onStart: () => setAuditioningId(persona.id as PersonaId),
      onEnd: () => setAuditioningId(null),
    });
  };

  const handleSelect = (persona: AIPersona) => {
    playChime('success');
    setActivePersona(persona.id as PersonaId);
    onSelectPersona(persona);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Choose Your British &amp; Regional Coach
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold">
                  4 Distinct Personas
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Switch speaking style, regional accent cadence, and conversational pace
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

        {/* Coach Cards Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          {personas.map((p) => {
            const isCurrent = activePersona.id === p.id || activePersona.name.toLowerCase() === p.name.toLowerCase();
            const isAuditioning = auditioningId === p.id;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-3xl border transition-all flex flex-col justify-between space-y-3 ${
                  isCurrent
                    ? 'bg-gradient-to-b from-indigo-950/60 to-slate-900 border-indigo-500/80 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner">
                        {p.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-extrabold text-white">{p.name}</h4>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-indigo-300">{p.role}</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] font-semibold text-amber-300/90">{p.tagline}</p>

                  {p.vocalProfile && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 border border-slate-700/70 text-[11px] font-medium text-indigo-300">
                      <span>{p.vocalProfile}</span>
                    </div>
                  )}

                  <p className="text-xs text-slate-300 leading-relaxed">{p.bio}</p>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 italic">
                    &ldquo;{p.greeting}&rdquo;
                  </div>
                </div>

                {/* Actions: Audition & Select */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleAudition(p)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 border ${
                      isAuditioning
                        ? 'bg-indigo-600 text-white border-indigo-500 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${isAuditioning ? 'animate-bounce' : ''}`} />
                    {isAuditioning ? `Playing ${p.name}…` : 'Audition Voice'}
                  </button>

                  <button
                    onClick={() => handleSelect(p)}
                    disabled={isCurrent}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                      isCurrent
                        ? 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-default'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-md shadow-emerald-600/20'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isCurrent ? 'Current Coach' : 'Switch to ' + p.name}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
