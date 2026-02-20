export function LoadingScreen() {
    return (
        <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-neutral-800 border-t-white rounded-full animate-spin" />
            <p className="text-neutral-400 font-medium animate-pulse">
                Loading Study Sync...
            </p>
        </div>
    );
}
