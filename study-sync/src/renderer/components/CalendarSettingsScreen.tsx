import { Button, Input } from '@aryazos/ui/shadcn';
import { useEffect, useState } from 'react';

export function CalendarSettingsScreen() {
    const [url, setUrl] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const initialUrl = params.get('url');
        if (initialUrl) setUrl(initialUrl);
    }, []);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = url.trim();
        const encoded = encodeURIComponent(trimmed);
        window.location.href = `save-calendar://${encoded}`;
    };

    const handleCancel = () => {
        window.close();
    };

    return (
        <div className="h-screen w-screen bg-zinc-950 text-white select-none overflow-hidden flex flex-col">
            <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                <div className="flex-1 px-6 pt-6 pb-2 space-y-4">
                    <div className="space-y-2">
                        <label
                            htmlFor="calendar-url"
                            className="text-xs font-medium text-zinc-400 block ml-0.5"
                        >
                            Calendar feed URL
                        </label>
                        <Input
                            id="calendar-url"
                            type="text"
                            placeholder="https://example.com/calendar.ics"
                            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 h-9 text-sm focus-visible:ring-zinc-700"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            autoFocus
                        />
                        <p className="text-[11px] text-zinc-500">
                            Leave empty to disable server-side calendar sync.
                        </p>
                    </div>
                </div>

                <div className="px-6 pb-5 pt-2 flex gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCancel}
                        className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white h-9 text-xs font-medium"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="flex-1 bg-white hover:bg-zinc-200 text-black h-9 text-xs font-medium"
                    >
                        Save
                    </Button>
                </div>
            </form>
        </div>
    );
}
