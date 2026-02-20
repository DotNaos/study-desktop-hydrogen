import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from 'react-oidc-context';

function buildOidcConfig() {
    const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '';
    const origin = window.location.origin;
    const callbackPath = `${basePath}/oidc-callback`.replace('//', '/');

    return {
        authority:
            import.meta.env.VITE_OIDC_AUTHORITY ||
            'https://aryazos.localhost/application/o/aryazos/',
        client_id: import.meta.env.VITE_OIDC_CLIENT_ID || 'aryazos',
        redirect_uri: `${origin}${callbackPath}`,
        post_logout_redirect_uri: `${origin}${basePath || '/'}`,
        scope: 'openid profile email',
        automaticSilentRenew: true,
    };
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());
    const disableAuth = import.meta.env.VITE_DISABLE_AUTH !== '0';

    if (disableAuth) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    return (
        <AuthProvider {...buildOidcConfig()}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </AuthProvider>
    );
}
