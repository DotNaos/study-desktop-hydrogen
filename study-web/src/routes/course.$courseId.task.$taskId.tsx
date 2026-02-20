import { createFileRoute } from '@tanstack/react-router';
import { ExercisePage } from '../app/components/ExercisePage';
import {
    getDefaultMockExercise,
    MOCK_SCRIPT_CONTENT,
} from '../data/mockExercises';

export const Route = createFileRoute('/course/$courseId/task/$taskId')({
    component: TaskRoute,
});

function TaskRoute() {
    const { courseId } = Route.useParams();

    // For now, use mock data
    // TODO: Replace with real API calls to fetch exercise and script content
    const exercise = getDefaultMockExercise();
    const scriptContent = MOCK_SCRIPT_CONTENT;

    return (
        <ExercisePage
            exercise={exercise}
            scriptContent={scriptContent}
            backLink={`/?focus=${courseId}`}
        />
    );
}
