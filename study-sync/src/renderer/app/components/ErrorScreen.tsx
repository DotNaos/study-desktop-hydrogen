import { RotateCcw, TriangleAlert } from 'lucide-react';

interface ErrorScreenProps {
    error: any;
    onRetry?: () => void;
}

export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
    let message = 'An unknown error occurred';

    if (typeof error === 'string') {
        message = error;
    } else if (error instanceof Error) {
        message = error.message;
    } else if (error && typeof error === 'object') {
        // Try to find a message property
        if ('message' in error) message = String(error.message);
        else if ('status' in error)
            message = `Request failed with status ${error.status}`;
        else if (Object.keys(error).length === 0)
            message = 'Network error or empty response';
        else message = JSON.stringify(error, null, 2);
    }

    return (
        <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-6 flex flex-col items-center">
                <TriangleAlert className="w-20 h-20 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold">Something went wrong</h1>
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 font-mono text-sm text-red-400 break-words whitespace-pre-wrap">
                    {message}
                </div>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="flex items-center gap-2 mx-auto px-6 py-2 bg-white text-black font-semibold rounded-full hover:bg-neutral-200 transition"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}
