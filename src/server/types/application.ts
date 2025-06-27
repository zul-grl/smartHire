export interface AiSummary {
  firstname: string;
  lastname: string;
  skills: string[];
  summary: string;
}

export type ApplicationStatus = "shortlisted" | "pending";

export interface Application {
  _id: string;
  jobId: string;
  cvUrl: string;
  extractedText: string;
  matchPercentage: number;
  matchedSkills: string[];
  bookmarked: boolean;
  aiSummary: AiSummary;
  status: ApplicationStatus;
  createdAt: string;
}
