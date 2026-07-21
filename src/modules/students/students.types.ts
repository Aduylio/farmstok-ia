export type StudentStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export interface StudentRecord {
  id: string;
  name: string;
  phone: string;
  whatsappId: string | null;
  status: StudentStatus;
  courseAccess: unknown;
  accessGrantedAt: Date;
  accessExpiresAt: Date | null;
}

export type StudentAccessReason =
  | "STUDENT_NOT_FOUND"
  | "STUDENT_INACTIVE"
  | "STUDENT_BLOCKED"
  | "INVALID_COURSE_ACCESS"
  | "COURSE_ACCESS_DENIED"
  | "COURSE_ACCESS_EXPIRED";

export interface StudentAccessDecision {
  allowed: boolean;
  reason: StudentAccessReason | null;
}
