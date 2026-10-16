import type { LessonPlan, HelpPhrase, RoleplayScenario } from '../types';
import { roleplayScenarios } from './mockData';
import { getWarmupReviewPhrases } from '../services/srsService';

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

export const dailyPlan: LessonPlan = {
  id: 'daily-lesson-today',
  title: 'Daily Sprint: Your First Day at a UK Office',
  contextLabel: 'UK Workplace',
  persona: {
    name: 'James',
    role: 'Team Lead, London',
    avatar: '🧑‍💼',
    accent: 'UK',
    greeting: 'Welcome aboard!',
    tone: 'Warm, professional British manager',
  },
  xpReward: 35,
  minutes: 5,
  phrases: [
    {
      id: 'd1',
      phrase: 'I’m keen to hit the ground running.',
      ipa: '/aɪm kiːn tə hɪt ðə ɡraʊnd ˈrʌn.ɪŋ/',
      usageContext: 'Showing enthusiasm to start contributing straight away.',
      translations: {
        Spanish: 'Tengo muchas ganas de empezar con todo.',
        French: 'J’ai hâte de démarrer sur les chapeaux de roue.',
        Mandarin: '我很想马上全力投入工作。',
        Portuguese: 'Estou ansioso para começar com tudo.',
        Japanese: 'すぐに全力で取り組みたいです。',
        Arabic: 'أنا متحمس للبدء بقوة فوراً.',
        German: 'Ich möchte sofort voll durchstarten.',
        Vietnamese: 'Tôi rất muốn bắt tay vào việc ngay.',
      },
    },
    {
      id: 'd2',
      phrase: 'Would you mind walking me through it?',
      ipa: '/wʊd ju maɪnd ˈwɔː.kɪŋ mi θruː ɪt/',
      usageContext: 'Politely asking someone to explain a process step by step.',
      translations: {
        Spanish: '¿Te importaría explicármelo paso a paso?',
        French: 'Ça vous dérangerait de m’expliquer étape par étape ?',
        Mandarin: '你介意一步步带我了解一下吗？',
        Portuguese: 'Você se importaria de me explicar passo a passo?',
        Japanese: '順を追って説明していただけますか？',
        Arabic: 'هل تمانع أن تشرح لي ذلك خطوة بخطوة؟',
        German: 'Würden Sie es mir Schritt für Schritt erklären?',
        Vietnamese: 'Anh có phiền hướng dẫn tôi từng bước không?',
      },
    },
    {
      id: 'd3',
      phrase: 'I’ll get back to you by end of day.',
      ipa: '/aɪl ɡet bæk tə ju baɪ end əv deɪ/',
      usageContext: 'Committing to a deadline — very common in British offices.',
      translations: {
        Spanish: 'Te respondo antes de que acabe el día.',
        French: 'Je vous reviens d’ici la fin de la journée.',
        Mandarin: '我今天下班前回复你。',
        Portuguese: 'Te dou um retorno até o fim do dia.',
        Japanese: '今日中にご連絡します。',
        Arabic: 'سأرد عليك قبل نهاية اليوم.',
        German: 'Ich melde mich bis Feierabend.',
        Vietnamese: 'Tôi sẽ phản hồi trước cuối ngày.',
      },
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
    {
      id: 'du1',
      whatYouSaid: 'I am fine, everything is very good.',
      moreNatural: 'Really well, thanks — everyone’s been lovely.',
      explanation: 'British small talk favours contractions and a specific, warm detail.',
      category: 'Fluency',
    },
    {
      id: 'du2',
      whatYouSaid: 'Yes, I want to start working fast.',
      moreNatural: 'Absolutely — I’m keen to hit the ground running.',
      explanation: '"Keen to" + idiom sounds confident and professional.',
      category: 'Natural Idiom',
    },
    {
      id: 'du3',
      whatYouSaid: 'Can you explain me the tool?',
      moreNatural: 'Would you mind walking me through the tool?',
      explanation: '"Explain" never takes "me" directly ("explain it to me"). "Walk me through" is the natural office phrase.',
      category: 'Grammar',
    },
    {
      id: 'du4',
      whatYouSaid: 'Yes, I send you today.',
      moreNatural: 'Sure — I’ll get back to you by end of day.',
      explanation: 'Use "I’ll" for promises about the future.',
      category: 'Grammar',
    },
  ],
  helpPhrases: commonHelp,
  gradingRubric: 'Focus: British workplace diplomacy, polite requests ("Would you mind..."), proactive professional idioms ("hit the ground running"), commitments ("by end of day"), and collaborative London office small talk.',
};

export const nhsHandoverPlan: LessonPlan = {
  id: 'scenario-nhs-handover',
  title: 'UK Healthcare & NHS Handover',
  contextLabel: 'UK Healthcare',
  persona: {
    name: 'Dr. Patel',
    role: 'Senior Consultant, NHS Trust',
    avatar: '🩺',
    accent: 'UK',
    greeting: 'Good morning. I understand you have an SBAR handover for Bed 4 in Acute Assessment. Whenever you are ready, doctor.',
    tone: 'Authoritative yet supportive NHS consultant',
  },
  xpReward: 35,
  minutes: 5,
  phrases: [
    {
      id: 'nhs1',
      phrase: 'I’m calling to give an SBAR handover regarding the patient in bed four.',
      ipa: '/aɪm ˈkɔː.lɪŋ tə ɡɪv ən ˈes.bɑː ˈhændˌəʊ.vər rɪˈɡɑː.dɪŋ ðə ˈpeɪ.ʃənt ɪn bed fɔː/',
      usageContext: 'Introducing an NHS clinical handover using Situation, Background, Assessment, Recommendation.',
      translations: {
        Spanish: 'Llamo para dar un traspaso SBAR sobre el paciente de la cama cuatro.',
        French: 'Je vous appelle pour une transmission SBAR concernant le patient du lit quatre.',
        Mandarin: '我打电话使用SBAR交接四号病床的患者情况。',
        Portuguese: 'Estou ligando para passar o plantão SBAR do paciente no leito quatro.',
        Japanese: '4床の患者についてSBAR形式で申し送りいたします。',
        Arabic: 'أتصل لتسليم تقرير SBAR السريري بخصوص المريض في السرير رقم أربعة.',
        German: 'Ich rufe an, um eine SBAR-Übergabe für den Patienten in Bett vier zu machen.',
        Vietnamese: 'Tôi gọi để bàn giao ca SBAR về bệnh nhân ở giường số bốn.',
      },
    },
    {
      id: 'nhs2',
      phrase: 'The patient is deteriorating; observations show a spike in their NEWS score.',
      ipa: '/ðə ˈpeɪ.ʃənt ɪz dɪˈtɪə.ri.ə.reɪ.tɪŋ ˌɒb.zəˈveɪ.ʃənz ʃəʊ ə spaɪk ɪn ðeə njuːz skɔː/',
      usageContext: 'Flagging clinical escalation and National Early Warning Score (NEWS) in the UK.',
      translations: {
        Spanish: 'El paciente se está deteriorando; las constantes muestran una subida en su puntuación NEWS.',
        French: 'L’état du patient se détériore ; les constantes indiquent une hausse de son score NEWS.',
        Mandarin: '患者病情恶化；监测数据显示其NEWS早期预警评分骤增。',
        Portuguese: 'O paciente está piorando; os sinais vitais mostram elevação no escore NEWS.',
        Japanese: '患者の容態が悪化しています。バイタル測定でNEWSスコアが上昇しています。',
        Arabic: 'حالة المريض تتدهور؛ وتظهر المؤشرات الحيوية ارتفاعاً حاداً في نقاط تقييم الإنذار المبكر NEWS.',
        German: 'Der Zustand des Patienten verschlechtert sich; die Vitalwerte zeigen einen Anstieg des NEWS-Scores.',
        Vietnamese: 'Bệnh nhân đang chuyển biến xấu; các chỉ số cho thấy điểm cảnh báo sớm NEWS tăng vọt.',
      },
    },
    {
      id: 'nhs3',
      phrase: 'I’d recommend an urgent review and prescribing broad-spectrum IV antibiotics.',
      ipa: '/aɪd ˌrek.əˈmend ən ˈɜː.dʒənt rɪˈvjuː ənd prɪˈskraɪ.bɪŋ brɔːd ˈspek.trəm ˌaɪ.viː ˌæn.ti.baɪˈɒt.ɪks/',
      usageContext: 'Delivering a clear clinical Recommendation (the R in SBAR) to the senior consultant.',
      translations: {
        Spanish: 'Recomendaría una revisión urgente y prescribir antibióticos intravenosos de amplio espectro.',
        French: 'Je recommanderais une réévaluation urgente et la prescription d’antibiotiques IV à large spectre.',
        Mandarin: '我建议进行紧急会诊，并开具广谱静脉抗生素。',
        Portuguese: 'Recomendo uma avaliação urgente e prescrição de antibióticos intravenosos de amplo espectro.',
        Japanese: '至急の診察と広域スペクトル点滴抗菌薬の処方を推奨いたします。',
        Arabic: 'أوصي بإجراء فحص سريري عاجل وصرف مضادات حيوية وريدية واسعة النطاق.',
        German: 'Ich empfehle eine dringende Visite und die Gabe von Breitspektrum-IV-Antibiotika.',
        Vietnamese: 'Tôi đề xuất khám khẩn cấp và kê kháng sinh tiêm tĩnh mạch phổ rộng.',
      },
    },
  ],
  aiTurns: [
    'Good morning. I understand you have an SBAR handover for Bed 4 in Acute Assessment. Whenever you are ready, doctor.',
    'Thank you. What is the background and how are the patient’s vital signs tracking on the NEWS chart?',
    'Understood. What is your clinical assessment, and what complications are you most concerned about right now?',
    'Decisive thinking. What is your concrete recommendation and immediate action plan before I arrive?',
    'Splendid handover, doctor. Clear, structured SBAR with compassionate attention to patient safety. I will be on the ward in five minutes.',
  ],
  mockUserReplies: [
    'I am calling to tell you about bed four patient.',
    'He is very sick and his score is high.',
    'I think he has sepsis and bad chest infection.',
    'Can you come urgently to see him and give antibiotic?',
  ],
  upgrades: [
    {
      id: 'nhsu1',
      whatYouSaid: 'I am calling to tell you about bed four patient.',
      moreNatural: 'I’m calling to give an SBAR handover regarding the patient in bed four.',
      explanation: 'In the NHS, structuring with "give an SBAR handover regarding..." immediately primes the consultant with standard clinical protocol.',
      category: 'Fluency',
    },
    {
      id: 'nhsu2',
      whatYouSaid: 'He is very sick and his score is high.',
      moreNatural: 'The patient is deteriorating; observations show a spike in their NEWS score.',
      explanation: 'Use clinical terminology ("deteriorating", "observations", "NEWS score") rather than vague expressions like "very sick".',
      category: 'Grammar',
    },
    {
      id: 'nhsu3',
      whatYouSaid: 'I think he has sepsis and bad chest infection.',
      moreNatural: 'My assessment is suspected sepsis secondary to a lower respiratory tract infection.',
      explanation: 'Consultants expect formal diagnostic phrasing ("secondary to", "lower respiratory tract infection") in UK medical handovers.',
      category: 'Natural Idiom',
    },
    {
      id: 'nhsu4',
      whatYouSaid: 'Can you come urgently to see him and give antibiotic?',
      moreNatural: 'I’d recommend an urgent review and prescribing broad-spectrum IV antibiotics.',
      explanation: 'The "R" in SBAR stands for Recommendation: frame requests assertively as "I’d recommend an urgent review".',
      category: 'Politeness',
    },
  ],
  helpPhrases: commonHelp,
  gradingRubric: 'Focus: SBAR clinical handover protocol (Situation, Background, Assessment, Recommendation), clinical escalation clarity (NEWS score, vitals, objective terminology), decisive yet collaborative tone, patient safety prioritization, and empathetic British medical professional register.',
};

export const hospitalityPlan: LessonPlan = {
  id: 'scenario-hospitality-venue',
  title: 'UK Hospitality & Venue Management',
  contextLabel: 'UK Hospitality',
  persona: {
    name: 'Sarah',
    role: 'Front-of-House Manager',
    avatar: '🛎️',
    accent: 'UK',
    greeting: 'Good evening! Welcome to the Mayfair Pavilion. Have you got a reservation with us tonight?',
    tone: 'Poised, warm, attentive British hospitality manager',
  },
  xpReward: 30,
  minutes: 4,
  phrases: [
    {
      id: 'hosp1',
      phrase: 'Does anyone in your party have any severe allergies or dietary requirements?',
      ipa: '/dʌz ˈen.i.wʌn ɪn jɔː ˈpɑː.ti hæv ˈen.i sɪˈvɪər ˈæl.ə.dʒiz ɔː ˌdaɪ.əˈter.i rɪˈkwaɪə.mənts/',
      usageContext: 'Standard proactive allergen check required by UK hospitality safety standards.',
      translations: {
        Spanish: '¿Alguien en su mesa tiene alergias graves o necesidades dietéticas?',
        French: 'Quelqu’un à votre table a-t-il des allergies sévères ou un régime alimentaire particulier ?',
        Mandarin: '请问您同行人员中有任何严重过敏或特殊饮食需求吗？',
        Portuguese: 'Alguém no seu grupo tem alergias graves ou restrições alimentares?',
        Japanese: 'お連れ様の中に深刻なアレルギーや食事制限をお持ちの方はいらっしゃいますか？',
        Arabic: 'هل لدى أي شخص في مجموعتكم أي حساسية شديدة أو متطلبات غذائية خاصة؟',
        German: 'Gibt es in Ihrer Runde schwere Allergien oder besondere Ernährungswünsche?',
        Vietnamese: 'Trong bàn của quý khách có ai bị dị ứng nghiêm trọng hay ăn kiêng không ạ?',
      },
    },
    {
      id: 'hosp2',
      phrase: 'I’d be more than happy to double-check with the head chef for you.',
      ipa: '/aɪd bi mɔː ðæn ˈhæp.i tə ˌdʌb.əl ˈtʃek wɪð ðə hed ʃef fər ju/',
      usageContext: 'Gracious British service idiom assuring guests of personalized culinary safety.',
      translations: {
        Spanish: 'Estaré más que encantado de comprobarlo con el jefe de cocina para usted.',
        French: 'Je me ferai un plaisir de vérifier directement auprès du chef de cuisine pour vous.',
        Mandarin: '我非常乐意为您向主厨当面确认。',
        Portuguese: 'Terei o maior prazer em confirmar pessoalmente com o chef executivo para você.',
        Japanese: '料理長に喜んで直接確認させていただきます。',
        Arabic: 'يسعدني جداً أن أتأكد بنفسي من الشيف الرئيسي من أجلكم.',
        German: 'Ich frage sehr gerne noch einmal beim Küchenchef für Sie nach.',
        Vietnamese: 'Tôi rất sẵn lòng kiểm tra lại trực tiếp với bếp trưởng giúp quý khách.',
      },
    },
    {
      id: 'hosp3',
      phrase: 'I do apologise for the delay — please allow us to comp your first round of drinks.',
      ipa: '/aɪ duː əˈpɒl.ə.dʒaɪz fər ðə dɪˈleɪ pliːz əˈlaʊ ʌs tə kɒmp jɔː fɜːst raʊnd əv drɪŋks/',
      usageContext: 'Polite British de-escalation idiom ("comp" = complimentary / on the house).',
      translations: {
        Spanish: 'Le pido disculpas por la demora; permítanos invitarles a la primera ronda de bebidas.',
        French: 'Je vous présente toutes nos excuses pour ce retard — permettez-nous de vous offrir la première tournée de verres.',
        Mandarin: '非常抱歉让您久等了——这第一轮饮品就由我们餐厅请客赠送。',
        Portuguese: 'Peço sinceras desculpas pelo atraso — por favor, aceitem a primeira rodada de bebidas por nossa conta.',
        Japanese: 'お待たせして大変申し訳ございません。最初のお飲み物は当店からサービスさせてください。',
        Arabic: 'أعتذر بشدة عن هذا التأخير — واسمحوا لنا بتقديم الجولة الأولى من المشروبات كضيافة مجانية.',
        German: 'Ich entschuldige mich für die Verzögerung — gestatten Sie uns, die erste Getränkerunde aufs Haus zu setzen.',
        Vietnamese: 'Tôi thành thật xin lỗi vì sự chậm trễ — xin phép được mời bàn mình đợt đồ uống đầu tiên.',
      },
    },
  ],
  aiTurns: [
    'Good evening! Welcome to the Mayfair Pavilion. Have you got a reservation with us tonight?',
    'Lovely to have you. Before we take your order, does anyone at the table have any allergies or dietary preferences?',
    'Understood. One of the guests is coeliac and wants to know if the truffle risotto is prepared in a dedicated gluten-free area. What do you say?',
    'Spot on. Now, table seven has been waiting twenty-five minutes for their starters due to a kitchen rush. How do you de-escalate with them?',
    'Exceptional service. That was warm, tactful, and impeccably British. The guests will feel thoroughly looked after!',
  ],
  mockUserReplies: [
    'Yes, we have a table for four under Smith.',
    'No allergy, but one friend is gluten intolerant.',
    'I will go to kitchen to ask.',
    'Sorry for wait, I give you free drinks.',
  ],
  upgrades: [
    {
      id: 'hospu1',
      whatYouSaid: 'No allergy, but one friend is gluten intolerant.',
      moreNatural: 'Does anyone in your party have any severe allergies or dietary requirements?',
      explanation: 'Front-of-house staff proactively ask comprehensive allergen questions covering both severe allergies and intolerances.',
      category: 'Politeness',
    },
    {
      id: 'hospu2',
      whatYouSaid: 'I will go to kitchen to ask.',
      moreNatural: 'I’d be more than happy to double-check with the head chef for you.',
      explanation: '"I’d be more than happy to..." is a quintessential British luxury hospitality phrase displaying personal attentiveness.',
      category: 'Natural Idiom',
    },
    {
      id: 'hospu3',
      whatYouSaid: 'Sorry for wait, I give you free drinks.',
      moreNatural: 'I do apologise for the delay — please allow us to comp your first round of drinks.',
      explanation: 'Emphatic "I do apologise" plus "please allow us to comp..." sounds elegant and professional rather than casual.',
      category: 'Politeness',
    },
  ],
  helpPhrases: commonHelp,
  gradingRubric: 'Focus: British luxury hospitality etiquette, allergen safety inquiries (Natasha\'s Law & coeliac care), gracious de-escalation idioms ("I do apologise", "more than happy to", "on the house", "comp"), guest warmth, and discreet professional tact.',
};

export const jobInterviewPlan: LessonPlan = {
  id: 'scenario-job-interview',
  title: 'UK Job Interview',
  contextLabel: 'UK Career & Interview',
  persona: {
    name: 'Emma',
    role: 'Hiring Manager',
    avatar: '💼',
    accent: 'UK',
    greeting: 'Good morning! Thanks so much for coming in. Please take a seat. Did you find our offices alright?',
    tone: 'Discerning, structured, professional British hiring manager',
  },
  xpReward: 35,
  minutes: 5,
  phrases: [
    {
      id: 'int1',
      phrase: 'In my previous role, I was tasked with spearheading a major operational change.',
      ipa: '/ɪn maɪ ˈpriː.vi.əs rəʊl aɪ wɒz tɑːskt wɪð ˈspɪəˌhed.ɪŋ ə ˈmeɪ.dʒər ˌɒp.ərˈeɪ.ʃən.əl tʃeɪndʒ/',
      usageContext: 'STAR method opening (Situation & Task) using dynamic British leadership verbs.',
      translations: {
        Spanish: 'En mi puesto anterior, se me encomendó liderar un cambio operativo importante.',
        French: 'Dans mon poste précédent, j’ai été chargé de piloter un changement opérationnel majeur.',
        Mandarin: '在我之前的职位上，我受命牵头推动一项重大的业务变革。',
        Portuguese: 'Na minha função anterior, recebi a tarefa de liderar uma importante mudança operacional.',
        Japanese: '前職では、主要な業務変革を主導する責務を担当いたしました。',
        Arabic: 'في منصبي السابق، كُلفت بمهمة قيادة تغيير تشغيلي رئيسي.',
        German: 'In meiner vorherigen Position war ich damit betraut, eine wichtige operative Veränderung anzuführen.',
        Vietnamese: 'Ở vị trí trước đây, tôi được giao nhiệm vụ dẫn dắt một sự chuyển đổi vận hành trọng yếu.',
      },
    },
    {
      id: 'int2',
      phrase: 'The action I took was streamlining the workflow, which boosted efficiency by twenty percent.',
      ipa: '/ði ˈæk.ʃən aɪ tʊk wɒz ˈstriːmˌlaɪ.nɪŋ ðə ˈwɜːkˌfləʊ wɪtʃ buːstɪd ɪˈfɪʃ.ən.si baɪ ˈtwen.ti pəˈsent/',
      usageContext: 'STAR method Action & Result: pairing personal accountability with quantified outcome.',
      translations: {
        Spanish: 'La acción que tomé fue optimizar el flujo de trabajo, lo que aumentó la eficiencia en un 20%.',
        French: 'L’action que j’ai menée a consisté à rationaliser le flux de travail, ce qui a accru l’efficacité de 20%.',
        Mandarin: '我采取的行动是精简工作流程，使整体效率提升了百分之二十。',
        Portuguese: 'A ação que tomei foi otimizar o fluxo de trabalho, o que aumentou a eficiência em vinte por cento.',
        Japanese: '私が取った行動はワークフローの効率化であり、これにより効率が20％向上しました。',
        Arabic: 'كان الإجراء الذي اتخذته هو تبسيط سير العمل، مما عزز الكفاءة بنسبة عشرين بالمائة.',
        German: 'Meine Maßnahme war die Optimierung des Arbeitsablaufs, was die Effizienz um zwanzig Prozent steigerte.',
        Vietnamese: 'Hành động tôi đã thực hiện là tinh gọn quy trình làm việc, giúp tăng hiệu suất lên 20%.',
      },
    },
    {
      id: 'int3',
      phrase: 'I thrive in collaborative environments where I can take initiative and deliver tangible results.',
      ipa: '/aɪ θraɪv ɪn kəˈlæb.ər.ə.tɪv ɪnˈvaɪ.rən.mənts weər aɪ kæn teɪk ɪˈnɪʃ.ə.tɪv ənd dɪˈlɪv.ər ˈtæn.dʒə.bəl rɪˈzʌlts/',
      usageContext: 'Impactful executive summary closing showing workplace culture fit and proactive mindset.',
      translations: {
        Spanish: 'Prospero en entornos colaborativos donde puedo tomar la iniciativa y lograr resultados tangibles.',
        French: 'Je m’épanouis dans des environnements collaboratifs où je peux prendre des initiatives et produire des résultats concrets.',
        Mandarin: '我善于在协同合作的环境中发展，能够积极主动并交付切实的成果。',
        Portuguese: 'Eu me destaco em ambientes colaborativos onde posso tomar iniciativa e entregar resultados concretos.',
        Japanese: '自発的に行動し確実な成果を出せる、協調的な環境で力を発揮できます。',
        Arabic: 'أتميز في بيئات العمل التعاونية حيث يمكنني أخذ زمام المبادرة وتحقيق نتائج ملموسة.',
        German: 'Ich blühe in kollaborativen Umgebungen auf, in denen ich Initiative ergreifen und greifbare Ergebnisse liefern kann.',
        Vietnamese: 'Tôi phát huy tối đa trong môi trường cộng tác, nơi tôi có thể chủ động và mang lại kết quả cụ thể.',
      },
    },
  ],
  aiTurns: [
    'Good morning! Thanks so much for coming in. Please take a seat. Did you find our offices alright?',
    'Glad to hear that. To begin, could you walk me through a situation where you had to manage a challenging project under a strict deadline?',
    'Very interesting. What specific actions did you personally take to keep the team aligned and overcome that hurdle?',
    'And what was the quantifiable result of your efforts, and what would you do differently in retrospect?',
    'That was a thoroughly compelling response. Excellent use of the STAR method, structured reasoning, and confident delivery. It was a pleasure speaking with you!',
  ],
  mockUserReplies: [
    'Yes, the underground was very easy.',
    'In my old job we had a project that was very late and difficult.',
    'I talked to everyone and worked late to finish it.',
    'The result was good, the client was happy.',
  ],
  upgrades: [
    {
      id: 'intu1',
      whatYouSaid: 'In my old job we had a project that was very late and difficult.',
      moreNatural: 'In my previous role, I was tasked with spearheading a major operational turnaround under a tight deadline.',
      explanation: 'Anchor your answer using STAR (Situation & Task) with dynamic verbs like "spearheading" and "turnaround".',
      category: 'Natural Idiom',
    },
    {
      id: 'intu2',
      whatYouSaid: 'I talked to everyone and worked late to finish it.',
      moreNatural: 'The action I took was streamlining the workflow and establishing daily standups to unblock the team.',
      explanation: 'The "Action" in STAR should demonstrate strategic problem-solving and structured methodology, not just working longer hours.',
      category: 'Grammar',
    },
    {
      id: 'intu3',
      whatYouSaid: 'The result was good, the client was happy.',
      moreNatural: 'This resulted in delivering the milestone three days ahead of schedule, boosting client retention by twenty percent.',
      explanation: 'In UK corporate interviews, hiring managers look for quantifiable business results and measurable impact.',
      category: 'Fluency',
    },
  ],
  helpPhrases: commonHelp,
};

export const ALL_UK_LESSON_PLANS: Record<string, LessonPlan> = {
  [coffeePlan.id]: coffeePlan,
  [dailyPlan.id]: dailyPlan,
  [nhsHandoverPlan.id]: nhsHandoverPlan,
  [hospitalityPlan.id]: hospitalityPlan,
  [jobInterviewPlan.id]: jobInterviewPlan,
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

export function injectSavedReviewPhrases(plan: LessonPlan): LessonPlan {
  if (typeof window === 'undefined') return plan;
  try {
    const reviewPhrases = getWarmupReviewPhrases(2);
    if (reviewPhrases.length === 0) return plan;

    // Keep 3 phrases total in Stage 1: review phrases first, then the plan's key phrases
    const remainingCount = Math.max(1, 3 - reviewPhrases.length);
    const combinedPhrases = [...reviewPhrases, ...plan.phrases.slice(0, remainingCount)];

    return {
      ...plan,
      phrases: combinedPhrases,
    };
  } catch (e) {
    console.warn('Failed to inject saved review phrases', e);
    return plan;
  }
}

export function getLessonPlanForScenario(scenarioId: string): LessonPlan {
  let basePlan: LessonPlan;
  if (ALL_UK_LESSON_PLANS[scenarioId]) {
    basePlan = ALL_UK_LESSON_PLANS[scenarioId];
  } else {
    const s = roleplayScenarios.find((x) => x.id === scenarioId);
    basePlan = s ? buildPlanFromScenario(s) : dailyPlan;
  }
  return injectSavedReviewPhrases(basePlan);
}

export function getDailyLessonPlan(): LessonPlan {
  return injectSavedReviewPhrases(dailyPlan);
}
