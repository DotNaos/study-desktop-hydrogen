import { useCallback, useState } from 'react';
import type {
    Exercise,
    ExerciseAttempt,
    Question,
    UserAnswer,
} from '../types/exercise';

interface UseExerciseStateReturn {
    answers: Record<string, UserAnswer>;
    setAnswer: (questionId: string, answer: UserAnswer) => void;
    isSubmitted: boolean;
    score: ExerciseAttempt['score'] | null;
    submit: () => void;
    reset: () => void;
    answeredCount: number;
    totalQuestions: number;
    getQuestionResult: (question: Question) => 'correct' | 'incorrect' | null;
}

export function useExerciseState(exercise: Exercise): UseExerciseStateReturn {
    const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [score, setScore] = useState<ExerciseAttempt['score'] | null>(null);

    const setAnswer = useCallback((questionId: string, answer: UserAnswer) => {
        setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    }, []);

    const checkAnswer = useCallback(
        (question: Question, answer: UserAnswer | undefined): boolean => {
            if (!answer) return false;

            switch (question.type) {
                case 'single_choice':
                    return (
                        answer.type === 'single_choice' &&
                        answer.selectedId === question.correctAnswer
                    );

                case 'multiple_choice':
                    if (answer.type !== 'multiple_choice') return false;
                    const correct = new Set(question.correctAnswers);
                    const selected = new Set(answer.selectedIds);
                    if (correct.size !== selected.size) return false;
                    return [...correct].every((id) => selected.has(id));

                case 'true_false':
                    return (
                        answer.type === 'true_false' &&
                        answer.answer === question.correctAnswer
                    );

                // free_text and code are not auto-graded
                case 'free_text':
                case 'code':
                    return true; // Always "correct" since we can't auto-grade
            }
        },
        [],
    );

    const submit = useCallback(() => {
        let earned = 0;
        let total = 0;

        for (const question of exercise.questions) {
            const points = question.points ?? 1;
            total += points;

            const answer = answers[question.id];
            const isCorrect = checkAnswer(question, answer);

            // Only count points for auto-gradable questions
            if (
                question.type === 'single_choice' ||
                question.type === 'multiple_choice' ||
                question.type === 'true_false'
            ) {
                if (isCorrect) {
                    earned += points;
                }
            }
        }

        setScore({
            earned,
            total,
            percentage: total > 0 ? Math.round((earned / total) * 100) : 0,
        });
        setIsSubmitted(true);
    }, [exercise.questions, answers, checkAnswer]);

    const reset = useCallback(() => {
        setAnswers({});
        setIsSubmitted(false);
        setScore(null);
    }, []);

    const getQuestionResult = useCallback(
        (question: Question): 'correct' | 'incorrect' | null => {
            if (!isSubmitted) return null;

            const answer = answers[question.id];

            // For free text and code, don't show correct/incorrect
            if (question.type === 'free_text' || question.type === 'code') {
                return null;
            }

            return checkAnswer(question, answer) ? 'correct' : 'incorrect';
        },
        [isSubmitted, answers, checkAnswer],
    );

    return {
        answers,
        setAnswer,
        isSubmitted,
        score,
        submit,
        reset,
        answeredCount: Object.keys(answers).length,
        totalQuestions: exercise.questions.length,
        getQuestionResult,
    };
}
