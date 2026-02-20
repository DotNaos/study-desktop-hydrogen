import { createLogger } from '@aryazos/ts-base/logging';

const logger = createLogger('com.aryazos.study-sync.calendar.feed');

export type CalendarFeedError =
    | 'CALENDAR_URL_NOT_CONFIGURED'
    | 'CALENDAR_URL_INVALID'
    | 'CALENDAR_FETCH_FAILED'
    | 'CALENDAR_EMPTY';

export type CalendarFeedResult =
    | { ok: true; text: string }
    | { ok: false; error: CalendarFeedError };

export function resolveCalendarUrl(): string | null {
    const raw = process.env.STUDY_SYNC_CALENDAR_URL?.trim();
    return raw ? raw : null;
}

export async function fetchCalendarFeedText(): Promise<CalendarFeedResult> {
    const calendarUrl = resolveCalendarUrl();
    if (!calendarUrl) {
        return { ok: false, error: 'CALENDAR_URL_NOT_CONFIGURED' };
    }

    let url: URL;
    try {
        url = new URL(calendarUrl);
    } catch (error) {
        logger.warn('Invalid calendar URL', { error });
        return { ok: false, error: 'CALENDAR_URL_INVALID' };
    }

    try {
        const response = await fetch(url, {
            headers: { Accept: 'text/calendar,*/*' },
        });

        if (!response.ok) {
            return { ok: false, error: 'CALENDAR_FETCH_FAILED' };
        }

        const body = await response.text();
        if (!body) {
            return { ok: false, error: 'CALENDAR_EMPTY' };
        }

        return { ok: true, text: body };
    } catch (error) {
        logger.error('Calendar fetch failed', { error });
        return { ok: false, error: 'CALENDAR_FETCH_FAILED' };
    }
}
