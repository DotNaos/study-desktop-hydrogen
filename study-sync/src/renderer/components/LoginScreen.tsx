import { Button, Input } from '@aryazos/ui/shadcn';
import { useEffect, useState } from 'react';

export function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const initialEmail = params.get('username');
        const initialPassword = params.get('password');

        if (initialEmail) setEmail(initialEmail);
        if (initialPassword) setPassword('••••••••');
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === '••••••••' || !email || !password) return;
        const encodedUser = encodeURIComponent(email);
        const encodedPass = encodeURIComponent(password);
        window.location.href = `save-creds://${encodedUser}/${encodedPass}`;
    };

    const handleCancel = () => {
        window.close();
    };

    const handlePasswordFocus = () => {
        if (password === '••••••••') {
            setPassword('');
        }
    };

    return (
        <div className="h-screen w-screen bg-zinc-950 text-white select-none overflow-hidden flex flex-col">
            <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                {/* Draggable header area */}
                <div className="flex-1 px-6 pt-6 pb-2 space-y-4">
                    <div className="space-y-2">
                        <label
                            htmlFor="email"
                            className="text-xs font-medium text-zinc-400 block ml-0.5"
                        >
                            Email
                        </label>
                        <Input
                            id="email"
                            type="text"
                            placeholder="you@example.com"
                            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 h-9 text-sm focus-visible:ring-zinc-700"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <label
                            htmlFor="password"
                            className="text-xs font-medium text-zinc-400 block ml-0.5"
                        >
                            Password
                        </label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 h-9 text-sm focus-visible:ring-zinc-700"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={handlePasswordFocus}
                        />
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
