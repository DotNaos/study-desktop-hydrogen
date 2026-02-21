import { Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Textarea } from '../../ui/textarea';
import { cn } from '../../../../shared/lib/utils';
import type { FreeTextQuestion as FTQuestion, UserAnswer } from '../../../../types/exercise';

interface Props {
    question: FTQuestion;
    answer?: UserAnswer;
    onAnswer: (answer: UserAnswer) => void;
    isSubmitted: boolean;
    index: number;
}

export function FreeTextQuestion({
    question,
    answer,
    onAnswer,
    isSubmitted,
    index,
}: Props) {
    const [isChecked, setIsChecked] = useState(false);
    const [showSolution, setShowSolution] = useState(false);
    const text = answer?.type === 'free_text' ? answer.text : '';
    const showResults = isSubmitted || isChecked;

    // Reset checked state when answer is cleared
    useEffect(() => {
        if (!text) {
            setIsChecked(false);
            setShowSolution(false);
        }
    }, [text]);

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

            <div className="ml-6">
                <Textarea
                    value={text}
                    onChange={(e) =>
                        onAnswer({ type: 'free_text', text: e.target.value })
                    }
                    placeholder={question.placeholder ?? 'Deine Antwort...'}
                    disabled={showResults}
                    className={cn(
                        'min-h-[120px] bg-neutral-800/50 border-neutral-700 text-neutral-200',
                        'placeholder:text-neutral-500 focus:border-blue-500/50',
                    )}
                />
                {question.minLength && (
                    <p className="text-xs text-neutral-500 mt-1">
                        Mindestens {question.minLength} Zeichen (aktuell:{' '}
                        {text.length})
                    </p>
                )}
            </div>

            {/* Check button */}
            {!showResults && text.length > 0 && (
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
                <div className="ml-6 space-y-3">
                    <button
                        type="button"
                        onClick={() => setShowSolution(!showSolution)}
                        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <Eye className="w-4 h-4" />
                        {showSolution
                            ? 'Musterlösung ausblenden'
                            : 'Musterlösung anzeigen'}
                    </button>

                    {showSolution && (
                        <div className="p-4 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
                            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
                                Musterlösung
                            </p>
                            <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown>
                                    {question.sampleAnswer}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
