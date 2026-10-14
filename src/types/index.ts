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

export interface UserProgress {
  name: string;
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
}

export interface AIPersona {
  name: string;
  role: string;
  avatar: string;
  accent: 'US' | 'UK';
  greeting: string;
  tone: string;
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
