export type NodeType = 'folder' | 'item';

export interface Node {
    id: string;
    name: string;
    type: NodeType;
    isComplete?: boolean;
    progress?: number; // 0-100 percentage
    children?: Node[];
    // Metadata for navigation
    courseId?: string;
    taskId?: string;
}

export function transformCoursesToZoomData(courses: any[]): Node {
    const mapNode = (node: any, parentCourseId?: string): Node => {
        const rawChildren = node.children || node.chapters || [];
        const hasChildren = rawChildren.length > 0;

        let type: 'folder' | 'item' = hasChildren ? 'folder' : 'item';

        if (node.type) {
            type = node.type;
        } else if (!hasChildren) {
            const idStr = String(node.id).toLowerCase();
            if (idStr.includes('task')) {
                type = 'item';
            } else {
                // Default to folder for Terms/Courses that might be empty initially
                type = 'folder';
            }
        }

        // Map progress field from API (0-100) or backwards-compat isCompleted boolean
        const progress = node.progress !== undefined
            ? node.progress
            : node.isCompleted === true
                ? 100
                : node.isCompleted === false
                    ? 0
                    : undefined;

        // Determine courseId: use node's own courseId, or inherit from parent, or use node.id if this is a top-level course
        const courseId = node.courseId || parentCourseId || (parentCourseId === undefined ? node.id : undefined);

        // Set taskId for all leaf nodes (no children), not just type === 'item'
        const isLeaf = !hasChildren;

        return {
            id: node.id,
            name: node.title || node.name || 'Untitled',
            type,
            progress,
            isComplete: progress === 100 || node.isCompleted === true,
            children: rawChildren.map((child: any) => mapNode(child, courseId)),
            courseId,
            taskId: isLeaf ? node.id : undefined,
        };
    };

    return {
        id: 'root',
        name: 'All Courses',
        type: 'folder',
        children: courses.map((course) => mapNode(course)),
    };
}
