import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
// Import the generated route tree
import './app/app.css'; // Reuse existing CSS
import { routeTree } from './routeTree.gen';

// Create a new router instance
const basepath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '/';
const router = createRouter({ routeTree, basepath });

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
