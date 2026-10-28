export type SubjectId =
  | 'maths'
  | 'literature'
  | 'science'
  | 'history'
  | 'career'
  | 'travel'
  | 'social'
  | 'healthcare'
  | 'daily';

export interface SubjectTheme {
  id: SubjectId;
  name: string;
  shortLabel: string;
  symbol: string;
  /** Ambient soft background glow for modals, banners, and view containers */
  ambientGlow: string;
  /** Hairline subtle 2px top gradient accent stripe */
  hairlineGradient: string;
  /** Subtle border outline tint for cards/panels */
  borderAccent: string;
  borderHover: string;
  /** Subtle top gradient tint for scenario cards */
  cardGradient: string;
  /** Pill badge styling with micro-symbol */
  badgeClasses: string;
  /** Hex color for canvas audio visualizers & custom waveform renders */
  accentColor: string;
  /** Rich header gradient when in lesson mode */
  headerGradient: string;
  /** Focus ring utility */
  ringFocus: string;
}

export const SUBJECT_THEMES: Record<SubjectId, SubjectTheme> = {
  maths: {
    id: 'maths',
    name: 'Mathematics',
    shortLabel: 'Maths',
    symbol: '∑',
    ambientGlow: 'bg-gradient-to-b from-indigo-500/8 via-indigo-500/2 to-transparent dark:from-indigo-400/12 dark:via-transparent',
    hairlineGradient: 'from-indigo-500/60 via-blue-400/40 to-transparent',
    borderAccent: 'border-indigo-200/80 dark:border-indigo-900/60',
    borderHover: 'hover:border-indigo-400/80 dark:hover:border-indigo-500/70',
    cardGradient: 'from-indigo-500/10 via-blue-500/5 to-transparent',
    badgeClasses: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60',
    accentColor: '#6366f1',
    headerGradient: 'from-indigo-800 via-blue-700 to-slate-900',
    ringFocus: 'focus:ring-indigo-400/30',
  },
  literature: {
    id: 'literature',
    name: 'Literature & Arts',
    shortLabel: 'Literature',
    symbol: '🖋️',
    ambientGlow: 'bg-gradient-to-b from-amber-500/8 via-amber-500/2 to-transparent dark:from-amber-400/12 dark:via-transparent',
    hairlineGradient: 'from-amber-500/60 via-orange-400/40 to-transparent',
    borderAccent: 'border-amber-200/80 dark:border-amber-900/60',
    borderHover: 'hover:border-amber-400/80 dark:hover:border-amber-500/70',
    cardGradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
    badgeClasses: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    accentColor: '#d97706',
    headerGradient: 'from-amber-800 via-orange-700 to-slate-900',
    ringFocus: 'focus:ring-amber-400/30',
  },
  science: {
    id: 'science',
    name: 'Science & STEM',
    shortLabel: 'Science',
    symbol: '⚗️',
    ambientGlow: 'bg-gradient-to-b from-teal-500/8 via-teal-500/2 to-transparent dark:from-teal-400/12 dark:via-transparent',
    hairlineGradient: 'from-teal-500/60 via-emerald-400/40 to-transparent',
    borderAccent: 'border-teal-200/80 dark:border-teal-900/60',
    borderHover: 'hover:border-teal-400/80 dark:hover:border-teal-500/70',
    cardGradient: 'from-teal-500/10 via-emerald-500/5 to-transparent',
    badgeClasses: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/60',
    accentColor: '#0d9488',
    headerGradient: 'from-teal-800 via-emerald-700 to-slate-900',
    ringFocus: 'focus:ring-teal-400/30',
  },
  history: {
    id: 'history',
    name: 'History & Culture',
    shortLabel: 'History',
    symbol: '🏛️',
    ambientGlow: 'bg-gradient-to-b from-stone-500/8 via-stone-500/2 to-transparent dark:from-stone-400/12 dark:via-transparent',
    hairlineGradient: 'from-stone-500/60 via-amber-400/40 to-transparent',
    borderAccent: 'border-stone-200/80 dark:border-stone-800/60',
    borderHover: 'hover:border-stone-400/80 dark:hover:border-stone-500/70',
    cardGradient: 'from-stone-500/10 via-amber-500/5 to-transparent',
    badgeClasses: 'bg-stone-50 text-stone-800 border-stone-200 dark:bg-stone-950/60 dark:text-stone-300 dark:border-stone-800/60',
    accentColor: '#b45309',
    headerGradient: 'from-stone-800 via-amber-900 to-slate-900',
    ringFocus: 'focus:ring-stone-400/30',
  },
  career: {
    id: 'career',
    name: 'Career & Tech',
    shortLabel: 'Career',
    symbol: '💼',
    ambientGlow: 'bg-gradient-to-b from-sky-500/8 via-sky-500/2 to-transparent dark:from-sky-400/12 dark:via-transparent',
    hairlineGradient: 'from-sky-500/60 via-blue-400/40 to-transparent',
    borderAccent: 'border-sky-200/80 dark:border-sky-900/60',
    borderHover: 'hover:border-sky-400/80 dark:hover:border-sky-500/70',
    cardGradient: 'from-sky-500/10 via-blue-500/5 to-transparent',
    badgeClasses: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60',
    accentColor: '#0284c7',
    headerGradient: 'from-brand-600 via-sky-600 to-slate-900',
    ringFocus: 'focus:ring-sky-400/30',
  },
  travel: {
    id: 'travel',
    name: 'Travel & Navigation',
    shortLabel: 'Travel',
    symbol: '✈️',
    ambientGlow: 'bg-gradient-to-b from-cyan-500/8 via-cyan-500/2 to-transparent dark:from-cyan-400/12 dark:via-transparent',
    hairlineGradient: 'from-cyan-500/60 via-sky-400/40 to-transparent',
    borderAccent: 'border-cyan-200/80 dark:border-cyan-900/60',
    borderHover: 'hover:border-cyan-400/80 dark:hover:border-cyan-500/70',
    cardGradient: 'from-cyan-500/10 via-sky-500/5 to-transparent',
    badgeClasses: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/60',
    accentColor: '#0891b2',
    headerGradient: 'from-cyan-700 via-teal-700 to-slate-900',
    ringFocus: 'focus:ring-cyan-400/30',
  },
  social: {
    id: 'social',
    name: 'Social & Banter',
    shortLabel: 'Social',
    symbol: '💬',
    ambientGlow: 'bg-gradient-to-b from-purple-500/8 via-purple-500/2 to-transparent dark:from-purple-400/12 dark:via-transparent',
    hairlineGradient: 'from-purple-500/60 via-pink-400/40 to-transparent',
    borderAccent: 'border-purple-200/80 dark:border-purple-900/60',
    borderHover: 'hover:border-purple-400/80 dark:hover:border-purple-500/70',
    cardGradient: 'from-purple-500/10 via-pink-500/5 to-transparent',
    badgeClasses: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60',
    accentColor: '#8b5cf6',
    headerGradient: 'from-purple-800 via-pink-700 to-slate-900',
    ringFocus: 'focus:ring-purple-400/30',
  },
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & Wellbeing',
    shortLabel: 'Healthcare',
    symbol: '🩺',
    ambientGlow: 'bg-gradient-to-b from-rose-500/8 via-rose-500/2 to-transparent dark:from-rose-400/12 dark:via-transparent',
    hairlineGradient: 'from-rose-500/60 via-red-400/40 to-transparent',
    borderAccent: 'border-rose-200/80 dark:border-rose-900/60',
    borderHover: 'hover:border-rose-400/80 dark:hover:border-rose-500/70',
    cardGradient: 'from-rose-500/10 via-red-500/5 to-transparent',
    badgeClasses: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
    accentColor: '#e11d48',
    headerGradient: 'from-rose-800 via-red-700 to-slate-900',
    ringFocus: 'focus:ring-rose-400/30',
  },
  daily: {
    id: 'daily',
    name: 'Daily Life',
    shortLabel: 'Daily Life',
    symbol: '☕',
    ambientGlow: 'bg-gradient-to-b from-emerald-500/8 via-emerald-500/2 to-transparent dark:from-emerald-400/12 dark:via-transparent',
    hairlineGradient: 'from-emerald-500/60 via-teal-400/40 to-transparent',
    borderAccent: 'border-emerald-200/80 dark:border-emerald-900/60',
    borderHover: 'hover:border-emerald-400/80 dark:hover:border-emerald-500/70',
    cardGradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    badgeClasses: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    accentColor: '#059669',
    headerGradient: 'from-emerald-700 via-teal-700 to-slate-900',
    ringFocus: 'focus:ring-emerald-400/30',
  },
};

/**
 * Resolves any category, tag, or context string into the matching SubjectTheme.
 * Falls back gracefully to 'career' or 'daily' if not matched.
 */
export function getSubjectTheme(categoryOrLabel?: string | null): SubjectTheme {
  if (!categoryOrLabel) return SUBJECT_THEMES.career;

  const text = categoryOrLabel.toLowerCase().trim();

  // Mathematics
  if (
    text.includes('math') ||
    text.includes('calcul') ||
    text.includes('algebra') ||
    text.includes('arithmetic') ||
    text.includes('statistic') ||
    text.includes('geometry')
  ) {
    return SUBJECT_THEMES.maths;
  }

  // Literature & Arts
  if (
    text.includes('literat') ||
    text.includes('novel') ||
    text.includes('poet') ||
    text.includes('book') ||
    text.includes('essay') ||
    text.includes('author') ||
    text.includes('shakespeare') ||
    text.includes('fiction')
  ) {
    return SUBJECT_THEMES.literature;
  }

  // Science & STEM
  if (
    text.includes('science') ||
    text.includes('physic') ||
    text.includes('chemist') ||
    text.includes('biolog') ||
    text.includes('lab') ||
    text.includes('experiment') ||
    text.includes('stem')
  ) {
    return SUBJECT_THEMES.science;
  }

  // History & Culture
  if (
    text.includes('histor') ||
    text.includes('ancient') ||
    text.includes('heritage') ||
    text.includes('museum') ||
    text.includes('archaeology')
  ) {
    return SUBJECT_THEMES.history;
  }

  // Healthcare
  if (
    text.includes('health') ||
    text.includes('medic') ||
    text.includes('doctor') ||
    text.includes('pharm') ||
    text.includes('nurse') ||
    text.includes('nhs') ||
    text.includes('clinic') ||
    text.includes('hospital')
  ) {
    return SUBJECT_THEMES.healthcare;
  }

  // Travel
  if (
    text.includes('travel') ||
    text.includes('flight') ||
    text.includes('airport') ||
    text.includes('hotel') ||
    text.includes('train') ||
    text.includes('touris') ||
    text.includes('vacation')
  ) {
    return SUBJECT_THEMES.travel;
  }

  // Social
  if (
    text.includes('social') ||
    text.includes('pub') ||
    text.includes('party') ||
    text.includes('banter') ||
    text.includes('friend') ||
    text.includes('dinner')
  ) {
    return SUBJECT_THEMES.social;
  }

  // Daily Life
  if (
    text.includes('daily') ||
    text.includes('coffee') ||
    text.includes('barista') ||
    text.includes('cafe') ||
    text.includes('flat') ||
    text.includes('shopping') ||
    text.includes('supermarket') ||
    text.includes('grocer')
  ) {
    return SUBJECT_THEMES.daily;
  }

  // Career & Tech
  if (
    text.includes('career') ||
    text.includes('tech') ||
    text.includes('work') ||
    text.includes('job') ||
    text.includes('interview') ||
    text.includes('office') ||
    text.includes('corporate') ||
    text.includes('meeting')
  ) {
    return SUBJECT_THEMES.career;
  }

  // Default fallback
  return SUBJECT_THEMES.career;
}
