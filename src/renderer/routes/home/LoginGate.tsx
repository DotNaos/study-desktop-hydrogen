import type { FormEvent } from 'react';

interface LoginGateProps {
    authError: string | null;
    authStatusError?: string | null;
    loginUsername: string;
    loginPassword: string;
    loginSubmitting: boolean;
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function LoginGate({
    authError,
    authStatusError,
    loginUsername,
    loginPassword,
    loginSubmitting,
    onUsernameChange,
    onPasswordChange,
    onSubmit,
}: LoginGateProps) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
            <form
                className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4"
                onSubmit={onSubmit}
            >
                <div>
                    <h1 className="text-xl font-semibold text-slate-100">
                        Moodle Login
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Ohne validen Login ist die App gesperrt.
                    </p>
                </div>

                <label className="block text-sm text-slate-300">
                    Username
                    <input
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
                        autoComplete="username"
                        value={loginUsername}
                        onChange={(event) => onUsernameChange(event.target.value)}
                        placeholder="moodle username"
                    />
                </label>

                <label className="block text-sm text-slate-300">
                    Passwort
                    <input
                        type="password"
                        autoComplete="current-password"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
                        value={loginPassword}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        placeholder="moodle password"
                    />
                </label>

                {(authError || authStatusError) && (
                    <p className="text-sm text-rose-400">
                        {authError || authStatusError}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loginSubmitting}
                    className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loginSubmitting ? 'Prüfe Credentials...' : 'Einloggen'}
                </button>
            </form>
        </div>
    );
}
