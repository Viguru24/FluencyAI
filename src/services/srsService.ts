import type { SRSFlashcard, PhrasingUpgrade, SavedReviewPhrase } from '../types';

const SRS_STORAGE_KEY = 'fluency_srs_flashcards_v1';

const BOX_INTERVAL_DAYS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

const DEFAULT_SEED_CARDS: SRSFlashcard[] = [
  {
    id: 'srs-seed-1',
    phrase: "I was wondering if you might be able to help me?",
    ipa: "/aɪ wəz ˈwʌndərɪŋ ɪf juː maɪt biː ˈeɪbl tuː hɛlp miː/",
    context: "Polite Request • UK Hospitality & Daily Life",
    meaning: "Standard understated British opening instead of direct imperative.",
    box: 1,
    nextReviewDate: new Date().toISOString().split('T')[0],
    successCount: 0,
    failureCount: 0,
    scenarioTitle: "Specialty Coffee in London",
  },
  {
    id: 'srs-seed-2',
    phrase: "Could you possibly clarify how that works in practice?",
    ipa: "/kʊd juː ˈpɒsəbli ˈklærɪfaɪ haʊ ðæt wɜːks ɪn ˈpræktɪs/",
    context: "Workplace Nuance • Corporate Diplomacy",
    meaning: "Softening clarification questions without sounding confrontational.",
    box: 1,
    nextReviewDate: new Date().toISOString().split('T')[0],
    successCount: 0,
    failureCount: 0,
    scenarioTitle: "Job Interview: Pitching Strengths",
  },
  {
    id: 'srs-seed-3',
    phrase: "I'd appreciate it if we could keep each other in the loop.",
    ipa: "/aɪd əˈpriːʃieɪt ɪt ɪf wiː kʊd kiːp iːtʃ ˈʌðər ɪn ðə luːp/",
    context: "Professional Collaboration • British Etiquette",
    meaning: "Collaborative way to ask for ongoing updates.",
    box: 2,
    nextReviewDate: new Date().toISOString().split('T')[0],
    successCount: 1,
    failureCount: 0,
    scenarioTitle: "First Day at UK Office",
  },
];

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function addDaysToDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getSRSFlashcards(): SRSFlashcard[] {
  if (typeof window === 'undefined') return DEFAULT_SEED_CARDS;
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(DEFAULT_SEED_CARDS));
      return DEFAULT_SEED_CARDS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SEED_CARDS;
  } catch {
    return DEFAULT_SEED_CARDS;
  }
}

export function saveSRSFlashcards(cards: SRSFlashcard[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(cards));
    window.dispatchEvent(new Event('fluency_srs_updated'));
  } catch (err) {
    console.warn('[srsService] Error saving flashcards:', err);
  }
}

export function getDueSRSFlashcards(): SRSFlashcard[] {
  const today = getTodayString();
  const all = getSRSFlashcards();
  return all.filter((c) => !c.nextReviewDate || c.nextReviewDate <= today);
}

export function reviewSRSFlashcard(cardId: string, success: boolean): SRSFlashcard | null {
  const all = getSRSFlashcards();
  const cardIndex = all.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return null;

  const card = { ...all[cardIndex] };
  const today = getTodayString();

  if (success) {
    card.box = Math.min(5, card.box + 1) as 1 | 2 | 3 | 4 | 5;
    card.successCount = (card.successCount || 0) + 1;
    card.nextReviewDate = addDaysToDate(BOX_INTERVAL_DAYS[card.box] || 1);
  } else {
    card.box = 1; // Leitner penalty resets to Box 1 for daily drill
    card.failureCount = (card.failureCount || 0) + 1;
    card.nextReviewDate = addDaysToDate(1);
  }

  card.lastReviewed = today;
  all[cardIndex] = card;
  saveSRSFlashcards(all);
  return card;
}

export function addPhrasesToSRS(items: (PhrasingUpgrade | SavedReviewPhrase)[]): void {
  const all = getSRSFlashcards();
  const existingPhrases = new Set(all.map((c) => c.phrase.toLowerCase().trim()));

  const newCards: SRSFlashcard[] = [];
  const today = getTodayString();

  for (const item of items) {
    const phrase = ('moreNatural' in item ? item.moreNatural : item.phrase).trim();
    if (!phrase || existingPhrases.has(phrase.toLowerCase())) continue;

    const context = 'category' in item ? item.category : item.usageContext || 'Vocabulary Drill';
    const meaning = 'explanation' in item ? item.explanation || 'British phrasing upgrade' : 'Pedagogical upgrade';
    const ipa = 'ipa' in item && item.ipa ? item.ipa : '';

    newCards.push({
      id: `srs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      phrase,
      ipa,
      context,
      meaning,
      box: 1,
      nextReviewDate: today,
      successCount: 0,
      failureCount: 0,
      scenarioTitle: 'scenarioTitle' in item ? item.scenarioTitle : undefined,
    });
    existingPhrases.add(phrase.toLowerCase());
  }

  if (newCards.length > 0) {
    saveSRSFlashcards([...newCards, ...all]);
  }
}
