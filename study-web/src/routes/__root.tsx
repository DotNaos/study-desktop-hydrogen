import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { AuthGate } from '../app/components/AuthGate';
import { Providers } from '../app/providers';

export const Route = createRootRoute({
    component: () => (
        <Providers>
            <AuthGate>
                <Outlet />
                <TanStackRouterDevtools />
            </AuthGate>
        </Providers>
    ),
});
