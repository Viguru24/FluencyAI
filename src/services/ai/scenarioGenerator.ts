// CEFR Placement Assessment Evaluator & Custom Scenario Generator
import type {
  AIPersona,
  CEFRLevel,
  LessonPlan,
  NativeLanguage,
  PhrasingUpgrade,
  PlacementAssessmentResult,
  RoleplayScenario,
  ScaffoldingTargetPhrase,
} from '../../types';
import { getLLMConfig } from '../llmConfig';
import { requestStructuredJSON } from './aiClient';

export async function evaluatePlacementAssessment(
  userTurns: string[]
): Promise<PlacementAssessmentResult> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;

  const turn1 = userTurns[0] || '';
  const turn2 = userTurns[1] || '';
  const turn3 = userTurns[2] || '';

  const computeFallbackAssessment = (): PlacementAssessmentResult => {
    const combined = `${turn1} ${turn2} ${turn3}`.trim();
    const words = combined.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    const connectors = [
      'because', 'although', 'however', 'furthermore', 'whereas',
      'therefore', 'while', 'since', 'despite', 'in order to', 'as well as'
    ];
    const complexConnectorsFound = connectors.filter((c) =>
      new RegExp(`\\b${c}\\b`, 'i').test(combined)
    );

    const modalsAndConditionals = ['would', 'could', 'should', 'might', 'have been', 'had been', 'if'];
    const modalsFound = modalsAndConditionals.filter((m) =>
      new RegExp(`\\b${m}\\b`, 'i').test(combined)
    );

    let level: CEFRLevel = 'B1';
    let title = 'B1 — Intermediate';
    let fluencyScore = 75;
    let grammarScore = 76;
    let summary = 'You communicate clearly in everyday conversations and can describe past experiences and opinions effectively.';
    const strengths: string[] = ['Good functional vocabulary', 'Clear turn-taking and communicative intent'];
    const recommendations: string[] = ['Work on using more complex sentence connectors', 'Incorporate more authentic British idioms'];

    if (wordCount >= 65 && complexConnectorsFound.length >= 2 && modalsFound.length >= 2) {
      level = 'C1';
      title = 'C1 — Advanced Spoken Fluency';
      fluencyScore = 92;
      grammarScore = 90;
      summary = 'Exceptional spoken command. You express complex thoughts, hypotheses, and professional perspectives with natural rhythm and rich lexical variety.';
      strengths.push('Sophisticated sentence structures', 'Natural topic elaboration and nuanced vocabulary');
      recommendations.length = 0;
      recommendations.push('Refine subtle British understatement and executive tone', 'Master specialized industry idioms');
    } else if (wordCount >= 38 || (complexConnectorsFound.length >= 1 && modalsFound.length >= 1)) {
      level = 'B2';
      title = 'B2 — Upper Intermediate';
      fluencyScore = 84;
      grammarScore = 82;
      summary = 'Strong conversational ability. You handle narrative questions and abstract topics smoothly with good grammatical consistency and clear expression.';
      strengths.push('Solid grasp of past tenses and connectors', 'Effective self-expression across varied topics');
      recommendations.length = 0;
      recommendations.push('Practice complex conditional clauses (e.g. "If I had known, I would have...")', 'Expand your repertoire of natural British phrasal verbs');
    } else if (wordCount >= 18) {
      level = 'B1';
      title = 'B1 — Intermediate';
      fluencyScore = 74;
      grammarScore = 72;
      summary = 'Good communicative foundation. You answer direct questions clearly and express personal routines and challenges with recognizable confidence.';
      strengths.push('Clear message delivery', 'Good basic vocabulary for daily life and work');
      recommendations.push('Practice linking ideas with "although", "whereas", and "furthermore"', 'Focus on past tense regularity and preposition accuracy');
    } else if (wordCount >= 8) {
      level = 'A2';
      title = 'A2 — Elementary';
      fluencyScore = 65;
      grammarScore = 64;
      summary = 'You can communicate basic facts and familiar information with simple sentence structures. With regular speaking practice, you will build conversational stamina quickly.';
      strengths.push('Willingness to speak and share basic details', 'Good understanding of everyday prompts');
      recommendations.length = 0;
      recommendations.push('Build confidence combining two thoughts with "and", "but", and "because"', 'Expand high-frequency workplace vocabulary');
    } else {
      level = 'A1';
      title = 'A1 — Beginner';
      fluencyScore = 55;
      grammarScore = 58;
      summary = 'Welcome! You are starting your English journey. We will keep vocabulary simple, focus on high-frequency everyday phrases, and build your confidence step by step.';
      strengths.push('Great initial effort taking the speaking assessment', 'Familiarity with basic English greetings');
      recommendations.length = 0;
      recommendations.push('Master key polite phrases ("Could I have...", "Please", "Thank you")', 'Practice short 3-word sentences daily');
    }

    return {
      level,
      title,
      summary,
      fluencyScore,
      grammarScore,
      strengths,
      recommendations,
      assessedAt: new Date().toISOString(),
    };
  };

  if (!apiKey || userTurns.length === 0 || userTurns.every((t) => t.trim().length === 0)) {
    return computeFallbackAssessment();
  }

  const prompt = `You are a Senior British English CEFR Examiner (Cambridge & IELTS oral assessment specialist).
Evaluate this new student's 3 spoken placement assessment answers and assign their exact CEFR level (A1, A2, B1, B2, or C1).

Student's 3 spoken placement responses:
1. Question 1 (Personal intro & daily life): "${turn1}"
2. Question 2 (Past challenge & resolution): "${turn2}"
3. Question 3 (Perspective on AI & technology impact): "${turn3}"

CEFR Grading Criteria:
- A1 (Beginner): Very brief utterances, isolated words, basic present tense fragments, significant hesitations.
- A2 (Elementary): Simple sentences on familiar topics, basic past/present, limited connectors (and, but).
- B1 (Intermediate): Connected narrative flow, clear description of past events/plans, standard workplace vocabulary, understandable grammar with minor slips.
- B2 (Upper Intermediate): Spontaneous fluid speech, good lexical range, effective connectors (however, although, whereas), confident abstract reasoning.
- C1 (Advanced): Highly articulate, complex clauses, natural British idioms, subtle nuance, precise arguments.

Return strictly valid JSON conforming to this schema:
{
  "level": "A1" | "A2" | "B1" | "B2" | "C1",
  "title": "<e.g., 'B2 — Upper Intermediate'>",
  "summary": "<2-3 encouraging sentences summarizing their spoken fluency, vocabulary breadth, and sentence structure>",
  "fluencyScore": <number between 50 and 98>,
  "grammarScore": <number between 50 and 98>,
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "recommendations": ["<practical coaching recommendation 1>", "<practical coaching recommendation 2>"]
}`;

  try {
    const parsed = await requestStructuredJSON<any>({
      systemInstruction:
        'You are an expert Cambridge/IELTS CEFR examiner. Output only strictly valid JSON matching the requested schema with no commentary or markdown backticks.',
      prompt,
      temperature: 0.2,
      maxTokens: 600,
    });

    if (!parsed) return computeFallbackAssessment();

    const validLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const level: CEFRLevel = validLevels.includes(parsed.level) ? parsed.level : 'B1';

    return {
      level,
      title: parsed.title || `${level} — Assessed Level`,
      summary: parsed.summary || 'Solid speaking performance across the placement assessment.',
      fluencyScore: typeof parsed.fluencyScore === 'number' ? Math.max(50, Math.min(100, Math.round(parsed.fluencyScore))) : 80,
      grammarScore: typeof parsed.grammarScore === 'number' ? Math.max(50, Math.min(100, Math.round(parsed.grammarScore))) : 78,
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : ['Clear message delivery', 'Good communicative intent'],
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0 ? parsed.recommendations : ['Focus on sentence linking', 'Practice natural British idioms'],
      assessedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[scenarioGenerator] Placement evaluation fallback used:', e);
    return computeFallbackAssessment();
  }
}

export async function generateCustomScenario(
  topicPrompt: string,
  level: CEFRLevel = 'B1',
  persona: AIPersona,
  nativeLang: NativeLanguage = 'Spanish',
  documentContext?: string
): Promise<{ scenario: RoleplayScenario; plan: LessonPlan }> {
  const config = getLLMConfig();
  const apiKey = config.apiKey;
  const safeTopic = topicPrompt.trim() || 'Ordering afternoon tea in Covent Garden';
  const scenarioId = `custom-${Date.now()}`;

  const createFallback = (): { scenario: RoleplayScenario; plan: LessonPlan } => {
    const title = safeTopic.length > 45 ? `${safeTopic.slice(0, 42)}...` : safeTopic;
    const plan: LessonPlan = {
      id: scenarioId,
      title: `Custom: ${title}`,
      contextLabel: 'Real-World Practice',
      persona,
      xpReward: 45,
      minutes: 6,
      phrases: [
        {
          id: `${scenarioId}-p1`,
          phrase: "I was wondering if you might be able to help me with this?",
          ipa: "/aɪ wəz ˈwʌndərɪŋ ɪf juː maɪt biː ˈeɪbl tuː hɛlp miː wɪð ðɪs/",
          usageContext: "A polite, understated British opening for making any request.",
          translations: { [nativeLang]: "Me preguntaba si podría ayudarme con esto." } as any,
        },
        {
          id: `${scenarioId}-p2`,
          phrase: "Could you possibly clarify how that works in practice?",
          ipa: "/kʊd juː ˈpɒsəbli ˈklærɪfaɪ haʊ ðæt wɜːks ɪn ˈpræktɪs/",
          usageContext: "Asking for specific details without sounding confrontational.",
          translations: { [nativeLang]: "¿Podría aclarar cómo funciona eso en la práctica?" } as any,
        },
        {
          id: `${scenarioId}-p3`,
          phrase: "That makes complete sense — I appreciate you sorting that out.",
          ipa: "/ðæt meɪks kəmˈpliːt sɛns — aɪ əˈpriːʃieɪt juː ˈsɔːtɪŋ ðæt aʊt/",
          usageContext: "A gracious British closing showing appreciation.",
          translations: { [nativeLang]: "Tiene todo el sentido, le agradezco que lo haya solucionado." } as any,
        },
      ],
      aiTurns: [
        `Hello there! I understand we are working on: "${title}". How can I assist you today?`,
        "That's completely understandable. Could you tell me a little more about what outcome you're hoping for?",
        "Spot on. I'll make sure that's taken care of right away. Anything else before you head off?",
      ],
      mockUserReplies: [
        "I was wondering if you might be able to help me with this?",
        "Could you possibly clarify how that works in practice?",
        "That makes complete sense — I appreciate you sorting that out.",
      ],
      upgrades: [
        {
          id: `${scenarioId}-u1`,
          whatYouSaid: "Help me please.",
          moreNatural: "I was wondering if you might be able to help me?",
          explanation: "In British English, soft modal openings sound much warmer and more courteous.",
          category: 'Politeness',
        },
        {
          id: `${scenarioId}-u2`,
          whatYouSaid: "Explain this more.",
          moreNatural: "Could you possibly clarify how that works in practice?",
          explanation: "Using 'could you possibly' softens direct imperatives elegantly.",
          category: 'Natural Idiom',
        },
      ],
      helpPhrases: [
        {
          id: `${scenarioId}-h1`,
          keywords: ['help', 'start', 'begin', 'polite'],
          english: "I was wondering if you might be able to help me?",
          ipa: "/aɪ wəz ˈwʌndərɪŋ ɪf juː maɪt biː ˈeɪbl tuː hɛlp miː/",
          note: "Standard courteous opener",
        },
      ],
    };

    const scenario: RoleplayScenario = {
      id: scenarioId,
      title: `Custom: ${title}`,
      tagline: `Interactive practice: ${safeTopic}`,
      category: 'Daily Life',
      cefrLevel: level,
      durationMinutes: 6,
      aiPersona: persona,
      description: `Tailored roleplay created to practice: "${safeTopic}". Calibrated for ${level} CEFR learners.`,
      learningGoals: [
        'Master polite British conversational framing',
        'Express personal preferences with confidence',
        'Handle follow-up questions smoothly',
      ],
      keyVocabulary: [
        {
          word: 'wondering',
          ipa: '/ˈwʌndərɪŋ/',
          partOfSpeech: 'verb (polite softener)',
          translations: { [nativeLang]: 'preguntándose' } as any,
          example: 'I was wondering if you had a moment?',
        },
        {
          word: 'clarify',
          ipa: '/ˈklærɪfaɪ/',
          partOfSpeech: 'verb',
          translations: { [nativeLang]: 'aclarar' } as any,
          example: 'Could you clarify the deadline for us?',
        },
      ],
      dialogueFlow: [
        {
          step: 1,
          speaker: 'ai',
          message: `Hello! I understand you wanted to go over: "${title}". How can I help today?`,
        },
        {
          step: 2,
          speaker: 'user',
          message: 'I was wondering if you might be able to help me with this?',
        },
      ],
      badgeColor: 'bg-gradient-to-r from-teal-500 to-indigo-600',
      gradient: 'from-teal-600 via-indigo-600 to-purple-700',
    };

    return { scenario, plan };
  };

  if (!apiKey) {
    return createFallback();
  }

  const safeDoc = documentContext?.trim() ? documentContext.trim().slice(0, 3500) : '';
  const docInstruction = safeDoc
    ? `\n\nGROUNDING DOCUMENT (e.g. User Resume, Job Spec, Meeting Notes, Project Brief):\n"""\n${safeDoc}\n"""\nIMPORTANT: Deeply personalize this scenario, roleplay AI turns, target phrases, and context to directly reflect the requirements, terminology, background, and specific topics mentioned in the document above.\n`
    : '';

  const prompt = `You are a premier British English curriculum designer.
Generate a structured, authentic CEFR ${level} roleplay scenario and 3-phrase lesson plan for this situation:
"${safeTopic}"
Persona: ${persona.name} (${persona.role}, Tone: ${persona.tone}).
Learner Native Language: ${nativeLang}.${docInstruction}

Output STRICTLY valid JSON only (no markdown, no backticks, no thinking):
{
  "title": "<Concise 3-6 word British scenario title>",
  "tagline": "<Snappy one-sentence scenario hook>",
  "category": "Daily Life" | "Career & Tech" | "Travel" | "Social" | "Healthcare",
  "learningGoals": ["<goal 1>", "<goal 2>", "<goal 3>"],
  "phrases": [
    {
      "phrase": "<Target phrase 1 in authentic British English>",
      "ipa": "<IPA transcription>",
      "usageContext": "<When and why to use it>",
      "translation": "<Translation in ${nativeLang}>"
    },
    {
      "phrase": "<Target phrase 2>",
      "ipa": "<IPA>",
      "usageContext": "<Context>",
      "translation": "<Translation>"
    },
    {
      "phrase": "<Target phrase 3>",
      "ipa": "<IPA>",
      "usageContext": "<Context>",
      "translation": "<Translation>"
    }
  ],
  "aiTurns": [
    "<AI opening turn welcoming the user into character>",
    "<AI second turn responding to user's first query>",
    "<AI third turn concluding the interaction warmly>"
  ],
  "upgrades": [
    {
      "whatYouSaid": "<Common clumsy or direct non-native phrase>",
      "moreNatural": "<Polished natural British phrasing>",
      "explanation": "<Why British speakers phrase it this way>",
      "category": "Politeness" | "Natural Idiom" | "Grammar" | "Fluency"
    },
    {
      "whatYouSaid": "<Another common non-native phrasing>",
      "moreNatural": "<More natural British upgrade>",
      "explanation": "<Pedagogical tip>",
      "category": "Natural Idiom"
    }
  ]
}`;

  try {
    const parsed = await requestStructuredJSON<any>({
      systemInstruction: 'You are an expert Cambridge English curriculum architect. Output ONLY valid JSON.',
      prompt,
      temperature: 0.3,
      maxTokens: 800,
    });

    if (!parsed) return createFallback();

    const title = parsed.title || safeTopic;
    const phrases: ScaffoldingTargetPhrase[] = Array.isArray(parsed.phrases)
      ? parsed.phrases.slice(0, 3).map((p: any, idx: number) => ({
          id: `${scenarioId}-p${idx + 1}`,
          phrase: String(p.phrase || '').trim(),
          ipa: String(p.ipa || '').trim(),
          usageContext: String(p.usageContext || 'Essential British conversational phrasing').trim(),
          translations: { [nativeLang]: String(p.translation || '').trim() } as any,
        }))
      : createFallback().plan.phrases;

    const aiTurns: string[] = Array.isArray(parsed.aiTurns) && parsed.aiTurns.length >= 2
      ? parsed.aiTurns.map((t: any) => String(t).trim())
      : createFallback().plan.aiTurns;

    const upgrades: PhrasingUpgrade[] = Array.isArray(parsed.upgrades)
      ? parsed.upgrades.map((u: any, idx: number) => ({
          id: `${scenarioId}-u${idx + 1}`,
          whatYouSaid: String(u.whatYouSaid || 'Can you help me?').trim(),
          moreNatural: String(u.moreNatural || 'I was wondering if you might be able to help?').trim(),
          explanation: String(u.explanation || 'British phrasing softens requests with courteous modals.').trim(),
          category: (['Politeness', 'Natural Idiom', 'Grammar', 'Fluency'].includes(u.category)
            ? u.category
            : 'Natural Idiom') as PhrasingUpgrade['category'],
        }))
      : createFallback().plan.upgrades;

    const plan: LessonPlan = {
      id: scenarioId,
      title,
      contextLabel: 'Custom Situation',
      persona,
      xpReward: 50,
      minutes: 6,
      phrases,
      aiTurns,
      mockUserReplies: phrases.map((p) => p.phrase),
      upgrades,
      helpPhrases: [
        {
          id: `${scenarioId}-h1`,
          keywords: ['help', 'repeat', 'start'],
          english: phrases[0]?.phrase || "I was wondering if you might be able to help me?",
          ipa: phrases[0]?.ipa || "/aɪ wəz ˈwʌndərɪŋ/",
          note: "Polite opening",
        },
      ],
    };

    const scenario: RoleplayScenario = {
      id: scenarioId,
      title,
      tagline: parsed.tagline || `Real-world practice: ${safeTopic}`,
      category: (['Daily Life', 'Career & Tech', 'Travel', 'Social', 'Healthcare'].includes(parsed.category)
        ? parsed.category
        : 'Daily Life') as RoleplayScenario['category'],
      cefrLevel: level,
      durationMinutes: 6,
      aiPersona: persona,
      description: `Practicing: "${safeTopic}". Calibrated for ${level} level.`,
      learningGoals: Array.isArray(parsed.learningGoals) && parsed.learningGoals.length > 0
        ? parsed.learningGoals
        : ['Master conversational composure', 'Learn natural British phrasing', 'Express ideas fluently'],
      keyVocabulary: phrases.map((p) => ({
        word: p.phrase.split(/\s+/).slice(0, 2).join(' '),
        ipa: p.ipa,
        partOfSpeech: 'phrase',
        translations: p.translations as any,
        example: p.phrase,
      })),
      dialogueFlow: aiTurns.map((turn, i) => ({
        step: i + 1,
        speaker: 'ai' as const,
        message: turn,
      })),
      badgeColor: 'bg-gradient-to-r from-emerald-500 to-indigo-600',
      gradient: 'from-emerald-600 via-teal-600 to-indigo-700',
    };

    return { scenario, plan };
  } catch (err) {
    console.warn('[scenarioGenerator] Custom scenario generation error, using fallback:', err);
    return createFallback();
  }
}
