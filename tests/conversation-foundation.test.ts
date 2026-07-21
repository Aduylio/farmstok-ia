import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { resolveAssistantAccess } from "../src/modules/conversations/conversations.access.js";
import { ConversationError } from "../src/modules/conversations/conversations.errors.js";
import {
  PrismaConversationsRepository,
  type ConversationsRepository,
} from "../src/modules/conversations/conversations.repository.js";
import {
  ConversationsService,
  resolveInboundConversation,
} from "../src/modules/conversations/conversations.service.js";
import type { ConversationRecord } from "../src/modules/conversations/conversations.types.js";
import {
  canUseAssistant,
  normalizeBrazilianPhone,
} from "../src/modules/students/students.access.js";
import { parseDemoStudentArgs } from "../src/modules/students/students.demo-cli.js";
import { StudentError } from "../src/modules/students/students.errors.js";
import type {
  CreateStudentData,
  StudentsRepository,
} from "../src/modules/students/students.repository.js";
import { StudentsService } from "../src/modules/students/students.service.js";
import type {
  StudentRecord,
  StudentStatus,
} from "../src/modules/students/students.types.js";

const student = (overrides: Partial<StudentRecord> = {}): StudentRecord => ({
  id: "00000000-0000-4000-8000-000000000001",
  name: "Aluno Teste",
  phone: "5511900000000",
  whatsappId: null,
  status: "ACTIVE",
  courseAccess: { courses: ["Farmstok"], activeUntil: "2027-07-20" },
  accessGrantedAt: new Date("2026-01-01T00:00:00Z"),
  accessExpiresAt: null,
  ...overrides,
});
const conversation = (
  overrides: Partial<ConversationRecord> = {},
): ConversationRecord => ({
  id: "00000000-0000-4000-8000-000000000002",
  studentId: student().id,
  consultantId: null,
  mode: "AI",
  kommoLeadId: null,
  modeChangedAt: null,
  modeChangedBy: null,
  ...overrides,
});

describe("telefone brasileiro", () => {
  it.each([
    ["+55 11 90000-0000", "5511900000000"],
    ["55 11 90000-0000", "5511900000000"],
    ["(11) 90000-0000", "5511900000000"],
    ["11900000000", "5511900000000"],
    ["5511900000000", "5511900000000"],
    ["(11) 3000-0000", "551130000000"],
  ])("normaliza %s", (input, expected) =>
    expect(normalizeBrazilianPhone(input)).toBe(expected),
  );
  it.each([
    "11ABC0000000",
    "11900000000 ramal 1",
    "900000000",
    "9000000000",
    "+1 212 555 0100",
    "551900000000",
  ])("rejeita entrada inválida %s", (input) =>
    expect(() => normalizeBrazilianPhone(input)).toThrow(
      "Nao foi possivel processar o aluno.",
    ),
  );
});

function studentRepository(
  initial: StudentRecord | null = null,
): StudentsRepository & Record<string, ReturnType<typeof vi.fn>> {
  let current = initial;
  return {
    findById: vi.fn(async () => current),
    findByPhone: vi.fn(async () => current),
    findByWhatsappId: vi.fn(async (id) =>
      current?.whatsappId === id ? current : null,
    ),
    create: vi.fn(
      async (data: CreateStudentData) =>
        (current = student({
          ...data,
          whatsappId: data.whatsappId ?? null,
          courseAccess: data.courseAccess ?? null,
        })),
    ),
    attachWhatsappId: vi.fn(
      async (_id, whatsappId) =>
        (current = student({ ...current, whatsappId })),
    ),
    updateCourseAccess: vi.fn(
      async (_id, courseAccess) =>
        (current = student({ ...current, courseAccess })),
    ),
    updateStatus: vi.fn(
      async (_id, status: StudentStatus) =>
        (current = student({ ...current, status })),
    ),
  };
}

describe("StudentsService", () => {
  it("findByPhone normaliza antes de consultar", async () => {
    const repository = studentRepository(student());
    await new StudentsService(repository).findByPhone("(11) 90000-0000");
    expect(repository.findByPhone).toHaveBeenCalledWith("5511900000000");
  });
  it("createStudent persiste nome e telefone normalizados", async () => {
    const repository = studentRepository();
    await new StudentsService(repository).createStudent({
      name: " Aluno Teste ",
      phone: "11900000000",
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Aluno Teste", phone: "5511900000000" }),
    );
  });
  it("findOrCreate reutiliza registro existente", async () => {
    const repository = studentRepository(student());
    const result = await new StudentsService(repository).findOrCreateByPhone({
      name: "Aluno Teste",
      phone: "11900000000",
    });
    expect(result.created).toBe(false);
    expect(repository.create).not.toHaveBeenCalled();
  });
  it("recupera registro após conflito concorrente de phone", async () => {
    const repository = studentRepository();
    const found = student();
    vi.mocked(repository.findByPhone)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(found);
    vi.mocked(repository.create).mockRejectedValueOnce(
      new StudentError("PHONE_CONFLICT"),
    );
    const result = await new StudentsService(repository).findOrCreateByPhone({
      name: "Aluno Teste",
      phone: "11900000000",
    });
    expect(result).toEqual({ student: found, created: false });
  });
  it("whatsappId igual é idempotente", async () => {
    const repository = studentRepository(student({ whatsappId: "wa-test" }));
    await new StudentsService(repository).attachWhatsappId(
      student().id,
      "wa-test",
    );
    expect(repository.attachWhatsappId).not.toHaveBeenCalled();
  });
  it("não sobrescreve whatsappId diferente", async () => {
    const repository = studentRepository(student({ whatsappId: "wa-a" }));
    await expect(
      new StudentsService(repository).attachWhatsappId(student().id, "wa-b"),
    ).rejects.toMatchObject({ code: "WHATSAPP_ID_CONFLICT" });
  });
});

describe("courseAccess e status", () => {
  it("autoriza ACTIVE com curso válido", () =>
    expect(
      canUseAssistant(student(), "Farmstok", new Date("2026-07-21T00:00:00Z")),
    ).toEqual({ allowed: true, reason: null }));
  it.each([
    ["INACTIVE", "STUDENT_INACTIVE"],
    ["BLOCKED", "STUDENT_BLOCKED"],
  ] as const)("nega status %s", (status, reason) =>
    expect(canUseAssistant(student({ status }), "Farmstok")).toMatchObject({
      allowed: false,
      reason,
    }),
  );
  it("nega JSON ausente ou inválido", () => {
    expect(
      canUseAssistant(student({ courseAccess: null }), "Farmstok").reason,
    ).toBe("INVALID_COURSE_ACCESS");
    expect(
      canUseAssistant(student({ courseAccess: { courses: [] } }), "Farmstok")
        .reason,
    ).toBe("INVALID_COURSE_ACCESS");
  });
  it("nega curso fora da lista", () =>
    expect(canUseAssistant(student(), "Outro").reason).toBe(
      "COURSE_ACCESS_DENIED",
    ));
  it("nega data vencida", () =>
    expect(
      canUseAssistant(
        student({
          courseAccess: { courses: ["Farmstok"], activeUntil: "2025-01-01" },
        }),
        "Farmstok",
        new Date("2026-01-01T00:00:00Z"),
      ).reason,
    ).toBe("COURSE_ACCESS_EXPIRED"));
  it("nega data impossível", () =>
    expect(
      canUseAssistant(
        student({
          courseAccess: { courses: ["Farmstok"], activeUntil: "2027-02-30" },
        }),
        "Farmstok",
      ).reason,
    ).toBe("INVALID_COURSE_ACCESS"));
});

function conversationRepository(
  initial: ConversationRecord | null = null,
): ConversationsRepository & Record<string, ReturnType<typeof vi.fn>> {
  let current = initial;
  return {
    findById: vi.fn(async () => current),
    findByStudentId: vi.fn(async () => current),
    findByKommoLeadId: vi.fn(async (lead) =>
      current?.kommoLeadId === lead ? current : null,
    ),
    create: vi.fn(
      async (studentId) => (current = conversation({ studentId, mode: "AI" })),
    ),
    attachKommoLead: vi.fn(
      async (_id, lead) =>
        (current = conversation({ ...current, kommoLeadId: lead })),
    ),
    transition: vi.fn(async (_id, mode, actor) => {
      current = conversation({
        ...current,
        mode,
        modeChangedBy: actor,
        modeChangedAt: new Date(),
      });
      return { conversation: current, changed: true };
    }),
  };
}

describe("ConversationsService", () => {
  it("cria Conversation inicial AI", async () => {
    const repository = conversationRepository();
    const result = await new ConversationsService(
      repository,
    ).getOrCreateForStudent(student().id);
    expect(result.created).toBe(true);
    expect(result.conversation.mode).toBe("AI");
  });
  it("reutiliza Conversation existente", async () => {
    const repository = conversationRepository(conversation());
    expect(
      (
        await new ConversationsService(repository).getOrCreateForStudent(
          student().id,
        )
      ).created,
    ).toBe(false);
    expect(repository.create).not.toHaveBeenCalled();
  });
  it("attachKommoLead igual é idempotente", async () => {
    const repository = conversationRepository(
      conversation({ kommoLeadId: "123" }),
    );
    await new ConversationsService(repository).attachKommoLead(
      conversation().id,
      123,
    );
    expect(repository.attachKommoLead).not.toHaveBeenCalled();
  });
  it("recusa lead associado a outro Student", async () => {
    const repository = conversationRepository(conversation());
    vi.mocked(repository.findByKommoLeadId).mockResolvedValueOnce(
      conversation({ studentId: "outro", kommoLeadId: "123" }),
    );
    await expect(
      new ConversationsService(repository).attachKommoLead(
        conversation().id,
        123,
      ),
    ).rejects.toMatchObject({ code: "KOMMO_LEAD_CONFLICT" });
  });
  it("transição real cria evento via repository", async () => {
    const repository = conversationRepository(conversation({ mode: "AI" }));
    const result = await new ConversationsService(repository).setModeBySystem(
      conversation().id,
      "PAUSED",
    );
    expect(result.changed).toBe(true);
    expect(repository.transition).toHaveBeenCalledWith(
      conversation().id,
      "PAUSED",
      "SYSTEM",
    );
  });
  it("transição repetida não cria evento", async () => {
    const repository = conversationRepository(conversation({ mode: "PAUSED" }));
    expect(
      (
        await new ConversationsService(repository).setModeBySystem(
          conversation().id,
          "PAUSED",
        )
      ).changed,
    ).toBe(false);
    expect(repository.transition).not.toHaveBeenCalled();
  });
  it("HUMAN é protegido de automação", async () => {
    const repository = conversationRepository(conversation({ mode: "HUMAN" }));
    await expect(
      new ConversationsService(repository).setModeBySystem(
        conversation().id,
        "AI",
      ),
    ).rejects.toBeInstanceOf(ConversationError);
  });
});

describe("persistência transacional de Conversation", () => {
  it("mudança real atualiza modo e cria evento na mesma transação", async () => {
    const update = vi.fn().mockResolvedValue(conversation({ mode: "PAUSED" }));
    const create = vi.fn().mockResolvedValue({});
    const transaction = {
      conversation: {
        findUnique: vi.fn().mockResolvedValue(conversation({ mode: "AI" })),
        update,
      },
      conversationEvent: { create },
    };
    const client = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
    } as unknown as PrismaClient;
    const result = await new PrismaConversationsRepository(client).transition(
      conversation().id,
      "PAUSED",
      "SYSTEM",
    );
    expect(result.changed).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mode: "PAUSED",
          modeChangedBy: "SYSTEM",
        }),
      }),
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "PAUSED", changedBy: "SYSTEM" }),
    });
  });
  it("estado repetido não atualiza nem cria evento", async () => {
    const update = vi.fn();
    const create = vi.fn();
    const transaction = {
      conversation: {
        findUnique: vi.fn().mockResolvedValue(conversation({ mode: "AI" })),
        update,
      },
      conversationEvent: { create },
    };
    const client = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
    } as unknown as PrismaClient;
    const result = await new PrismaConversationsRepository(client).transition(
      conversation().id,
      "AI",
      "CONSULTANT",
    );
    expect(result.changed).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("autorização e resolução inbound", () => {
  it.each([
    ["AI", true, null],
    ["PAUSED", false, "CONVERSATION_PAUSED"],
    ["HUMAN", false, "CONVERSATION_HUMAN"],
  ] as const)("modo %s", (mode, allowed, reason) =>
    expect(
      resolveAssistantAccess({
        student: student(),
        conversation: conversation({ mode }),
        course: "Farmstok",
        now: new Date("2026-07-21"),
      }),
    ).toMatchObject({ allowed, reason }),
  );
  it("nega Student ou Conversation inexistente", () => {
    expect(
      resolveAssistantAccess({ student: null, conversation: null }).reason,
    ).toBe("STUDENT_NOT_FOUND");
    expect(
      resolveAssistantAccess({ student: student(), conversation: null }).reason,
    ).toBe("CONVERSATION_NOT_FOUND");
  });
  it("resolve Student cadastrado e Conversation existente", async () => {
    const students = new StudentsService(studentRepository(student()));
    const conversations = new ConversationsService(
      conversationRepository(conversation()),
    );
    await expect(
      resolveInboundConversation(
        { phone: "11900000000", course: "Farmstok" },
        students,
        conversations,
      ),
    ).resolves.toMatchObject({
      studentId: student().id,
      conversationId: conversation().id,
      allowed: true,
    });
  });
  it("número desconhecido não cria Student", async () => {
    const repository = studentRepository();
    const result = await resolveInboundConversation(
      { phone: "11900000000" },
      new StudentsService(repository),
      new ConversationsService(conversationRepository()),
    );
    expect(result.reason).toBe("STUDENT_NOT_FOUND");
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("scripts seguros", () => {
  it("demo é dry-run por padrão e execute exige confirmação", () => {
    expect(
      parseDemoStudentArgs(["--name", "Aluno Teste", "--phone", "11900000000"])
        .execute,
    ).toBe(false);
    expect(() =>
      parseDemoStudentArgs([
        "--execute",
        "--name",
        "Aluno Teste",
        "--phone",
        "11900000000",
      ]),
    ).toThrow("CONFIRMATION_REQUIRED");
  });
  it("auditoria não seleciona nem imprime PII", async () => {
    const source = await readFile(
      "scripts/check-conversation-foundation.ts",
      "utf8",
    );
    expect(source).not.toContain("course_access");
    expect(source).not.toContain("messages.content");
    expect(source).not.toContain("answer_logs.question");
    expect(source).not.toContain("answer_logs.answer");
    expect(source).not.toContain("console.log(phone");
  });
});
