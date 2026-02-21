import { Lock } from 'lucide-react';
import { useAuth } from 'react-oidc-context';

function NotWhitelistedView({ onSignOut }: { onSignOut?: () => void }) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-black text-white p-8">
            <div className="max-w-md text-center flex flex-col items-center space-y-6">
                <Lock className="w-20 h-20 text-neutral-600 mb-4" />
                <h1 className="text-3xl font-bold">Access Pending</h1>
                <p className="text-neutral-400">
                    Your account is waiting for administrator approval. Please
                    contact the administrator to get whitelisted for access to
                    course content.
                </p>
                {onSignOut ? (
                    <div className="pt-4">
                        <button
                            onClick={onSignOut}
                            className="px-6 py-2 bg-white text-black font-semibold rounded-full hover:bg-neutral-200 transition"
                        >
                            Sign Out
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function OidcNotWhitelisted() {
    const auth = useAuth();
    return <NotWhitelistedView onSignOut={() => void auth.signoutRedirect()} />;
}

export function NotWhitelisted() {
    const disableAuth = import.meta.env.VITE_DISABLE_AUTH !== '0';
    if (disableAuth) {
        return <NotWhitelistedView />;
    }

    return <OidcNotWhitelisted />;
}
