import { AuthProvider } from 'react-oidc-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const oidcConfig = {
    authority: import.meta.env.VITE_OIDC_AUTHORITY || 'https://aryazos.localhost/application/o/aryazos/',
    client_id: import.meta.env.VITE_OIDC_CLIENT_ID || 'aryazos',
    redirect_uri: window.location.origin + '/apps/study/oidc-callback',
    post_logout_redirect_uri: window.location.origin + '/apps/study/',
    scope: 'openid profile email',
    automaticSilentRenew: true,
};

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <AuthProvider {...oidcConfig}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </AuthProvider>
    );
}
