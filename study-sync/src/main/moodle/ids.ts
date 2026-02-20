export type MoodleNodeKind = "course" | "resource" | "folder" | "file" | "section";

export interface MoodleCourseNodeId {
  kind: "course";
  courseId: string;
}

export interface MoodleSectionNodeId {
  kind: "section";
  courseId: string;
  sectionId: string;
}

export interface MoodleResourceNodeId {
  kind: "resource";
  courseId: string;
  resourceId: string;
}

export interface MoodleFolderNodeId {
  kind: "folder";
  courseId: string;
  folderId: string;
}

export interface MoodleFileNodeId {
  kind: "file";
  courseId: string;
  fileId: string;
}

export interface MoodleTermNodeId {
  kind: "term";
  termName: string;
}

export type MoodleNodeId =
  | MoodleCourseNodeId
  | MoodleSectionNodeId
  | MoodleResourceNodeId
  | MoodleFolderNodeId
  | MoodleFileNodeId
  | MoodleTermNodeId;

export function makeMoodleCourseId(courseId: string | number): string {
  return `moodle-course-${courseId}`;
}

export function makeMoodleTermId(termName: string): string {
  // Use a simplified term name for the ID to be safe
  const safeName = termName.replace(/[^a-zA-Z0-9]/g, "_");
  return `moodle-term-${safeName}`;
}

export function makeMoodleSectionId(
  courseId: string | number,
  sectionId: string | number,
): string {
  return `moodle-section-${courseId}-${sectionId}`;
}

export function makeMoodleResourceId(
  courseId: string | number,
  resourceId: string,
): string {
  return `moodle-resource-${courseId}-${resourceId}`;
}

export function makeMoodleFolderId(
  courseId: string | number,
  folderId: string | number,
): string {
  return `moodle-folder-${courseId}-${folderId}`;
}

export function makeMoodleFileId(
  courseId: string | number,
  fileId: string,
): string {
  return `moodle-file-${courseId}-${fileId}`;
}

export function parseMoodleNodeId(id: string): MoodleNodeId | null {
  let match = id.match(/^moodle-course-(\d+)$/);
  if (match) {
    return { kind: "course", courseId: match[1] };
  }

  match = id.match(/^moodle-term-(.+)$/);
  if (match) {
    // We cannot easily reverse the safe name to original name here.
    // However, the ID is mainly for lookup.
    // If we need the real name, we'd look it up or encode it better.
    // For now, let's assume simple terms.
    return { kind: "term", termName: match[1] };
  }

  match = id.match(/^moodle-section-(\d+)-(\d+)$/);
  if (match) {
    return {
      kind: "section",
      courseId: match[1],
      sectionId: match[2],
    };
  }

  match = id.match(/^moodle-resource-(\d+)-(.+)$/);
  if (match) {
    return {
      kind: "resource",
      courseId: match[1],
      resourceId: match[2],
    };
  }

  match = id.match(/^moodle-folder-(\d+)-(\d+)$/);
  if (match) {
    return {
      kind: "folder",
      courseId: match[1],
      folderId: match[2],
    };
  }

  match = id.match(/^moodle-file-(\d+)-(.+)$/);
  if (match) {
    return {
      kind: "file",
      courseId: match[1],
      fileId: match[2],
    };
  }

  return null;
}
