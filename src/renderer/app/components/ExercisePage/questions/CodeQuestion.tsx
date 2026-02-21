import { Code, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Textarea } from '../../ui/textarea';
import { cn } from '../../../../shared/lib/utils';
import type { CodeQuestion as CQuestion, UserAnswer } from '../../../../types/exercise';

interface Props {
    question: CQuestion;
    answer?: UserAnswer;
    onAnswer: (answer: UserAnswer) => void;
    isSubmitted: boolean;
    index: number;
}

export function CodeQuestion({
    question,
    answer,
    onAnswer,
    isSubmitted,
    index,
}: Props) {
    const [isChecked, setIsChecked] = useState(false);
    const [showSolution, setShowSolution] = useState(false);
    const code =
        answer?.type === 'code'
            ? answer.code
            : question.starterCode ?? '';
    const showResults = isSubmitted || isChecked;

    // Reset checked state when answer is cleared
    useEffect(() => {
        if (!code || code === question.starterCode) {
            setIsChecked(false);
            setShowSolution(false);
        }
    }, [code, question.starterCode]);

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
                <div className="rounded-lg overflow-hidden border border-neutral-700">
                    {/* Editor header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800 border-b border-neutral-700">
                        <Code className="w-4 h-4 text-neutral-400" />
                        <span className="text-xs text-neutral-400 font-mono">
                            {question.language ?? 'code'}
                        </span>
                    </div>

                    {/* Code editor */}
                    <Textarea
                        value={code}
                        onChange={(e) =>
                            onAnswer({ type: 'code', code: e.target.value })
                        }
                        disabled={showResults}
                        className={cn(
                            'min-h-[200px] rounded-none border-0 bg-neutral-900 text-neutral-200',
                            'font-mono text-sm leading-relaxed',
                            'focus:ring-0 focus:border-0 resize-y',
                        )}
                        style={{ tabSize: 4 }}
                    />
                </div>
            </div>

            {/* Check button */}
            {!showResults && code.length > 0 && code !== question.starterCode && (
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
                            ? 'Lösung ausblenden'
                            : 'Lösung anzeigen'}
                    </button>

                    {showSolution && (
                        <div className="rounded-lg overflow-hidden border border-green-500/30">
                            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border-b border-green-500/30">
                                <Code className="w-4 h-4 text-green-400" />
                                <span className="text-xs text-green-400 font-mono">
                                    Musterlösung
                                </span>
                            </div>
                            <pre className="p-4 bg-neutral-900 text-sm text-neutral-200 font-mono overflow-x-auto">
                                <code>{question.sampleSolution}</code>
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
