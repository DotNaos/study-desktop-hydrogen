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

function mapAuthMessage(codeOrMessage: string): string {
    switch (codeOrMessage) {
        case 'AUTH_REQUIRED':
            return 'Bitte melde dich mit deinen Moodle-Zugangsdaten an.';
        case 'LOGIN_FAILED':
            return 'Login fehlgeschlagen. Bitte prüfe Benutzername und Passwort.';
        case 'INVALID_CREDENTIALS':
            return 'Ungültige Zugangsdaten. Bitte erneut versuchen.';
        default:
            return codeOrMessage;
    }
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
    const mappedAuthError = authError ? mapAuthMessage(authError) : null;
    const mappedStatusError = authStatusError
        ? mapAuthMessage(authStatusError)
        : null;
    const infoMessage =
        !mappedAuthError && authStatusError === 'AUTH_REQUIRED'
            ? mappedStatusError
            : null;
    const errorMessage =
        mappedAuthError ||
        (mappedStatusError && authStatusError !== 'AUTH_REQUIRED'
            ? mappedStatusError
            : null);

    return (
        <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-[#02081d] px-4">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
            </div>

            <form
                className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/60 bg-[#071636]/90 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur space-y-4"
                onSubmit={onSubmit}
            >
                <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">
                        Study Desktop
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold text-slate-100">Moodle Login</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Ohne validen Login ist die App gesperrt.
                    </p>
                    {infoMessage && (
                        <p className="mt-2 text-xs text-slate-300/90">{infoMessage}</p>
                    )}
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

                {errorMessage && (
                    <p className="rounded-md border border-rose-500/30 bg-rose-900/20 px-3 py-2 text-sm text-rose-300">
                        {errorMessage}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loginSubmitting}
                    className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loginSubmitting ? 'Prüfe Credentials...' : 'Einloggen'}
                </button>
            </form>
        </div>
    );
}
