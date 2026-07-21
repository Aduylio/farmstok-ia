import { canUseAssistant, normalizeBrazilianPhone } from "./students.access.js";
import { StudentError } from "./students.errors.js";
import {
  courseAccessSchema,
  studentNameSchema,
  whatsappIdSchema,
} from "./students.schemas.js";
import type {
  CreateStudentData,
  StudentsRepository,
} from "./students.repository.js";
import type { StudentStatus } from "./students.types.js";

export class StudentsService {
  constructor(private readonly repository: StudentsRepository) {}
  findById(id: string) {
    return this.repository.findById(id);
  }
  findByPhone(phone: string) {
    return this.repository.findByPhone(normalizeBrazilianPhone(phone));
  }
  findByWhatsappId(value: string) {
    return this.repository.findByWhatsappId(whatsappIdSchema.parse(value));
  }
  createStudent(input: Omit<CreateStudentData, "phone"> & { phone: string }) {
    return this.repository.create({
      ...input,
      name: studentNameSchema.parse(input.name),
      phone: normalizeBrazilianPhone(input.phone),
      ...(input.courseAccess === undefined
        ? {}
        : { courseAccess: courseAccessSchema.parse(input.courseAccess) }),
    });
  }
  async findOrCreateByPhone(
    input: Omit<CreateStudentData, "phone"> & { phone: string },
  ) {
    const phone = normalizeBrazilianPhone(input.phone);
    const existing = await this.repository.findByPhone(phone);
    if (existing !== null) return { student: existing, created: false };
    try {
      return {
        student: await this.repository.create({
          ...input,
          name: studentNameSchema.parse(input.name),
          phone,
          ...(input.courseAccess === undefined
            ? {}
            : { courseAccess: courseAccessSchema.parse(input.courseAccess) }),
        }),
        created: true,
      };
    } catch (error) {
      if (!(error instanceof StudentError) || error.code !== "PHONE_CONFLICT")
        throw error;
      const concurrent = await this.repository.findByPhone(phone);
      if (concurrent === null) throw error;
      return { student: concurrent, created: false };
    }
  }
  async attachWhatsappId(studentId: string, value: string) {
    const whatsappId = whatsappIdSchema.parse(value);
    const student = await this.repository.findById(studentId);
    if (student === null) throw new StudentError("STUDENT_NOT_FOUND");
    if (student.whatsappId === whatsappId) return student;
    if (student.whatsappId !== null)
      throw new StudentError("WHATSAPP_ID_CONFLICT");
    const owner = await this.repository.findByWhatsappId(whatsappId);
    if (owner !== null && owner.id !== studentId)
      throw new StudentError("WHATSAPP_ID_CONFLICT");
    return this.repository.attachWhatsappId(studentId, whatsappId);
  }
  updateCourseAccess(
    id: string,
    value: NonNullable<CreateStudentData["courseAccess"]>,
  ) {
    return this.repository.updateCourseAccess(
      id,
      courseAccessSchema.parse(value),
    );
  }
  updateStatus(id: string, status: StudentStatus) {
    return this.repository.updateStatus(id, status);
  }
  async canUseAssistant(id: string, course?: string, now?: Date) {
    return canUseAssistant(await this.repository.findById(id), course, now);
  }
}
