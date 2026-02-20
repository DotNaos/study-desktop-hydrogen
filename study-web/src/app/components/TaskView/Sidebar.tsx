import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import type { Chapter, Task } from '../../mockData';

interface SidebarProps {
    chapters: Chapter[];
    currentTaskId: string;
    courseId: string;
}

export const Sidebar = ({
    chapters,
    currentTaskId,
    courseId,
}: SidebarProps) => {
    return (
        <div className="w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full overflow-y-auto shrink-0">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 sticky top-0 backdrop-blur-sm z-10">
                <Link
                    to="/"
                    search={{ focus: undefined }}
                    className="text-sm text-zinc-400 hover:text-white flex items-center gap-1 mb-3 transition-colors"
                >
                    <ChevronLeft size={14} /> Back to Courses
                </Link>
                <h2 className="font-bold text-zinc-200 tracking-tight">
                    Course Content
                </h2>
            </div>

            <div className="flex-1 py-4">
                {chapters.map((chapter) => (
                    <div key={chapter.id} className="mb-8">
                        <div className="px-5 mb-3 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                            {chapter.title}
                        </div>
                        <ul className="space-y-1">
                            {chapter.tasks.map((task: Task) => {
                                const isActive = task.id === currentTaskId;
                                return (
                                    <li key={task.id}>
                                        <Link
                                            to="/course/$courseId/task/$taskId"
                                            params={{
                                                courseId,
                                                taskId: task.id,
                                            }}
                                            className={`
                                                flex items-center gap-3 px-5 py-2.5 text-sm transition-all border-l-[3px]
                                                ${
                                                    isActive
                                                        ? 'bg-zinc-900 text-white border-blue-500 font-medium'
                                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 border-transparent'
                                                }
                                            `}
                                        >
                                            {/* Mock "Completed" indicator */}
                                            <div
                                                className={`
                                                w-2 h-2 rounded-full ring-2 ring-offset-2 ring-offset-zinc-950 transition-colors
                                                ${isActive ? 'bg-blue-500 ring-blue-500/30' : 'bg-transparent border border-zinc-600 ring-transparent'}
                                            `}
                                            />
                                            <span className="truncate leading-tight">
                                                {task.title}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};
