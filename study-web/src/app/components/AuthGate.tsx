import { useAuth } from 'react-oidc-context';

export function AuthGate({ children }: { children: React.ReactNode }) {
    const auth = useAuth();

    if (auth.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!auth.isAuthenticated) {
        auth.signinRedirect();
        return null;
    }

    return <>{children}</>;
}
