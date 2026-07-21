import { prisma } from "../src/config/prisma.js";
import { kommoLeadIdSchema } from "../src/modules/conversations/conversations.schemas.js";
import { normalizeBrazilianPhone } from "../src/modules/students/students.access.js";
import { parseDemoStudentArgs } from "../src/modules/students/students.demo-cli.js";
import {
  courseAccessSchema,
  whatsappIdSchema,
} from "../src/modules/students/students.schemas.js";

try {
  const options = parseDemoStudentArgs(process.argv.slice(2));
  const phone = normalizeBrazilianPhone(options.phone);
  const whatsappId =
    options.whatsappId === undefined
      ? undefined
      : whatsappIdSchema.parse(options.whatsappId);
  const kommoLeadId =
    options.kommoLeadId === undefined
      ? undefined
      : kommoLeadIdSchema.parse(options.kommoLeadId);
  const courseAccess = courseAccessSchema.parse({
    courses: [options.course ?? "Farmstok"],
    ...(options.activeUntil === undefined
      ? {}
      : { activeUntil: options.activeUntil }),
  });
  const existing = await prisma.student.findUnique({
    where: { phone },
    select: {
      id: true,
      whatsappId: true,
      conversations: {
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 1,
        select: { id: true, kommoLeadId: true },
      },
    },
  });
  console.log(`Modo: ${options.execute ? "EXECUTE" : "DRY_RUN"}`);
  console.log(`Telefone normalizado: ${phone}`);
  console.log(
    `Student: ${existing === null ? "seria criado" : "seria reutilizado"}`,
  );
  console.log(
    `Conversation: ${existing?.conversations[0] === undefined ? "seria criada" : "seria reutilizada"}`,
  );
  if (options.execute) {
    await prisma.$transaction(async (transaction) => {
      let currentStudent = await transaction.student.findUnique({
        where: { phone },
        select: { id: true, whatsappId: true },
      });
      if (currentStudent === null)
        currentStudent = await transaction.student.create({
          data: {
            name: options.name,
            phone,
            courseAccess,
            ...(whatsappId === undefined ? {} : { whatsappId }),
          },
          select: { id: true, whatsappId: true },
        });
      else if (
        whatsappId !== undefined &&
        currentStudent.whatsappId !== null &&
        currentStudent.whatsappId !== whatsappId
      )
        throw new Error("WHATSAPP_ID_CONFLICT");
      else if (whatsappId !== undefined && currentStudent.whatsappId === null)
        currentStudent = await transaction.student.update({
          where: { id: currentStudent.id },
          data: { whatsappId },
          select: { id: true, whatsappId: true },
        });
      let conversation = await transaction.conversation.findFirst({
        where: { studentId: currentStudent.id },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: { id: true, kommoLeadId: true },
      });
      if (conversation === null)
        conversation = await transaction.conversation.create({
          data: { studentId: currentStudent.id, mode: "AI" },
          select: { id: true, kommoLeadId: true },
        });
      if (
        kommoLeadId !== undefined &&
        conversation.kommoLeadId !== null &&
        conversation.kommoLeadId !== kommoLeadId
      )
        throw new Error("KOMMO_LEAD_CONFLICT");
      if (kommoLeadId !== undefined && conversation.kommoLeadId === null) {
        const leadOwner = await transaction.conversation.findUnique({
          where: { kommoLeadId },
          select: { studentId: true },
        });
        if (leadOwner !== null && leadOwner.studentId !== currentStudent.id)
          throw new Error("KOMMO_LEAD_CONFLICT");
        await transaction.conversation.update({
          where: { id: conversation.id },
          data: { kommoLeadId },
        });
      }
    });
    console.log("Operacao concluida.");
  } else console.log("Nenhuma escrita executada.");
} catch {
  console.error("Nao foi possivel preparar o aluno de demonstracao.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
