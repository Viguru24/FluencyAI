import type { LessonPlan, LessonSessionResult, PhrasingUpgrade } from '../types';

// Lightweight rule-based phrasing coach (mock "AI" until a real LLM backend is wired in).
const RULES: { test: RegExp; fix: (s: string) => string; explanation: string; category: PhrasingUpgrade['category'] }[] = [
  {
    test: /\bi want\b/i,
    fix: (s) => s.replace(/\bi want\b/i, 'Could I get').replace(/\.?$/, ', please?'),
    explanation: '"I want" can sound abrupt in British English. "Could I get… please?" is warmer.',
    category: 'Politeness',
  },
  {
    test: /\bexplain me\b/i,
    fix: (s) => s.replace(/can you explain me/i, 'Would you mind walking me through'),
    explanation: '"Explain" doesn’t take "me" directly. Try "walk me through" or "explain it to me".',
    category: 'Grammar',
  },
  {
    test: /\bi am agree\b/i,
    fix: (s) => s.replace(/\bi am agree\b/i, 'I completely agree'),
    explanation: '"Agree" is already a verb — drop "am".',
    category: 'Grammar',
  },
  {
    test: /\bvery good\b/i,
    fix: (s) => s.replace(/\bvery good\b/i, 'really lovely'),
    explanation: 'Brits often say "lovely" or "brilliant" — it sounds more natural than "very good".',
    category: 'Natural Idiom',
  },
];

export function buildUpgrades(plan: LessonPlan, userTurns: string[]): PhrasingUpgrade[] {
  const out: PhrasingUpgrade[] = [];
  userTurns.forEach((turn, i) => {
    const prepared = plan.upgrades.find((u) => u.whatYouSaid.toLowerCase() === turn.toLowerCase());
    if (prepared) {
      out.push(prepared);
      return;
    }
    const rule = RULES.find((r) => r.test.test(turn));
    if (rule) {
      out.push({ id: `live-${i}`, whatYouSaid: turn, moreNatural: rule.fix(turn), explanation: rule.explanation, category: rule.category });
    }
  });
  // Always give the learner something to take away
  return out.length ? out : plan.upgrades.slice(0, 2);
}

export interface Scores {
  overall: number;
  fluency: number;
  pronunciation: number;
  listening: number;
}

export function computeScores(plan: LessonPlan, r: LessonSessionResult): Scores {
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const pronunciation = Math.round(avg(r.phraseScores) || 70);
  const expectedTurns = Math.max(1, plan.aiTurns.length - 1);
  const participation = Math.min(1, r.userTurns.length / expectedTurns);
  const fluency = Math.round(55 + participation * 40 - r.helpRequests * 3);
  const listening = Math.round(Math.max(40, 100 - (r.revealsUsed / Math.max(1, r.aiTurnsHeard)) * 45));
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const f = clamp(fluency);
  const p = clamp(pronunciation);
  const l = clamp(listening);
  return { fluency: f, pronunciation: p, listening: l, overall: Math.round(f * 0.45 + p * 0.35 + l * 0.2) };
}
