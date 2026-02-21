export interface MoodleCourse {
  id: number;
  fullname: string;
  shortname: string;
  category: string;
  viewUrl: string;
}

export interface MoodleResource {
  id: string;
  name: string;
  url: string;
  type: "resource" | "folder" | "url" | "page";
  courseId: string;
  sectionId?: string;
  sectionName?: string;
  fileType?: string; // pdf, docx, etc. - detected from activity badge
}

export interface MoodleApiCourse {
  id: number;
  fullname: string;
  shortname: string;
  coursecategory: string;
  viewurl: string;
}

export interface MoodleApiResponse {
  error: boolean;
  data?: {
    courses: MoodleApiCourse[];
  };
  exception?: string;
}
