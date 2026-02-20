import { Eye, EyeOff, Play, Save } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Task } from '../../mockData';

interface TaskContentProps {
    task: Task;
    code: string;
    onChange: (val: string) => void;
    onSave: () => void;
    isSaving: boolean;
}

export const TaskContent = ({
    task,
    code,
    onChange,
    onSave,
    isSaving,
}: TaskContentProps) => {
    const [showSolution, setShowSolution] = useState(false);

    return (
        <div className="flex-1 overflow-y-auto bg-zinc-900/50 p-6 md:p-10 scroll-smooth">
            <div className="max-w-4xl mx-auto space-y-10 pb-20">
                {/* Task Description */}
                <div className="bg-zinc-950 p-8 rounded-2xl border border-zinc-800 shadow-xl">
                    <span className="text-xs font-mono text-zinc-500 mb-4 block">
                        TASK DESCRIPTION
                    </span>
                    <div className="prose prose-invert prose-zinc max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {task.description}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* My Attempt Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-zinc-200">
                            Your Solution
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={onSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium text-zinc-300 transition-colors disabled:opacity-50"
                            >
                                <Save size={14} />{' '}
                                {isSaving ? 'Saving...' : 'Save Draft'}
                            </button>
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium text-white transition-colors shadow-lg shadow-blue-900/20">
                                <Play size={14} /> Run Tests
                            </button>
                        </div>
                    </div>

                    <div className="relative group">
                        <textarea
                            value={code}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder="// Type your code or answer here..."
                            className="w-full h-80 bg-zinc-950 border border-zinc-800 rounded-xl p-6 text-zinc-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none shadow-inner"
                            spellCheck={false}
                        />
                        <div className="absolute bottom-4 right-4 text-xs text-zinc-600 pointer-events-none opacity-50">
                            Markdown & Code Supported
                        </div>
                    </div>
                </div>

                {/* Solution Section */}
                <div className="pt-8 border-t border-zinc-800/50">
                    <button
                        onClick={() => setShowSolution(!showSolution)}
                        className="flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-white transition-colors"
                    >
                        {showSolution ? (
                            <EyeOff size={16} />
                        ) : (
                            <Eye size={16} />
                        )}
                        {showSolution ? 'Hide Solution' : 'Reveal Solution'}
                    </button>

                    {showSolution && (
                        <div className="mt-6 prose prose-invert prose-green max-w-none bg-green-950/10 border border-green-900/30 p-8 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                            <h4 className="text-green-400 mt-0 text-sm uppercase tracking-wider font-bold mb-4">
                                Official Solution
                            </h4>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {task.solution}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
