import { Maximize2, X } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ScriptViewerProps {
    content: string;
}

export const ScriptViewer = ({ content }: ScriptViewerProps) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    return (
        <>
            {/* Preview Strip */}
            <div
                className="script-preview w-full bg-zinc-900 border-b border-zinc-700 cursor-pointer hover:bg-zinc-800 transition-colors group relative border-t-4 border-blue-500/20"
                onClick={() => setIsFullscreen(true)}
                style={{ height: '140px' }}
            >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded z-10">
                    <Maximize2 size={16} className="text-zinc-300" />
                    <span className="sr-only">Fullscreen</span>
                </div>
                <div className="absolute top-2 left-4 text-xs font-mono text-zinc-500 z-10">
                    SCRIPT RESOURCE
                </div>

                <div className="h-full overflow-hidden px-6 py-4 opacity-80 select-none pointer-events-none mask-gradient-to-b from-black to-transparent">
                    <div className="prose prose-invert max-w-none prose-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                        </ReactMarkdown>
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
            </div>

            {/* Fullscreen Modal */}
            {isFullscreen && (
                <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col animate-in fade-in duration-200">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900 shadow-md">
                        <h2 className="text-lg font-semibold text-zinc-100">
                            Script Reader
                        </h2>
                        <button
                            onClick={() => setIsFullscreen(false)}
                            className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-12 max-w-5xl mx-auto w-full">
                        <div className="prose prose-invert prose-lg max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {content}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
