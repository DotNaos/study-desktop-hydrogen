import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../../../shared/lib/utils';
import type { MultipleChoiceQuestion as MCQuestion, UserAnswer } from '../../../../types/exercise';

interface Props {
    question: MCQuestion;
    answer?: UserAnswer;
    onAnswer: (answer: UserAnswer) => void;
    isSubmitted: boolean;
    index: number;
}

export function MultipleChoiceQuestion({
    question,
    answer,
    onAnswer,
    isSubmitted,
    index,
}: Props) {
    const [isChecked, setIsChecked] = useState(false);
    const selectedIds =
        answer?.type === 'multiple_choice' ? answer.selectedIds : [];
    const correctSet = new Set(question.correctAnswers);
    const selectedSet = new Set(selectedIds);
    const showResults = isSubmitted || isChecked;

    // Reset checked state when answer is cleared
    useEffect(() => {
        if (selectedIds.length === 0) setIsChecked(false);
    }, [selectedIds.length]);

    const toggleOption = (optionId: string) => {
        if (showResults) return;
        const newSelected = selectedIds.includes(optionId)
            ? selectedIds.filter((id) => id !== optionId)
            : [...selectedIds, optionId];
        onAnswer({ type: 'multiple_choice', selectedIds: newSelected });
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
                    const isOptionCorrect = correctSet.has(option.id);
                    const isSelected = selectedSet.has(option.id);
                    const showCorrect = showResults && isOptionCorrect;
                    const showIncorrect = showResults && isSelected && !isOptionCorrect;

                    return (
                        <div
                            key={option.id}
                            onClick={() => toggleOption(option.id)}
                            className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                                !showResults && 'cursor-pointer',
                                showResults
                                    ? showCorrect
                                        ? 'border-green-500/50 bg-green-500/10'
                                        : showIncorrect
                                          ? 'border-red-500/50 bg-red-500/10'
                                          : 'border-neutral-700/50 bg-neutral-800/30'
                                    : isSelected
                                      ? 'border-blue-500/50 bg-blue-500/10'
                                      : 'border-neutral-700/50 bg-neutral-800/30 hover:border-neutral-600',
                            )}
                        >
                            <div
                                className={cn(
                                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                                    isSelected
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-neutral-500',
                                )}
                            >
                                {isSelected && (
                                    <Check className="w-3 h-3 text-white" />
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
                            {showResults && !isSelected && isOptionCorrect && (
                                <span className="text-xs text-green-500">
                                    Richtig
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Check button for multiple choice */}
            {!showResults && selectedIds.length > 0 && (
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

            {showResults && (
                <div className="ml-6 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                    <p className="text-sm text-neutral-400">
                        <span className="font-medium text-neutral-300">
                            Richtige Antworten:{' '}
                        </span>
                        {question.options
                            .filter((o) => correctSet.has(o.id))
                            .map((o) => o.label)
                            .join(', ')}
                    </p>
                </div>
            )}
        </div>
    );
}
