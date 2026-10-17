// Instant British Dictionary & Audio Phonetics Service (dictionaryapi.dev + YouGlish UK)

export interface DictionaryMeaning {
  partOfSpeech: string;
  definition: string;
  example?: string;
  synonyms: string[];
}

export interface DictionaryEntry {
  word: string;
  ipa: string;
  audioUrl?: string;
  meanings: DictionaryMeaning[];
  youglishUkUrl: string;
  isFallback?: boolean;
}

const memoryCache = new Map<string, DictionaryEntry>();

export function cleanWordToken(raw: string): string {
  return raw
    .replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '')
    .trim()
    .toLowerCase();
}

export async function lookupWordDefinition(rawWord: string): Promise<DictionaryEntry> {
  const word = cleanWordToken(rawWord);
  const youglishUkUrl = `https://youglish.com/pronounce/${encodeURIComponent(word || rawWord)}/english/uk`;

  if (!word) {
    return {
      word: rawWord,
      ipa: '',
      meanings: [],
      youglishUkUrl,
      isFallback: true,
    };
  }

  const cached = memoryCache.get(word);
  if (cached) return cached;

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) throw new Error('Empty response');

    const phonetics: Array<{ text?: string; audio?: string }> = Array.isArray(first.phonetics)
      ? first.phonetics
      : [];

    // Prefer UK audio & phonetic transcription
    const ukPhonetic =
      phonetics.find((p) => p.audio && /-(uk|gb)\b/i.test(p.audio)) ||
      phonetics.find((p) => p.audio && p.audio.trim().length > 0) ||
      phonetics.find((p) => p.text && p.text.trim().length > 0);

    const ipa =
      ukPhonetic?.text ||
      first.phonetic ||
      phonetics.find((p) => p.text)?.text ||
      `/${word}/`;

    const audioUrl =
      phonetics.find((p) => p.audio && /-(uk|gb)\b/i.test(p.audio))?.audio ||
      phonetics.find((p) => p.audio && p.audio.trim().length > 0)?.audio ||
      undefined;

    const meanings: DictionaryMeaning[] = [];
    if (Array.isArray(first.meanings)) {
      for (const m of first.meanings.slice(0, 3)) {
        const defObj = Array.isArray(m.definitions) ? m.definitions[0] : null;
        if (defObj?.definition) {
          meanings.push({
            partOfSpeech: String(m.partOfSpeech || 'word'),
            definition: String(defObj.definition),
            example: defObj.example ? String(defObj.example) : undefined,
            synonyms: Array.isArray(m.synonyms) ? m.synonyms.slice(0, 4).map(String) : [],
          });
        }
      }
    }

    const entry: DictionaryEntry = {
      word: first.word || word,
      ipa,
      audioUrl,
      meanings:
        meanings.length > 0
          ? meanings
          : [
              {
                partOfSpeech: 'expression',
                definition: `Spoken English vocabulary term used in conversation.`,
                synonyms: [],
              },
            ],
      youglishUkUrl,
    };

    memoryCache.set(word, entry);
    return entry;
  } catch {
    const fallback: DictionaryEntry = {
      word,
      ipa: `/${word}/`,
      meanings: [
        {
          partOfSpeech: 'conversational term',
          definition: `Tap "Listen" to hear British pronunciation or save "${word}" to your phrasebook for memory practice.`,
          synonyms: [],
        },
      ],
      youglishUkUrl,
      isFallback: true,
    };
    return fallback;
  }
}
