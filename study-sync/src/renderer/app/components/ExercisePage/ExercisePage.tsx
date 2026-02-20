import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useExerciseState } from '../../../hooks/useExerciseState'
import type { Exercise } from '../../../types/exercise'
import { ExerciseSheet } from './ExerciseSheet'
import { ScriptPreview } from './ScriptPreview'

interface Props {
    exercise: Exercise
    scriptContent: string
    onComplete?: () => void
    backLink?: string
}

export function ExercisePage({ exercise, scriptContent, backLink = '/' }: Props) {
    const exerciseState = useExerciseState(exercise)

    return (
        <div className="relative flex flex-col h-screen bg-black text-white">
            {/* Navigation header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 bg-neutral-900/50 shrink-0">
                <Link
                    to={backLink}
                    className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Zurück
                </Link>
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto">
                {/* Script preview */}
                <ScriptPreview
                    content={scriptContent}
                    sectionId={exercise.scriptReference?.sectionId}
                    anchor={exercise.scriptReference?.anchor}
                />

                {/* Exercise sheet */}
                <ExerciseSheet exercise={exercise} {...exerciseState} />
            </div>
        </div>
    )
}
