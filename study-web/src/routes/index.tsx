import { useAuth } from 'react-oidc-context';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { createSystemApiClient } from '@aryazos/system-api-client';
import { ErrorScreen } from '../app/components/ErrorScreen';
import { LoadingScreen } from '../app/components/LoadingScreen';
import { NotWhitelisted } from '../app/components/NotWhitelisted';
import { TreemapCanvas } from '../app/components/TreemapCanvas';
import { transformCoursesToZoomData } from '../app/zoomData';

export const Route = createFileRoute('/')({
    component: Home,
    validateSearch: (search: Record<string, unknown>) => ({
        focus: (search.focus as string) || undefined,
    }),
});

const client = createSystemApiClient();

function Home() {
    const auth = useAuth();
    const isLoaded = !auth.isLoading;
    const isSignedIn = auth.isAuthenticated;
    const navigate = Route.useNavigate();
    const { focus } = Route.useSearch();
    // Single-pass Full Tree Fetcher
    const fetchFullTree = async () => {
        // Auth is handled by Authentik ForwardAuth at the Traefik level,
        // so no Bearer token is needed for API calls through the proxy.
        const { data, error } = await client.GET('/nodes/subtree');

        if (error) throw error;
        return data?.nodes ?? [];
    };

    const {
        data: nodes,
        error,
        isError,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['nodes', 'full-tree-v2'],
        queryFn: fetchFullTree,
        enabled: !!isSignedIn && isLoaded,
        staleTime: Infinity,
        retry: 1,
    });

    if (!isLoaded || (isSignedIn && isLoading)) {
        return <LoadingScreen />;
    }

    if (isError) {
        const err = error as any;
        if (err.status === 403) {
            return <NotWhitelisted />;
        }
        return <ErrorScreen error={err} onRetry={refetch} />;
    }

    const safeNodes = Array.isArray(nodes) ? nodes : [];

    const buildTree = (flatNodes: any[]) => {
        const byId = new Map<string, any>();
        const roots: any[] = [];

        for (const node of flatNodes) {
            const displayName = node.name || node.title || node.id;

            byId.set(node.id, { ...node, name: displayName, children: [] });
        }

        for (const node of byId.values()) {
            if (node.parentId && byId.has(node.parentId)) {
                byId.get(node.parentId).children.push(node);
            } else {
                roots.push(node);
            }
        }

        return roots;
    };

    const mappedCourses = buildTree(safeNodes);

    const zoomData = transformCoursesToZoomData(mappedCourses as any);

    return (
        <div className="h-screen w-screen overflow-hidden bg-black text-white relative">
            <TreemapCanvas
                data={zoomData}
                focusId={focus}
                onFocusChange={(id: string) =>
                    navigate({ search: { focus: id } })
                }
            />
        </div>
    );
}
