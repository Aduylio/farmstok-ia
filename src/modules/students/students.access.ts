import { StudentError } from "./students.errors.js";
import { courseAccessSchema } from "./students.schemas.js";
import type { StudentAccessDecision, StudentRecord } from "./students.types.js";

export function normalizeBrazilianPhone(input: string): string {
  const value = input.trim();
  if (!/^[+]?[\d ()-]+$/u.test(value) || !/\d/u.test(value))
    throw new StudentError("INVALID_PHONE");
  if (
    (value.match(/\+/gu)?.length ?? 0) > 1 ||
    (value.includes("+") && !value.startsWith("+"))
  )
    throw new StudentError("INVALID_PHONE");
  const digits = value.replace(/\D/gu, "");
  if (value.startsWith("+") && !digits.startsWith("55"))
    throw new StudentError("INVALID_PHONE");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length !== 10 && national.length !== 11)
    throw new StudentError("INVALID_PHONE");
  const ddd = Number(national.slice(0, 2));
  const subscriber = national.slice(2);
  if (ddd < 11 || ddd > 99) throw new StudentError("INVALID_PHONE");
  if (
    (subscriber.length === 9 && !subscriber.startsWith("9")) ||
    (subscriber.length === 8 && !/^[2-5]/u.test(subscriber))
  )
    throw new StudentError("INVALID_PHONE");
  return `55${national}`;
}

function validDateOnly(value: string): boolean {
  const date = new Date(`${value}T23:59:59.999Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function canUseAssistant(
  student: StudentRecord | null,
  course?: string,
  now = new Date(),
): StudentAccessDecision {
  if (student === null) return { allowed: false, reason: "STUDENT_NOT_FOUND" };
  if (student.status === "INACTIVE")
    return { allowed: false, reason: "STUDENT_INACTIVE" };
  if (student.status === "BLOCKED")
    return { allowed: false, reason: "STUDENT_BLOCKED" };
  if (
    student.accessExpiresAt !== null &&
    student.accessExpiresAt.getTime() < now.getTime()
  )
    return { allowed: false, reason: "COURSE_ACCESS_EXPIRED" };
  const parsed = courseAccessSchema.safeParse(student.courseAccess);
  if (
    !parsed.success ||
    (parsed.data.activeUntil !== undefined &&
      !validDateOnly(parsed.data.activeUntil))
  )
    return { allowed: false, reason: "INVALID_COURSE_ACCESS" };
  if (
    parsed.data.activeUntil !== undefined &&
    new Date(`${parsed.data.activeUntil}T23:59:59.999Z`).getTime() <
      now.getTime()
  )
    return { allowed: false, reason: "COURSE_ACCESS_EXPIRED" };
  if (course !== undefined && !parsed.data.courses.includes(course))
    return { allowed: false, reason: "COURSE_ACCESS_DENIED" };
  return { allowed: true, reason: null };
}
