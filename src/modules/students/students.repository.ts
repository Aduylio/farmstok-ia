import { prisma } from "../../config/prisma.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { StudentError } from "./students.errors.js";
import type { StudentRecord, StudentStatus } from "./students.types.js";

const select = {
  id: true,
  name: true,
  phone: true,
  whatsappId: true,
  status: true,
  courseAccess: true,
  accessGrantedAt: true,
  accessExpiresAt: true,
} as const;

function uniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export interface CreateStudentData {
  name: string;
  phone: string;
  whatsappId?: string;
  courseAccess?: { courses: string[]; activeUntil?: string | undefined };
}

export interface StudentsRepository {
  findById(id: string): Promise<StudentRecord | null>;
  findByPhone(phone: string): Promise<StudentRecord | null>;
  findByWhatsappId(whatsappId: string): Promise<StudentRecord | null>;
  create(data: CreateStudentData): Promise<StudentRecord>;
  attachWhatsappId(id: string, whatsappId: string): Promise<StudentRecord>;
  updateCourseAccess(
    id: string,
    courseAccess: NonNullable<CreateStudentData["courseAccess"]>,
  ): Promise<StudentRecord>;
  updateStatus(id: string, status: StudentStatus): Promise<StudentRecord>;
}

export class PrismaStudentsRepository implements StudentsRepository {
  constructor(private readonly client: PrismaClient = prisma) {}
  findById(id: string) {
    return this.client.student.findUnique({
      where: { id },
      select,
    }) as Promise<StudentRecord | null>;
  }
  findByPhone(phone: string) {
    return this.client.student.findUnique({
      where: { phone },
      select,
    }) as Promise<StudentRecord | null>;
  }
  findByWhatsappId(whatsappId: string) {
    return this.client.student.findUnique({
      where: { whatsappId },
      select,
    }) as Promise<StudentRecord | null>;
  }
  async create(data: CreateStudentData): Promise<StudentRecord> {
    try {
      return (await this.client.student.create({
        data,
        select,
      })) as StudentRecord;
    } catch (error) {
      if (uniqueViolation(error)) throw new StudentError("PHONE_CONFLICT");
      throw error;
    }
  }
  async attachWhatsappId(
    id: string,
    whatsappId: string,
  ): Promise<StudentRecord> {
    try {
      return (await this.client.student.update({
        where: { id },
        data: { whatsappId },
        select,
      })) as StudentRecord;
    } catch (error) {
      if (uniqueViolation(error))
        throw new StudentError("WHATSAPP_ID_CONFLICT");
      throw error;
    }
  }
  updateCourseAccess(
    id: string,
    courseAccess: NonNullable<CreateStudentData["courseAccess"]>,
  ) {
    return this.client.student.update({
      where: { id },
      data: { courseAccess },
      select,
    }) as Promise<StudentRecord>;
  }
  updateStatus(id: string, status: StudentStatus) {
    return this.client.student.update({
      where: { id },
      data: { status },
      select,
    }) as Promise<StudentRecord>;
  }
}
