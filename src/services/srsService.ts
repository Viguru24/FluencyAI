import type { SRSFlashcard, PhrasingUpgrade, SavedReviewPhrase, ScaffoldingTargetPhrase } from '../types';

const SRS_STORAGE_KEY = 'fluency_srs_flashcards_v1';
const LEGACY_REVIEW_KEY = 'savedReviewPhrases';

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
    let cards: SRSFlashcard[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cards = parsed;
      }
    }
    if (cards.length === 0) {
      cards = [...DEFAULT_SEED_CARDS];
      localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(cards));
    }

    // One-time migration of any legacy savedReviewPhrases into the unified SRS store
    const legacyRaw = localStorage.getItem(LEGACY_REVIEW_KEY);
    if (legacyRaw) {
      try {
        const legacyItems: SavedReviewPhrase[] = JSON.parse(legacyRaw);
        if (Array.isArray(legacyItems) && legacyItems.length > 0) {
          const existingPhrases = new Set(cards.map((c) => c.phrase.toLowerCase().trim()));
          const today = getTodayString();
          let migrated = false;
          for (const item of legacyItems) {
            const p = item.phrase?.trim();
            if (!p || existingPhrases.has(p.toLowerCase())) continue;
            cards.unshift({
              id: item.id || `srs-mig-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              phrase: p,
              ipa: item.ipa || '',
              context: item.usageContext || 'Saved Scorecard Upgrade',
              meaning: item.explanation || 'British phrasing upgrade',
              whatYouSaid: item.whatYouSaid,
              isUserSaved: true,
              box: 1,
              nextReviewDate: today,
              successCount: 0,
              failureCount: 0,
              scenarioTitle: item.scenarioTitle,
              translations: item.translations,
            });
            existingPhrases.add(p.toLowerCase());
            migrated = true;
          }
          if (migrated) {
            localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(cards));
          }
        }
        localStorage.removeItem(LEGACY_REVIEW_KEY);
      } catch {
        /* ignore legacy parse errors */
      }
    }

    return cards;
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

export function getUserSavedSRSCards(): SRSFlashcard[] {
  return getSRSFlashcards().filter((c) => c.isUserSaved || !c.id.startsWith('srs-seed-'));
}

export function areUpgradesSavedInSRS(upgrades: PhrasingUpgrade[]): boolean {
  if (!upgrades.length) return false;
  const existing = new Set(getSRSFlashcards().map((c) => c.phrase.toLowerCase().trim()));
  return upgrades.every((u) => existing.has(u.moreNatural.toLowerCase().trim()));
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

export function addPhrasesToSRS(
  items: (PhrasingUpgrade | SavedReviewPhrase)[],
  scenarioTitle?: string
): void {
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
    const whatYouSaid = 'whatYouSaid' in item ? item.whatYouSaid : undefined;
    const title = scenarioTitle || ('scenarioTitle' in item ? item.scenarioTitle : undefined);

    newCards.push({
      id: item.id || `srs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      phrase,
      ipa,
      context,
      meaning,
      whatYouSaid,
      isUserSaved: true,
      box: 1,
      nextReviewDate: today,
      successCount: 0,
      failureCount: 0,
      scenarioTitle: title,
    });
    existingPhrases.add(phrase.toLowerCase());
  }

  if (newCards.length > 0) {
    saveSRSFlashcards([...newCards, ...all]);
  }
}

/**
 * Returns up to `maxCount` user-saved SRS phrases formatted for Stage 1 Prep injection.
 */
export function getWarmupReviewPhrases(maxCount: number = 2): ScaffoldingTargetPhrase[] {
  const savedCards = getUserSavedSRSCards().filter((c) => c.box <= 3);
  return savedCards.slice(0, maxCount).map((card, idx) => ({
    id: `review-${card.id || idx}`,
    phrase: card.phrase,
    ipa: card.ipa || '',
    usageContext:
      card.meaning ||
      (card.whatYouSaid
        ? `From your review deck: upgrades "${card.whatYouSaid}"`
        : 'Spaced repetition review phrase'),
    originalMistake: card.whatYouSaid,
    isSpacedRepetition: true,
    translations: card.translations || {
      Spanish: 'Frase de repaso guardada',
      French: 'Phrase de révision enregistrée',
      German: 'Gespeicherte Wiederholungsphrase',
      Mandarin: '保存的复习短语',
      Portuguese: 'Frase de revisão salva',
      Japanese: '保存した復習フレーズ',
      Arabic: 'عبارة مراجعة محفوظة',
      Vietnamese: 'Cụm từ ôn tập đã lưu',
    },
  }));
}

/**
 * Exports deck cards to Anki-compatible TSV format.
 * Format: Front \t Back \t Context \t Box \t Tags
 */
export function exportDeckToAnkiTSV(cards: SRSFlashcard[]): string {
  const header = "#separator:tab\n#html:true\n#tags column:5\nFront\tBack\tContext\tBox\tTags\n";
  const rows = cards.map((c) => {
    const front = `<div style="font-size:14px;color:#64748b;margin-bottom:4px;">Challenge / Meaning:</div><div style="font-size:18px;font-weight:bold;">${c.meaning.replace(/[\t\n\r]/g, ' ')}</div>${c.scenarioTitle ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px;">Scenario: ${c.scenarioTitle.replace(/[\t\n\r]/g, ' ')}</div>` : ''}${c.whatYouSaid ? `<div style="font-size:12px;color:#dc2626;margin-top:4px;">Original: &ldquo;${c.whatYouSaid.replace(/[\t\n\r]/g, ' ')}&rdquo;</div>` : ''}`;
    const back = `<div style="font-size:20px;font-weight:bold;color:#059669;">&ldquo;${c.phrase.replace(/[\t\n\r]/g, ' ')}&rdquo;</div>${c.ipa ? `<div style="font-family:monospace;color:#64748b;margin-top:4px;">${c.ipa.replace(/[\t\n\r]/g, ' ')}</div>` : ''}`;
    const context = (c.context || 'General British English').replace(/[\t\n\r]/g, ' ');
    const box = `Box_${c.box}`;
    const tags = `FluencyAI British_English Box_${c.box}`;
    return `${front}\t${back}\t${context}\t${box}\t${tags}`;
  });
  return header + rows.join('\n');
}

/**
 * Exports deck cards to standard CSV.
 */
export function exportDeckToCSV(cards: SRSFlashcard[]): string {
  const header = "Phrase,IPA,Context,Scenario,Meaning,WhatYouSaid,Box,NextReviewDate\n";
  const escapeCsv = (str: string = '') => `"${str.replace(/"/g, '""').replace(/[\n\r]+/g, ' ')}"`;
  const rows = cards.map((c) =>
    [
      escapeCsv(c.phrase),
      escapeCsv(c.ipa || ''),
      escapeCsv(c.context || ''),
      escapeCsv(c.scenarioTitle || ''),
      escapeCsv(c.meaning || ''),
      escapeCsv(c.whatYouSaid || ''),
      c.box,
      escapeCsv(c.nextReviewDate || ''),
    ].join(',')
  );
  return header + rows.join('\n');
}

/**
 * Triggers a client-side file download of the deck.
 */
export function triggerDeckDownload(cards: SRSFlashcard[], format: 'anki' | 'csv'): void {
  const isAnki = format === 'anki';
  const content = isAnki ? exportDeckToAnkiTSV(cards) : exportDeckToCSV(cards);
  const ext = isAnki ? 'tsv' : 'csv';
  const mime = isAnki ? 'text/tab-separated-values;charset=utf-8;' : 'text/csv;charset=utf-8;';
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `fluencyai-${format}-deck-${dateStr}.${ext}`;

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
