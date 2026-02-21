import {
    RouterProvider,
    createBrowserHistory,
    createHashHistory,
    createRouter,
} from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
// Import the generated route tree
import './app/app.css'; // Reuse existing CSS
import { routeTree } from './routeTree.gen';

// Create a new router instance
const isFileProtocol = window.location.protocol === 'file:';
const history = isFileProtocol ? createHashHistory() : createBrowserHistory();
const basepath = (() => {
    const candidate = (import.meta.env.BASE_URL ?? '/').trim();
    if (!candidate.startsWith('/')) {
        return '/';
    }
    return candidate.replace(/\/$/, '') || '/';
})();
const router = createRouter({ routeTree, history, basepath });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}

// Render the app
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <StrictMode>
            <RouterProvider router={router} />
        </StrictMode>,
    );
}
