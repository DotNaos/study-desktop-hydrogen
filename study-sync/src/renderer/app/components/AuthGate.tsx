import { useAuth } from 'react-oidc-context';

function OidcAuthGate({ children }: { children: React.ReactNode }) {
    const auth = useAuth();

    if (auth.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!auth.isAuthenticated) {
        void auth.signinRedirect();
        return null;
    }

    return <>{children}</>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
    const disableAuth = import.meta.env.VITE_DISABLE_AUTH !== '0';

    if (disableAuth) {
        return <>{children}</>;
    }

    return <OidcAuthGate>{children}</OidcAuthGate>;
}
