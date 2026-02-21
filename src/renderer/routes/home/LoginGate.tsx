import { Button } from '@heroui/react';
import type { FormEvent } from 'react';

interface LoginGateProps {
    authError: string | null;
    authStatusError?: string | null;
    loginUsername: string;
    loginPassword: string;
    loginSubmitting: boolean;
    rememberMe: boolean;
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onRememberMeChange: (value: boolean) => void;
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
    rememberMe,
    onUsernameChange,
    onPasswordChange,
    onRememberMeChange,
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
        <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-950 px-4">
            <form
                className="relative z-10 w-full max-w-sm rounded-[1rem] bg-[#111116] border border-[#22222a] p-8 shadow-2xl space-y-7"
                onSubmit={onSubmit}
            >
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-semibold text-slate-100">
                        Study Desktop
                    </h1>
                    {infoMessage && (
                        <p className="text-[13px] text-slate-400 mt-2">
                            {infoMessage}
                        </p>
                    )}
                </div>

                <div className="space-y-5">
                    <div>
                        <span className="block text-sm text-slate-400 font-medium mb-1.5">
                            Username
                        </span>
                        <input
                            type="text"
                            autoComplete="username"
                            className="w-full h-11 px-3 mt-1.5 bg-[#18181f] border border-[#2a2a35] hover:bg-[#1d1d26] hover:border-[#353545] focus:bg-[#18181f] focus:border-cyan-500 focus:outline-none rounded-lg text-slate-100 placeholder:text-slate-600 transition-colors shadow-none"
                            value={loginUsername}
                            onChange={(e) => onUsernameChange(e.target.value)}
                            placeholder="Benutzername"
                            autoFocus
                        />
                    </div>

                    <div>
                        <span className="block text-sm text-slate-400 font-medium mb-1.5">
                            Passwort
                        </span>
                        <input
                            type="password"
                            autoComplete="current-password"
                            className="w-full h-11 px-3 mt-1.5 bg-[#18181f] border border-[#2a2a35] hover:bg-[#1d1d26] hover:border-[#353545] focus:bg-[#18181f] focus:border-cyan-500 focus:outline-none rounded-lg text-slate-100 placeholder:text-slate-600 transition-colors shadow-none"
                            value={loginPassword}
                            onChange={(e) => onPasswordChange(e.target.value)}
                            placeholder="Dein Passwort"
                        />
                    </div>

                    <label className="flex items-center gap-2.5 cursor-pointer mt-2 group">
                        <div className="relative flex items-center justify-center w-[18px] h-[18px] rounded border-2 border-slate-600 bg-[#111116] group-hover:border-slate-500 transition-colors overflow-hidden">
                            <input
                                type="checkbox"
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 m-0"
                                checked={rememberMe}
                                onChange={(e) =>
                                    onRememberMeChange?.(e.target.checked)
                                }
                            />
                            {rememberMe && (
                                <div className="absolute inset-0 bg-cyan-500 border-cyan-500 flex items-center justify-center pointer-events-none">
                                    <svg
                                        className="w-3 h-3 text-white"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={3.5}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <span className="text-slate-300 text-[13.5px] select-none">
                            Eingeloggt bleiben
                        </span>
                    </label>
                </div>

                {errorMessage && (
                    <p className="rounded-md border border-rose-500/30 bg-rose-900/20 px-3 py-2 text-sm text-rose-300">
                        {errorMessage}
                    </p>
                )}

                <Button
                    type="submit"
                    isDisabled={loginSubmitting}
                    className="w-full font-medium bg-white text-black hover:bg-slate-200"
                >
                    Einloggen
                </Button>
            </form>
        </div>
    );
}
