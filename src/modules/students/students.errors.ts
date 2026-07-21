export type StudentErrorCode =
  | "INVALID_PHONE"
  | "PHONE_CONFLICT"
  | "WHATSAPP_ID_CONFLICT"
  | "STUDENT_NOT_FOUND";

export class StudentError extends Error {
  constructor(readonly code: StudentErrorCode) {
    super("Nao foi possivel processar o aluno.");
    this.name = "StudentError";
  }
}
