export function getFallbackApiBase(): string {
    const fromEnv = import.meta.env.VITE_API_BASE;
    if (fromEnv && fromEnv.trim()) {
        return fromEnv.replace(/\/$/, '');
    }
    if (window.location.protocol === 'file:') {
        return 'http://127.0.0.1:3333/api';
    }
    return '/api';
}

export async function resolveApiBase(): Promise<string> {
    const fallback = getFallbackApiBase();
    try {
        const dynamicBase = await window.studySync?.getApiBase?.();
        if (dynamicBase && dynamicBase.trim()) {
            return dynamicBase.replace(/\/$/, '');
        }
    } catch {
        // fallback to static value
    }
    return fallback;
}

export async function readJson<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text.trim()) {
        return {} as T;
    }
    return JSON.parse(text) as T;
}
