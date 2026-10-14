import type { LessonPlan, HelpPhrase, RoleplayScenario } from '../types';
import { roleplayScenarios } from './mockData';

// Shared "How do I say...?" phrasebook. Keywords cover several native languages
// so a learner can type their request in their own language.
const commonHelp: HelpPhrase[] = [
  {
    id: 'h-repeat',
    keywords: ['repeat', 'repetir', 'otra vez', 'répéter', 'wiederholen', '再说', 'もう一度', 'repetir', 'نكرر', 'lặp lại'],
    english: 'Sorry, could you say that again, please?',
    ipa: '/ˈsɒr.i kʊd ju seɪ ðæt əˈɡen pliːz/',
    note: 'The most useful rescue phrase in British English — polite and natural.',
  },
  {
    id: 'h-slow',
    keywords: ['slow', 'despacio', 'lento', 'lentement', 'langsam', '慢', 'ゆっくり', 'devagar', 'ببطء', 'chậm'],
    english: 'Could you speak a little more slowly, please?',
    ipa: '/kʊd ju spiːk ə ˈlɪt.əl mɔː ˈsləʊ.li/',
    note: 'Nobody minds this request. "A little" keeps it soft.',
  },
  {
    id: 'h-mean',
    keywords: ['mean', 'significa', 'signifie', 'bedeutet', '意思', '意味', 'significado', 'يعني', 'nghĩa'],
    english: 'Sorry, what does that mean?',
    ipa: '/ˈsɒr.i wɒt dʌz ðæt miːn/',
    note: 'Add the word you did not understand: "What does \'X\' mean?"',
  },
  {
    id: 'h-think',
    keywords: ['think', 'pensar', 'momento', 'moment', 'réfléchir', 'nachdenken', '想', '考え', 'لحظة', 'suy nghĩ'],
    english: 'Let me think for a second…',
    ipa: '/let mi θɪŋk fər ə ˈsek.ənd/',
    note: 'Buys you time naturally instead of silence or "eeeh".',
  },
];

const coffeePlan: LessonPlan = {
  id: 'scenario-coffee',
  title: 'Ordering Specialty Coffee in London',
  contextLabel: 'UK Hospitality',
  persona: {
    name: 'Emma', role: 'Head Barista', avatar: '☕', accent: 'UK',
    greeting: 'Morning!', tone: 'Friendly London café',
  },
  xpReward: 25,
  minutes: 4,
  phrases: [
    {
      id: 'c1', phrase: 'Could I get a flat white, please?', ipa: '/kʊd aɪ ɡet ə flæt waɪt pliːz/',
      usageContext: 'Ordering politely — "Could I get…" is the natural UK café opener.',
      translations: { Spanish: '¿Me pone un flat white, por favor?', French: 'Je pourrais avoir un flat white, s’il vous plaît ?', Mandarin: '请给我一杯馥芮白好吗？', Portuguese: 'Pode me ver um flat white, por favor?', Japanese: 'フラットホワイトをいただけますか？', Arabic: 'هل يمكنني الحصول على فلات وايت من فضلك؟', German: 'Könnte ich einen Flat White bekommen, bitte?', Vietnamese: 'Cho tôi một ly flat white được không?' },
    },
    {
      id: 'c2', phrase: 'To take away, please.', ipa: '/tə teɪk əˈweɪ pliːz/',
      usageContext: 'British English says "take away" — Americans say "to go".',
      translations: { Spanish: 'Para llevar, por favor.', French: 'À emporter, s’il vous plaît.', Mandarin: '外带，谢谢。', Portuguese: 'Para viagem, por favor.', Japanese: '持ち帰りでお願いします。', Arabic: 'سفري من فضلك.', German: 'Zum Mitnehmen, bitte.', Vietnamese: 'Mang đi, cảm ơn.' },
    },
    {
      id: 'c3', phrase: 'Is contactless alright?', ipa: '/ɪz ˈkɒn.tækt.ləs ɔːlˈraɪt/',
      usageContext: 'Asking to pay by tapping your card or phone.',
      translations: { Spanish: '¿Puedo pagar sin contacto?', French: 'Je peux payer sans contact ?', Mandarin: '可以用感应支付吗？', Portuguese: 'Posso pagar por aproximação?', Japanese: 'タッチ決済でも大丈夫ですか？', Arabic: 'هل الدفع بدون تلامس مناسب؟', German: 'Geht kontaktlos?', Vietnamese: 'Thanh toán chạm thẻ được không?' },
    },
  ],
  aiTurns: [
    'Morning! What can I get for you today?',
    'Lovely. Is that to have in or to take away?',
    'Brilliant. That’s three pounds eighty. Card or cash?',
    'Perfect, all done. Your flat white will be ready at the end of the bar. Have a lovely day!',
  ],
  mockUserReplies: [
    'Hi, I want a flat white.',
    'Take away.',
    'I can pay with the card?',
  ],
  upgrades: [
    { id: 'u1', whatYouSaid: 'I want a flat white.', moreNatural: 'Could I get a flat white, please?', explanation: '"I want" sounds abrupt in the UK. "Could I get…" is warm and expected.', category: 'Politeness' },
    { id: 'u2', whatYouSaid: 'Take away.', moreNatural: 'To take away, please — cheers!', explanation: 'Adding "please" and a friendly "cheers" makes short answers sound natural, not curt.', category: 'Fluency' },
    { id: 'u3', whatYouSaid: 'I can pay with the card?', moreNatural: 'Is contactless alright?', explanation: 'Questions in English need inversion ("Can I…?"). Locals just ask "Is contactless alright?"', category: 'Grammar' },
  ],
  helpPhrases: commonHelp,
};

const dailyPlan: LessonPlan = {
  id: 'daily-lesson-today',
  title: 'Daily Sprint: Your First Day at a UK Office',
  contextLabel: 'UK Workplace',
  persona: {
    name: 'James', role: 'Team Lead, London', avatar: '🧑‍💼', accent: 'UK',
    greeting: 'Welcome aboard!', tone: 'Warm, professional British manager',
  },
  xpReward: 35,
  minutes: 5,
  phrases: [
    {
      id: 'd1', phrase: 'I’m keen to hit the ground running.', ipa: '/aɪm kiːn tə hɪt ðə ɡraʊnd ˈrʌn.ɪŋ/',
      usageContext: 'Showing enthusiasm to start contributing straight away.',
      translations: { Spanish: 'Tengo muchas ganas de empezar con todo.', French: 'J’ai hâte de démarrer sur les chapeaux de roue.', Mandarin: '我很想马上全力投入工作。', Portuguese: 'Estou ansioso para começar com tudo.', Japanese: 'すぐに全力で取り組みたいです。', Arabic: 'أنا متحمس للبدء بقوة فوراً.', German: 'Ich möchte sofort voll durchstarten.', Vietnamese: 'Tôi rất muốn bắt tay vào việc ngay.' },
    },
    {
      id: 'd2', phrase: 'Would you mind walking me through it?', ipa: '/wʊd ju maɪnd ˈwɔː.kɪŋ mi θruː ɪt/',
      usageContext: 'Politely asking someone to explain a process step by step.',
      translations: { Spanish: '¿Te importaría explicármelo paso a paso?', French: 'Ça vous dérangerait de m’expliquer étape par étape ?', Mandarin: '你介意一步步带我了解一下吗？', Portuguese: 'Você se importaria de me explicar passo a passo?', Japanese: '順を追って説明していただけますか？', Arabic: 'هل تمانع أن تشرح لي ذلك خطوة بخطوة؟', German: 'Würden Sie es mir Schritt für Schritt erklären?', Vietnamese: 'Anh có phiền hướng dẫn tôi từng bước không?' },
    },
    {
      id: 'd3', phrase: 'I’ll get back to you by end of day.', ipa: '/aɪl ɡet bæk tə ju baɪ end əv deɪ/',
      usageContext: 'Committing to a deadline — very common in British offices.',
      translations: { Spanish: 'Te respondo antes de que acabe el día.', French: 'Je vous reviens d’ici la fin de la journée.', Mandarin: '我今天下班前回复你。', Portuguese: 'Te dou um retorno até o fim do dia.', Japanese: '今日中にご連絡します。', Arabic: 'سأرد عليك قبل نهاية اليوم.', German: 'Ich melde mich bis Feierabend.', Vietnamese: 'Tôi sẽ phản hồi trước cuối ngày.' },
    },
  ],
  aiTurns: [
    'Welcome aboard! How are you settling in so far?',
    'Glad to hear it. We’ve got a client report due on Friday — how do you feel about jumping in?',
    'Great attitude. The reporting tool is a bit fiddly. Is there anything you’d like me to explain?',
    'Of course. Could you send me a quick summary of your first impressions later?',
    'Brilliant. Lovely to have you on the team — speak soon!',
  ],
  mockUserReplies: [
    'I am fine, everything is very good.',
    'Yes, I want to start working fast.',
    'Can you explain me the tool?',
    'Yes, I send you today.',
  ],
  upgrades: [
    { id: 'du1', whatYouSaid: 'I am fine, everything is very good.', moreNatural: 'Really well, thanks — everyone’s been lovely.', explanation: 'British small talk favours contractions and a specific, warm detail.', category: 'Fluency' },
    { id: 'du2', whatYouSaid: 'Yes, I want to start working fast.', moreNatural: 'Absolutely — I’m keen to hit the ground running.', explanation: '"Keen to" + idiom sounds confident and professional.', category: 'Natural Idiom' },
    { id: 'du3', whatYouSaid: 'Can you explain me the tool?', moreNatural: 'Would you mind walking me through the tool?', explanation: '"Explain" never takes "me" directly ("explain it to me"). "Walk me through" is the natural office phrase.', category: 'Grammar' },
    { id: 'du4', whatYouSaid: 'Yes, I send you today.', moreNatural: 'Sure — I’ll get back to you by end of day.', explanation: 'Use "I’ll" for promises about the future.', category: 'Grammar' },
  ],
  helpPhrases: commonHelp,
};

/** Fallback builder: turns any existing scenario into a full LessonPlan */
function buildPlanFromScenario(s: RoleplayScenario): LessonPlan {
  const phrases = s.keyVocabulary.slice(0, 3).map((v, i) => ({
    id: `${s.id}-p${i}`,
    phrase: v.example,
    ipa: v.ipa,
    usageContext: v.tip ?? `Key phrase using "${v.word}".`,
    translations: v.translations,
  }));
  // Top up to 3 phrases using suggested responses
  const extra = s.dialogueFlow.flatMap((d) => d.suggestedResponses ?? []);
  while (phrases.length < 3 && extra.length) {
    const p = extra.shift()!;
    phrases.push({ id: `${s.id}-x${phrases.length}`, phrase: p, ipa: '', usageContext: 'Model answer for this scenario.', translations: {} as never });
  }

  const aiTurns = [s.aiPersona.greeting, ...s.dialogueFlow.map((d) => d.message)];
  aiTurns.push('Thank you, that was really helpful. Have a great day!');

  return {
    id: s.id,
    title: s.title,
    contextLabel: s.category,
    persona: s.aiPersona,
    xpReward: 25,
    minutes: s.durationMinutes,
    phrases,
    aiTurns,
    mockUserReplies: ['Yes, I want this please.', 'I am agree with you.', 'Thank you very much for all.'],
    upgrades: [
      { id: `${s.id}-u1`, whatYouSaid: 'Yes, I want this please.', moreNatural: 'Yes, that would be great, thanks.', explanation: '"I want" can sound demanding; "that would be great" is softer.', category: 'Politeness' },
      { id: `${s.id}-u2`, whatYouSaid: 'I am agree with you.', moreNatural: 'I completely agree.', explanation: '"Agree" is a verb — no "am" needed.', category: 'Grammar' },
      { id: `${s.id}-u3`, whatYouSaid: 'Thank you very much for all.', moreNatural: 'Thanks so much for your help.', explanation: '"For all" is a direct translation; "for your help" is natural.', category: 'Natural Idiom' },
    ],
    helpPhrases: commonHelp,
  };
}

export function getLessonPlanForScenario(scenarioId: string): LessonPlan {
  if (scenarioId === coffeePlan.id) return coffeePlan;
  const s = roleplayScenarios.find((x) => x.id === scenarioId);
  return s ? buildPlanFromScenario(s) : dailyPlan;
}

export function getDailyLessonPlan(): LessonPlan {
  return dailyPlan;
}
