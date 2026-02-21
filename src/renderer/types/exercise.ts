/**
 * Question types supported by the exercise system
 */
export type QuestionType =
    | 'multiple_choice' // Multiple answers can be selected
    | 'single_choice' // Only one answer can be selected
    | 'true_false' // True/False question
    | 'free_text' // Open text response
    | 'code'; // Code input with optional language

/**
 * Choice option for MC/SC questions
 */
export interface ChoiceOption {
    id: string;
    label: string;
    /** Explanation shown after submission (why this is correct/incorrect) */
    explanation?: string;
}

/**
 * Base interface for all question types
 */
interface BaseQuestion {
    id: string;
    type: QuestionType;
    /** Markdown-supported question text */
    question: string;
    /** Points awarded for correct answer (default: 1) */
    points?: number;
    /** Hint text shown on request */
    hint?: string;
    /** Whether this question is required */
    required?: boolean;
}

/**
 * Multiple choice question (multiple correct answers)
 */
export interface MultipleChoiceQuestion extends BaseQuestion {
    type: 'multiple_choice';
    options: ChoiceOption[];
    /** IDs of correct options */
    correctAnswers: string[];
}

/**
 * Single choice question (one correct answer)
 */
export interface SingleChoiceQuestion extends BaseQuestion {
    type: 'single_choice';
    options: ChoiceOption[];
    /** ID of the correct option */
    correctAnswer: string;
}

/**
 * True/False question
 */
export interface TrueFalseQuestion extends BaseQuestion {
    type: 'true_false';
    /** The correct answer */
    correctAnswer: boolean;
    /** Explanation for the correct answer */
    explanation?: string;
}

/**
 * Free text question (not auto-graded)
 */
export interface FreeTextQuestion extends BaseQuestion {
    type: 'free_text';
    /** Placeholder text for the input */
    placeholder?: string;
    /** Minimum character count */
    minLength?: number;
    /** Maximum character count */
    maxLength?: number;
    /** Sample/model answer shown after submission */
    sampleAnswer: string;
}

/**
 * Code input question (not auto-graded)
 */
export interface CodeQuestion extends BaseQuestion {
    type: 'code';
    /** Programming language for syntax highlighting */
    language?: string;
    /** Starter code pre-filled in the editor */
    starterCode?: string;
    /** Sample solution shown after submission */
    sampleSolution: string;
}

/**
 * Union type for all question types
 */
export type Question =
    | MultipleChoiceQuestion
    | SingleChoiceQuestion
    | TrueFalseQuestion
    | FreeTextQuestion
    | CodeQuestion;

/**
 * Complete exercise definition
 */
export interface Exercise {
    id: string;
    /** Display title */
    title: string;
    /** Markdown-supported description/instructions */
    description?: string;
    /** Reference to script section (for preview) */
    scriptReference?: {
        /** ID of the chapter/section */
        sectionId: string;
        /** Anchor or heading to scroll to */
        anchor?: string;
    };
    /** List of questions in this exercise */
    questions: Question[];
    /** Metadata for categorization */
    metadata?: {
        difficulty?: 'easy' | 'medium' | 'hard';
        tags?: string[];
        estimatedMinutes?: number;
    };
}

/**
 * Individual answer by user
 */
export type UserAnswer =
    | { type: 'multiple_choice'; selectedIds: string[] }
    | { type: 'single_choice'; selectedId: string }
    | { type: 'true_false'; answer: boolean }
    | { type: 'free_text'; text: string }
    | { type: 'code'; code: string };

/**
 * User's answers to an exercise
 */
export interface ExerciseAttempt {
    exerciseId: string;
    answers: Record<string, UserAnswer>;
    submittedAt?: string;
    score?: {
        earned: number;
        total: number;
        percentage: number;
    };
}
