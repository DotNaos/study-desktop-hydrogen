import { getUserAttempt, upsertUserAttempt } from './db';

const server = Bun.serve({
    // Needed for local dev stack: Traefik routes /apps/study -> host port 3340.
    hostname: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
    async fetch(req) {
        const url = new URL(req.url);

        // CORS
        if (req.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
            });
        }

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*', // For development
        };

        const apiHeaders = {
            ...corsHeaders,
            'Content-Type': 'application/json',
        };

        // GET /api/courses
        if (req.method === 'GET' && url.pathname === '/api/courses') {
            try {
                // Proxy to study-sync service
                // Propagate headers for auth (Authentik ForwardAuth)
                const upstreamRes = await fetch(
                    'https://study-sync.aryazos.ch/api/courses',
                    {
                        headers: req.headers,
                    },
                );

                if (!upstreamRes.ok) {
                    console.error(
                        'Upstream error:',
                        upstreamRes.status,
                        await upstreamRes.text(),
                    );
                    // Fallback to empty list or local DB if needed, but for now propagate error or empty
                    return new Response(JSON.stringify([]), {
                        headers: apiHeaders,
                    });
                }

                const courses = await upstreamRes.json();
                return new Response(JSON.stringify(courses), {
                    headers: apiHeaders,
                });
            } catch (e) {
                console.error('Failed to fetch from upstream', e);
                return new Response(JSON.stringify([]), {
                    headers: apiHeaders,
                });
            }
        }

        // GET /api/task/:taskId/attempt?userId=...
        if (
            req.method === 'GET' &&
            url.pathname.match(/^\/api\/task\/[^/]+\/attempt$/)
        ) {
            const taskId = url.pathname.split('/')[3];
            const userId = url.searchParams.get('userId');

            if (!userId)
                return new Response('Missing userId', {
                    status: 400,
                    headers: corsHeaders,
                });

            const attempt = getUserAttempt.get({
                $userId: userId as string,
                $taskId: taskId as string,
            });
            return new Response(JSON.stringify(attempt || { code: '' }), {
                headers: apiHeaders,
            });
        }

        // POST /api/task/:taskId/attempt
        if (
            req.method === 'POST' &&
            url.pathname.match(/^\/api\/task\/[^/]+\/attempt$/)
        ) {
            const taskId = url.pathname.split('/')[3];
            const body = (await req.json()) as any;
            const { userId, code } = body;

            if (!userId)
                return new Response('Missing userId', {
                    status: 400,
                    headers: corsHeaders,
                });

            upsertUserAttempt.run({
                $userId: userId,
                $taskId: taskId,
                $code: code,
            });
            return new Response(JSON.stringify({ success: true }), {
                headers: apiHeaders,
            });
        }

        // Proxy all other /api/* routes to study-sync service
        if (url.pathname.startsWith('/api/')) {
            try {
                const upstreamUrl = `https://study-sync.aryazos.ch${url.pathname}${url.search}`;
                // Forward relevant headers but not Host (which would be wrong for upstream)
                const forwardHeaders = new Headers();
                for (const [key, value] of req.headers.entries()) {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey !== 'host' && lowerKey !== 'connection') {
                        forwardHeaders.set(key, value);
                    }
                }
                const upstreamRes = await fetch(upstreamUrl, {
                    method: req.method,
                    headers: forwardHeaders,
                    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
                });

                return new Response(upstreamRes.body, {
                    status: upstreamRes.status,
                    headers: {
                        ...Object.fromEntries(upstreamRes.headers.entries()),
                        ...corsHeaders,
                    },
                });
            } catch (e) {
                console.error('Failed to proxy to upstream:', url.pathname, e);
                return new Response(JSON.stringify({ error: 'Upstream service unavailable' }), {
                    status: 502,
                    headers: apiHeaders,
                });
            }
        }

        // Serve static files from ./build/client
        const buildPath = './build/client';
        const urlPath = new URL(req.url).pathname;
        const filePath = urlPath === '/' ? '/index.html' : urlPath;
        const file = Bun.file(`${buildPath}${filePath}`);

        if (await file.exists()) {
            return new Response(file, { headers: corsHeaders });
        }

        // SPA Fallback (index.html) for non-API routes
        if (!url.pathname.startsWith('/api')) {
            const indexFile = Bun.file(`${buildPath}/index.html`);
            if (await indexFile.exists()) {
                return new Response(indexFile, { headers: corsHeaders });
            }
            return new Response(
                "Frontend not built. Run 'bun run build' first.",
                { status: 404, headers: corsHeaders },
            );
        }

        return new Response('Not Found', { status: 404, headers: corsHeaders });
    },
});

console.log(`Listening on localhost:${server.port}`);
