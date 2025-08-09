

export type TaskCategory = string;

export interface CustomTaskCategory {
    id: string; // The category name itself
    name: string;
}

export interface ExplanationBlock {
  type: 'explanation';
  id: string;
  text: string;
}

export interface MultipleChoiceQuestionBlock {
  type: 'multiple_choice_question';
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface OpenEndedQuestionBlock {
    type: 'open_ended_question';
    id:string;
    question: string;
}

export interface TrueFalseQuestionBlock {
    type: 'true_false_question';
    id: string;
    question: string;
    correctAnswer: boolean;
}

export interface FillInTheBlankQuestionBlock {
    type: 'fill_in_the_blank_question';
    id: string;
    questionParts: string[]; 
    correctAnswers: string[];
}

export interface MathBlock {
  type: 'math_formula';
  id: string;
  latex: string;
}

export type InteractiveBlock = ExplanationBlock | MultipleChoiceQuestionBlock | OpenEndedQuestionBlock | TrueFalseQuestionBlock | FillInTheBlankQuestionBlock | MathBlock;

export interface InteractiveContent {
  id: string;
  title: string;
  content: InteractiveBlock[];
}

export interface UserAnswer {
  questionId: string;
  answer: string | number | boolean | string[];
}

export interface FeedbackItem {
  questionId: string;
  isCorrect: boolean;
  explanation: string;
  // Optional fields to hold original data for easier display in UI
  question?: string;
  userAnswer?: string;
}

export interface AiCorrection {
    questionId: string;
    correction: string;
}

export interface PageText {
    pageNumber: number;
    text: string;
    images?: string[];
}

export interface Lesson {
    id: string;
    title: string;
    startPage: number;
    endPage: number;
}

export interface Chapter {
    id: string;
    title: string;
    startPage: number;
    endPage: number;
    lessons?: Lesson[];
    isAnalyzing?: boolean;
}

export interface ColorTheme {
    '--color-background-primary': string;
    '--color-background-secondary': string;
    '--color-background-tertiary': string;
    '--color-border-primary': string;
    '--color-border-secondary': string;
    '--color-text-primary': string;
    '--color-text-secondary': string;
    '--color-text-tertiary': string;
    '--color-text-brown-dark': string;
    '--color-text-green-dark': string;
    '--color-accent-primary': string;
    '--color-accent-secondary': string;
    '--color-accent-info': string;
    '--color-accent-danger': string;
    '--color-accent-success': string;
    '--color-accent-indigo': string;
    '--color-accent-purple': string;
    '--color-background-dots': string;
    '--color-accent-highlight': string;
    '--color-background-container-gradient': string;
    '--background-body': string;
}

export type SearchFilter = 'all' | 'sites' | 'video';

export interface SearchResult {
    sources: {
        uri: string;
        title: string;
    }[];
}

export interface SmartSearchResult {
    answer: string;
    quote: string;
    pages: string;
    follow_ups: string[];
}

export interface SavedFile {
    name: string;
    type: string;
    content: ArrayBuffer;
}

export interface SavedBook {
    id: string;
    name: string;
    chapters: Chapter[];
    pageTexts: PageText[];
    fileContent: ArrayBuffer;
}

export interface ActiveBookState {
    id: string;
    xp: number;
    chapters: Chapter[];
}

export interface SavedSummary {
    id: string;
    bookName: string;
    chapterTitle: string;
    summaryText: string;
}

export interface AiBookCategory {
    category: string;
    subCategories: {
        subCategory: string;
        books: string[];
    }[];
}

export interface Task {
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    category: TaskCategory;
    dueDate: string; // ISO string
    completed: boolean;
    createdAt: number; // timestamp
}


export type AppState = 
    | 'uploading' 
    | 'analyzing' 
    | 'chapter_selection' 
    | 'generating' 
    | 'session' 
    | 'error';

export type ThemeMode = 'light' | 'dark';