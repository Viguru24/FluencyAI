// Type definitions for FluencyAI

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export type NativeLanguage =
  | 'Spanish'
  | 'Mandarin'
  | 'Japanese'
  | 'Portuguese'
  | 'Arabic'
  | 'French'
  | 'Vietnamese'
  | 'German';

export type LessonStage = 'scaffolding' | 'roleplay' | 'scorecard';

export interface PhrasingUpgrade {
  id: string;
  whatYouSaid: string;
  moreNatural: string;
  explanation: string;
  category: 'Politeness' | 'Natural Idiom' | 'Grammar' | 'Fluency';
}

export interface SavedMistake {
  id: string;
  whatYouSaid: string;
  moreNatural: string;
  scenarioTitle: string;
  dateSaved: string;
}

export interface SavedReviewPhrase {
  id: string;
  phrase: string;
  ipa?: string;
  usageContext?: string;
  whatYouSaid?: string;
  explanation?: string;
  dateSaved: string;
  scenarioTitle?: string;
  translations?: Partial<Record<NativeLanguage, string>>;
}

export interface UserProgress {
  name: string;
  avatar?: string;
  email?: string;
  id?: string | number;
  streakDays: number;
  streakActiveToday: boolean;
  dailyGoalMinutes: number;
  completedMinutes: number;
  dailyGoalXP: number;
  completedXP: number;
  level: CEFRLevel;
  nativeLanguage: NativeLanguage;
  audioSpeed: number; // e.g. 0.8 or 1.0
  completedScenarioIds: string[];
  hasCompletedDailyLessonToday: boolean;
  savedMistakes?: SavedMistake[];
  hasCompletedPlacement?: boolean;
  placementDetails?: PlacementAssessmentResult;
}

export interface PlacementAssessmentResult {
  level: CEFRLevel;
  title: string;
  summary: string;
  fluencyScore: number;
  grammarScore: number;
  strengths: string[];
  recommendations: string[];
  assessedAt: string;
}

export interface AuthUser {
  id: string | number;
  email: string;
  name: string;
  picture?: string | null;
  xp?: number;
  streak?: number;
  level?: CEFRLevel;
  tier?: string;
  progress_data?: any;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface AIPersona {
  name: string;
  role: string;
  avatar: string;
  accent: 'US' | 'UK';
  greeting: string;
  tone: string;
}

export interface ScaffoldingTargetPhrase {
  id: string;
  phrase: string;
  ipa: string;
  usageContext: string;
  translations: Partial<Record<NativeLanguage, string>>;
  isSpacedRepetition?: boolean;
  originalMistake?: string;
}

export interface HelpPhrase {
  id: string;
  /** Keywords (any language) that map a native-language request to this phrase */
  keywords: string[];
  english: string;
  ipa: string;
  note: string;
}

/** Everything the 3-stage lesson flow needs for one scenario or the daily lesson */
export interface LessonPlan {
  id: string;
  title: string;
  contextLabel: string; // e.g. "UK Hospitality"
  persona: AIPersona;
  xpReward: number;
  minutes: number;
  phrases: ScaffoldingTargetPhrase[]; // exactly 3
  aiTurns: string[]; // AI lines, spoken in order
  mockUserReplies: string[]; // fallback transcript when speech recognition is unavailable
  upgrades: PhrasingUpgrade[];
  helpPhrases: HelpPhrase[];
  gradingRubric?: string; // Specialized scenario grading focus
}

export interface PronunciationCoachingPoint {
  wordOrPhrase: string;
  confidence: number;
  alternatives: string[];
  feedback?: string;
  ipa?: string;
}

export interface PronunciationFeedbackWord {
  word: string;
  issue: string;
  tip: string;
}

export interface LessonSessionResult {
  phraseScores: number[]; // scaffolding pronunciation attempts (0-100)
  userTurns: string[];
  revealsUsed: number;
  helpRequests: number;
  aiTurnsHeard: number;
  fluencyScore?: number;
  pronunciationScore?: number;
  listeningScore?: number;
  dynamicUpgrades?: PhrasingUpgrade[];
  phrasesToReview?: string[];
  pronunciationCoachingPoints?: PronunciationCoachingPoint[];
  pronunciationFeedback?: PronunciationFeedbackWord[];
  acousticFeedback?: string;
  lowConfidenceWords?: string[];
}


export interface KeyVocabItem {
  word: string;
  ipa: string;
  partOfSpeech: string;
  translations: Record<NativeLanguage, string>;
  example: string;
  tip?: string;
}

export interface DialogueStep {
  step: number;
  speaker: 'ai' | 'user';
  message: string;
  translations?: Record<NativeLanguage, string>;
  suggestedResponses?: string[];
  grammarNotes?: string;
}

export interface RoleplayScenario {
  id: string;
  title: string;
  tagline: string;
  category: 'Daily Life' | 'Career & Tech' | 'Travel' | 'Social' | 'Healthcare';
  cefrLevel: CEFRLevel;
  durationMinutes: number;
  aiPersona: AIPersona;
  description: string;
  learningGoals: string[];
  keyVocabulary: KeyVocabItem[];
  dialogueFlow: DialogueStep[];
  badgeColor: string;
  gradient: string;
}

export interface DailyLessonData {
  id: string;
  topic: string;
  estimatedMinutes: number;
  xpReward: number;
  phraseOfTheDay: {
    phrase: string;
    ipa: string;
    meaning: string;
    example: string;
    translations: Record<NativeLanguage, string>;
    culturalNote: string;
  };
  quiz: {
    question: string;
    context: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
  speakingPrompt: {
    challenge: string;
    targetKeywords: string[];
    sampleResponse: string;
    coachingTip: string;
  };
}
