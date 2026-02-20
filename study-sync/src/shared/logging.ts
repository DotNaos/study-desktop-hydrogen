export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerBackend {
    log: (
        channel: string,
        level: LogLevel,
        event: string | undefined,
        message: string,
        data?: unknown,
    ) => void;
}

type LogMethod = (message: string, data?: unknown) => void;

export interface ChannelLogger {
    trace: LogMethod;
    debug: LogMethod;
    info: LogMethod;
    warn: LogMethod;
    error: LogMethod;
    fatal: LogMethod;
}

const backends: LoggerBackend[] = [];

function parseChannelFilter(): RegExp[] {
    const raw = process.env.STUDY_SYNC_LOG_CHANNELS;
    if (!raw) return [];

    return raw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((pattern) => {
            const escaped = pattern
                .replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replaceAll('\\*', '.*');
            return new RegExp(`^${escaped}$`);
        });
}

const channelFilters = parseChannelFilter();

export function isChannelEnabled(channel: string): boolean {
    if (channelFilters.length === 0) return true;
    return channelFilters.some((filter) => filter.test(channel));
}

export function registerLoggerBackend(backend: LoggerBackend): void {
    backends.push(backend);
}

function formatData(data: unknown): string {
    if (data === undefined) return '';
    if (data instanceof Error) {
        return ` ${data.name}: ${data.message}`;
    }
    try {
        return ` ${JSON.stringify(data)}`;
    } catch {
        return ` ${String(data)}`;
    }
}

function consoleFallback(level: LogLevel, channel: string, message: string, data?: unknown): void {
    const line = `[${channel}] ${message}${formatData(data)}`;

    if (level === 'error' || level === 'fatal') {
        console.error(line);
        return;
    }
    if (level === 'warn') {
        console.warn(line);
        return;
    }
    if (level === 'debug' || level === 'trace') {
        console.debug(line);
        return;
    }
    console.log(line);
}

function write(channel: string, level: LogLevel, message: string, data?: unknown): void {
    if (!isChannelEnabled(channel)) return;

    if (backends.length === 0) {
        consoleFallback(level, channel, message, data);
        return;
    }

    for (const backend of backends) {
        backend.log(channel, level, undefined, message, data);
    }
}

export function createLogger(channel: string): ChannelLogger {
    return {
        trace: (message, data) => write(channel, 'trace', message, data),
        debug: (message, data) => write(channel, 'debug', message, data),
        info: (message, data) => write(channel, 'info', message, data),
        warn: (message, data) => write(channel, 'warn', message, data),
        error: (message, data) => write(channel, 'error', message, data),
        fatal: (message, data) => write(channel, 'fatal', message, data),
    };
}
