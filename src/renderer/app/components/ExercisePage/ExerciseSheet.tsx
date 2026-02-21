import { CheckCircle2, Eraser, RotateCcw, Send } from 'lucide-react'
import { Button } from '../../../shared/components/ui/button'
import { cn } from '../../../shared/lib/utils'
import type { Exercise, ExerciseAttempt, UserAnswer } from '../../../types/exercise'
import { QuestionRenderer } from './QuestionRenderer'

interface Props {
    exercise: Exercise
    answers: Record<string, UserAnswer>
    setAnswer: (questionId: string, answer: UserAnswer) => void
    isSubmitted: boolean
    score: ExerciseAttempt['score'] | null
    submit: () => void
    reset: () => void
    answeredCount: number
    totalQuestions: number
}

export function ExerciseSheet({
    exercise,
    answers,
    setAnswer,
    isSubmitted,
    score,
    submit,
    reset,
    answeredCount,
    totalQuestions,
}: Props) {
    return (
        <div className="max-w-3xl mx-auto p-6 space-y-8">
            {/* Clear button at top */}
            {!isSubmitted && answeredCount > 0 && (
                <div className="flex justify-end">
                    <Button
                        onClick={reset}
                        variant="ghost"
                        size="sm"
                        className="text-neutral-400 hover:text-white hover:bg-neutral-800"
                    >
                        <Eraser className="w-4 h-4 mr-2" />
                        Alle löschen
                    </Button>
                </div>
            )}

            {/* Header */}
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <h1 className="text-2xl font-bold text-white">{exercise.title}</h1>
                    <div className="flex items-center gap-2 shrink-0">
                        <span
                            className={cn(
                                'px-3 py-1 rounded-full text-sm font-medium',
                                answeredCount === totalQuestions
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-neutral-700/50 text-neutral-400',
                            )}
                        >
                            {answeredCount} / {totalQuestions}
                        </span>
                    </div>
                </div>

                {exercise.description && (
                    <p className="text-neutral-400 leading-relaxed">{exercise.description}</p>
                )}

                {exercise.metadata && (
                    <div className="flex items-center gap-3 flex-wrap">
                        {exercise.metadata.difficulty && (
                            <span
                                className={cn(
                                    'px-2 py-0.5 rounded text-xs font-medium',
                                    exercise.metadata.difficulty === 'easy'
                                        ? 'bg-green-500/20 text-green-400'
                                        : exercise.metadata.difficulty === 'medium'
                                          ? 'bg-yellow-500/20 text-yellow-400'
                                          : 'bg-red-500/20 text-red-400',
                                )}
                            >
                                {exercise.metadata.difficulty === 'easy'
                                    ? 'Einfach'
                                    : exercise.metadata.difficulty === 'medium'
                                      ? 'Mittel'
                                      : 'Schwer'}
                            </span>
                        )}
                        {exercise.metadata.estimatedMinutes && (
                            <span className="text-xs text-neutral-500">
                                ~{exercise.metadata.estimatedMinutes} Min.
                            </span>
                        )}
                        {exercise.metadata.tags?.map((tag) => (
                            <span
                                key={tag}
                                className="px-2 py-0.5 rounded text-xs bg-neutral-700/50 text-neutral-400"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Score display */}
            {isSubmitted && score && (
                <div
                    className={cn(
                        'p-4 rounded-xl border',
                        score.percentage >= 80
                            ? 'bg-green-500/10 border-green-500/30'
                            : score.percentage >= 50
                              ? 'bg-yellow-500/10 border-yellow-500/30'
                              : 'bg-red-500/10 border-red-500/30',
                    )}
                >
                    <div className="flex items-center gap-3">
                        <CheckCircle2
                            className={cn(
                                'w-8 h-8',
                                score.percentage >= 80
                                    ? 'text-green-500'
                                    : score.percentage >= 50
                                      ? 'text-yellow-500'
                                      : 'text-red-500',
                            )}
                        />
                        <div>
                            <p className="text-lg font-bold text-white">
                                {score.earned} / {score.total} Punkte ({score.percentage}%)
                            </p>
                            <p className="text-sm text-neutral-400">
                                {score.percentage >= 80
                                    ? 'Sehr gut gemacht!'
                                    : score.percentage >= 50
                                      ? 'Nicht schlecht, aber da geht noch mehr.'
                                      : 'Das war noch nichts. Versuche es nochmal!'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Questions */}
            <div className="space-y-8">
                {exercise.questions.map((question, index) => (
                    <div
                        key={question.id}
                        className="p-4 rounded-xl bg-neutral-800/30 border border-neutral-700/50"
                    >
                        <QuestionRenderer
                            question={question}
                            answer={answers[question.id]}
                            onAnswer={(answer) => setAnswer(question.id, answer)}
                            isSubmitted={isSubmitted}
                            index={index}
                        />
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                {isSubmitted ? (
                    <Button
                        onClick={reset}
                        variant="outline"
                        className="bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Nochmal versuchen
                    </Button>
                ) : (
                    <Button
                        onClick={submit}
                        disabled={answeredCount === 0}
                        className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                        <Send className="w-4 h-4 mr-2" />
                        Antworten prüfen
                    </Button>
                )}
            </div>
        </div>
    )
}
