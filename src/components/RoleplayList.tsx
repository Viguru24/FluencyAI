import React, { useState } from 'react';
import { 
  Clock, 
  Volume2, 
  ChevronRight, 
  BookOpen, 
  CheckCircle2,
  Wand2,
  Sparkles,
} from 'lucide-react';
import type { RoleplayScenario, UserProgress } from '../types';
import { speakEnglish, playChime } from '../services/speech';
import { useGamificationStore } from '../store/rewardSystem';

interface RoleplayListProps {
  scenarios: RoleplayScenario[];
  progress: UserProgress;
  onSelectScenario: (scenario: RoleplayScenario) => void;
  onOpenCustomBuilder?: () => void;
}

export const RoleplayList: React.FC<RoleplayListProps> = ({
  scenarios,
  progress,
  onSelectScenario,
  onOpenCustomBuilder,
}) => {
  const { unlockedPerks } = useGamificationStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedVocabId, setExpandedVocabId] = useState<string | null>(null);
  const [playingWord, setPlayingWord] = useState<string | null>(null);

  const categories = ['All', 'Daily Life', 'Career & Tech', 'Travel', 'Social', 'Healthcare'];

  const filteredScenarios = scenarios.filter((s) => {
    if (selectedCategory !== 'All' && s.category !== selectedCategory) return false;
    return true;
  });

  const handleSpeakWord = (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playChime('tap');
    setPlayingWord(word);
    speakEnglish(word, {
      rate: progress.audioSpeed,
      onEnd: () => setPlayingWord(null),
    });
  };

  return (
    <section className="w-full space-y-4 pt-2">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Conversational Roleplays
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300/40">
              AI Powered
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-world English simulations with instant pronunciation & grammar guidance.
          </p>
        </div>
      </div>

      {/* Category Filter Pills (Horizontal scrollable on mobile) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              playChime('tap');
              setSelectedCategory(cat);
            }}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 ${
              selectedCategory === cat
                ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* AI Custom Situation Builder Card */}
      {onOpenCustomBuilder && (
        <div
          onClick={onOpenCustomBuilder}
          className="group relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/40 p-4 sm:p-5 shadow-soft hover:shadow-soft-lg cursor-pointer hover:border-emerald-400 transition-all active:scale-98"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
                    Build Custom Real-World Roleplay
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </h4>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30">
                    AI Scaffolding
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Prepare for a specific landlord chat, client review, interview or pub talk
                </p>
              </div>
            </div>

            <button
              type="button"
              className="flex-shrink-0 px-3.5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1 shadow-md shadow-emerald-500/20 group-hover:translate-x-0.5 transition-all"
            >
              <span>Build with AI</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Scenarios List */}
      <div className="space-y-3.5">
        {filteredScenarios.map((scenario) => {
          const isCompleted = progress.completedScenarioIds.includes(scenario.id);
          const isVocabOpen = expandedVocabId === scenario.id;

          return (
            <div
              key={scenario.id}
              onClick={() => {
                playChime('tap');
                onSelectScenario(scenario);
              }}
              className={`group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft hover:shadow-soft-lg transition-all duration-300 cursor-pointer hover:border-brand-300 dark:hover:border-brand-500 ${
                isCompleted ? 'border-emerald-200/90 dark:border-emerald-800/80' : ''
              }`}
            >
              {/* Subtle top background tint */}
              <div
                className={`absolute inset-0 h-28 bg-gradient-to-br ${scenario.gradient} pointer-events-none`}
              />

              <div className="relative z-10 p-4 sm:p-5 space-y-3">
                {/* Top Meta Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Persona Avatar */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-base">
                      {scenario.aiPersona.avatar}
                    </div>

                    {/* AI Tutor Info */}
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{scenario.aiPersona.name}</span>
                      <span className="text-slate-400 mx-1">•</span>
                      <span className="text-slate-500 dark:text-slate-400">{scenario.aiPersona.accent === 'UK' ? '🇬🇧 UK Accent' : '🇺🇸 US Accent'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* CEFR Level Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${scenario.badgeColor}`}
                    >
                      {scenario.cefrLevel}
                    </span>

                    {/* Career & Tech Gold Tier Perk Badge */}
                    {scenario.category === 'Career & Tech' && (
                      <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border transition ${
                          unlockedPerks.includes('career-tech-roleplay')
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                        title="Career & Tech Roleplay Pack (Gold Tier Perk)"
                      >
                        <span>💼 Gold Perk</span>
                      </span>
                    )}

                    {/* Duration */}
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium border border-slate-200/50 dark:border-slate-700/50">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {scenario.durationMinutes}m
                    </span>

                    {/* Completed Checkmark */}
                    {isCompleted && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Done
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Tagline */}
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {scenario.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                    {scenario.tagline}
                  </p>
                </div>

                {/* Key Vocabulary Collapsible Helper for Non-Native Speakers */}
                <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 p-2.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playChime('tap');
                      setExpandedVocabId(isVocabOpen ? null : scenario.id);
                    }}
                    className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <span>Key Vocabulary ({scenario.keyVocabulary.length} phrases)</span>
                    </span>
                    <span className="text-[11px] text-brand-600 dark:text-brand-400 font-bold">
                      {isVocabOpen ? 'Hide' : 'Preview & Listen'}
                    </span>
                  </button>

                  {/* Vocabulary preview items */}
                  {isVocabOpen && (
                    <div className="mt-3 space-y-2 border-t border-slate-200/60 dark:border-slate-700/60 pt-2 animate-fade-in">
                      {scenario.keyVocabulary.map((vocab, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-start justify-between gap-2"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">{vocab.word}</span>
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{vocab.ipa}</span>
                              <span className="text-[10px] px-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                                {vocab.partOfSpeech}
                              </span>
                            </div>
                            <div className="text-[11px] text-brand-700 dark:text-brand-400 font-semibold">
                              {progress.nativeLanguage}:{' '}
                              <span className="text-slate-700 dark:text-slate-200 font-normal">
                                {vocab.translations[progress.nativeLanguage] || 'Translation ready'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                              "{vocab.example}"
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleSpeakWord(vocab.word, e)}
                            className="p-2 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/80 text-brand-600 dark:text-brand-300 transition active:scale-95 flex-shrink-0"
                            title="Listen to native pronunciation"
                            aria-label={`Pronounce ${vocab.word}`}
                          >
                            <Volume2
                              className={`w-3.5 h-3.5 ${
                                playingWord === vocab.word ? 'animate-bounce text-brand-700 dark:text-brand-200' : ''
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Row */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-300">
                    Focus: <span className="text-slate-800 dark:text-slate-100 font-semibold">{scenario.learningGoals[0]}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playChime('tap');
                      onSelectScenario(scenario);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white text-xs font-bold shadow-sm shadow-brand-500/20 transition active:scale-95"
                  >
                    <span>Practice Conversation</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
