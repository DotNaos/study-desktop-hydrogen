import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../../../shared/lib/utils';
import type { SingleChoiceQuestion as SCQuestion, UserAnswer } from '../../../../types/exercise';

interface Props {
    question: SCQuestion;
    answer?: UserAnswer;
    onAnswer: (answer: UserAnswer) => void;
    isSubmitted: boolean;
    index: number;
}

export function SingleChoiceQuestion({
    question,
    answer,
    onAnswer,
    isSubmitted,
    index,
}: Props) {
    const [isChecked, setIsChecked] = useState(false);
    const selectedId =
        answer?.type === 'single_choice' ? answer.selectedId : undefined;
    const isCorrect = selectedId === question.correctAnswer;
    const showResults = isSubmitted || isChecked;

    // Reset checked state when answer is cleared
    useEffect(() => {
        if (!selectedId) setIsChecked(false);
    }, [selectedId]);

    const handleSelect = (optionId: string) => {
        if (showResults) return;
        onAnswer({ type: 'single_choice', selectedId: optionId });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-neutral-500 mt-0.5">
                    {index + 1}.
                </span>
                <div className="prose prose-invert prose-sm max-w-none flex-1">
                    <ReactMarkdown>{question.question}</ReactMarkdown>
                </div>
            </div>

            <div className="ml-6 space-y-2">
                {question.options.map((option) => {
                    const isOptionCorrect = option.id === question.correctAnswer;
                    const isSelected = selectedId === option.id;

                    return (
                        <div
                            key={option.id}
                            onClick={() => handleSelect(option.id)}
                            className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                                !showResults && 'cursor-pointer',
                                showResults
                                    ? isOptionCorrect
                                        ? 'border-green-500/50 bg-green-500/10'
                                        : isSelected
                                          ? 'border-red-500/50 bg-red-500/10'
                                          : 'border-neutral-700/50 bg-neutral-800/30'
                                    : isSelected
                                      ? 'border-blue-500/50 bg-blue-500/10'
                                      : 'border-neutral-700/50 bg-neutral-800/30 hover:border-neutral-600',
                            )}
                        >
                            <div
                                className={cn(
                                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                                    isSelected
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-neutral-500',
                                )}
                            >
                                {isSelected && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                            </div>
                            <span className="flex-1 text-neutral-200">
                                {option.label}
                            </span>
                            {showResults && isSelected && (
                                isOptionCorrect ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                )
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Check button */}
            {!showResults && selectedId && (
                <div className="ml-6">
                    <button
                        type="button"
                        onClick={() => setIsChecked(true)}
                        className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                        Überprüfen
                    </button>
                </div>
            )}

            {showResults && !isCorrect && (
                <div className="ml-6 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                    <p className="text-sm text-neutral-400">
                        <span className="font-medium text-neutral-300">
                            Richtige Antwort:{' '}
                        </span>
                        {
                            question.options.find(
                                (o) => o.id === question.correctAnswer,
                            )?.label
                        }
                    </p>
                    {question.options.find((o) => o.id === question.correctAnswer)
                        ?.explanation && (
                        <p className="text-sm text-neutral-500 mt-1">
                            {
                                question.options.find(
                                    (o) => o.id === question.correctAnswer,
                                )?.explanation
                            }
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
