import React, { useState, useRef } from 'react';
import { X, Sparkles, Wand2, Compass, Loader2, FileText, Upload, Trash2, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import { generateCustomScenario } from '../services/geminiService';
import { playChime } from '../services/speech';
import type { CEFRLevel, AIPersona, NativeLanguage, LessonPlan, RoleplayScenario } from '../types';

interface CustomScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePersona: AIPersona;
  userLevel: CEFRLevel;
  nativeLanguage: NativeLanguage;
  onLaunchScenario: (scenario: RoleplayScenario, plan: LessonPlan) => void;
}

const PRESET_IDEAS = [
  'Negotiating lease terms & tenancy deposit with a London landlord',
  'Explaining a project timeline delay to a demanding client',
  'Returning a faulty garment to customer service at Marks & Spencer',
  'Politely declining extra work duties without sounding unhelpful',
  'Casual pub banter: discussing football & weekend plans',
  'Doctor appointment: describing recurring chest discomfort & fatigue',
];

export const CustomScenarioModal: React.FC<CustomScenarioModalProps> = ({
  isOpen,
  onClose,
  activePersona,
  userLevel,
  nativeLanguage,
  onLaunchScenario,
}) => {
  const [prompt, setPrompt] = useState('');
  const [level, setLevel] = useState<CEFRLevel>(userLevel);
  const [isGenerating, setIsGenerating] = useState(false);
  const [docName, setDocName] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  const [isDocExpanded, setIsDocExpanded] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setDocContent(text.slice(0, 4500));
      setIsDocExpanded(true);
      playChime('tap');
    };
    reader.readAsText(file);
  };

  const handleClearDoc = () => {
    setDocName('');
    setDocContent('');
    setIsDocExpanded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    playChime('tap');
  };

  const handleGenerate = async (selectedPrompt?: string) => {
    const finalPrompt = (selectedPrompt || prompt).trim();
    if (!finalPrompt || isGenerating) return;

    playChime('tap');
    setIsGenerating(true);

    try {
      const { scenario, plan } = await generateCustomScenario(
        finalPrompt,
        level,
        activePersona,
        nativeLanguage,
        docContent.trim() || undefined
      );
      playChime('success');
      onLaunchScenario(scenario, plan);
      onClose();
    } catch (err) {
      console.warn('Custom scenario creation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 text-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Custom Situation Builder
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                  AI Dynamic Scaffolding
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Practice any real-life conversation you are facing with {activePersona.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Situation Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              What situation do you want to practice?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Asking my manager for a salary review in our 1-on-1 meeting..."
              rows={3}
              disabled={isGenerating}
              className="w-full p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-60 resize-none"
            />
          </div>

          {/* Document / Job Spec / Resume Grounding Section */}
          <div className="space-y-2 p-3 rounded-2xl bg-slate-800/40 border border-slate-800">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.csv,.rtf,.log"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ground with Document</span>
                <span className="text-[10px] text-slate-500 font-normal lowercase">(optional)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
                >
                  <Upload className="w-3 h-3 text-emerald-400" />
                  <span>Upload File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDocExpanded(!isDocExpanded)}
                  disabled={isGenerating}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
                >
                  <Paperclip className="w-3 h-3 text-indigo-400" />
                  <span>{docContent ? (isDocExpanded ? 'Hide' : 'Inspect') : (isDocExpanded ? 'Close' : 'Paste Text')}</span>
                  {isDocExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Document Active Chip */}
            {docContent ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="font-semibold truncate">{docName || 'Pasted Document Context'}</span>
                  <span className="text-[10px] text-emerald-400/70 shrink-0">
                    ({docContent.length} chars ~{Math.round(docContent.trim().split(/\s+/).length)} words)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearDoc}
                  title="Remove document"
                  className="p-1 rounded-lg hover:bg-emerald-900/50 text-slate-400 hover:text-rose-400 transition shrink-0 ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Attach a Job Spec, CV/Resume, or meeting notes to generate custom roleplay with your exact role vocabulary.
              </p>
            )}

            {/* Expanded Paste/Edit Box */}
            {isDocExpanded && (
              <div className="mt-2 space-y-1">
                <textarea
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value.slice(0, 4500))}
                  placeholder="Paste job description, resume summary, or meeting context here..."
                  rows={4}
                  disabled={isGenerating}
                  className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition resize-none font-mono"
                />
                <div className="flex justify-between text-[10px] text-slate-500 px-1">
                  <span>Grounding document context</span>
                  <span>{docContent.length}/4500 max chars</span>
                </div>
              </div>
            )}
          </div>

          {/* CEFR Level Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Target CEFR Difficulty:
            </label>
            <div className="flex gap-2">
              {(['A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  disabled={isGenerating}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                    level === lvl
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Preset Inspo Chips */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Or tap a popular real-world prompt:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {PRESET_IDEAS.map((idea, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => {
                    setPrompt(idea);
                    handleGenerate(idea);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-medium transition active:scale-95 text-left disabled:opacity-50"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={() => handleGenerate()}
            disabled={!prompt.trim() || isGenerating}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-emerald-600/25 disabled:opacity-50 disabled:shadow-none"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                <span>Designing Custom Scenario with {activePersona.name}...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Generate &amp; Start Roleplay Session</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
