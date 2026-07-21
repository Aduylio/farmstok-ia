import { z } from "zod";
import { sourceKeySchema } from "../knowledge-ingestion/knowledge-ingestion.schemas.js";

export const ragEvaluationCategories = [
  "TRIER",
  "COMPRAS",
  "ESTOQUE",
  "MEDICAMENTOS",
  "HISTORIA",
  "METODOLOGIA",
  "AMBIGUA",
  "PARAFRASE",
  "SEM_RESPOSTA",
] as const;
export const ragEvaluationAnswerTypes = [
  "DIRECT",
  "SYNTHESIS",
  "METADATA",
  "OUT_OF_SCOPE",
  "UNCERTAIN",
] as const;
export const ragEvaluationCaseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/u),
    category: z.enum(ragEvaluationCategories),
    answerType: z.enum(ragEvaluationAnswerTypes),
    question: z.string().trim().min(1).max(500),
    expectedSourceKeys: z.array(sourceKeySchema),
    forbiddenSourceKeys: z.array(sourceKeySchema),
    expectedTerms: z.array(z.string().trim().min(1)),
    optionalTerms: z.array(z.string().trim().min(1)),
    shouldFindResults: z.boolean(),
    shouldNeedHuman: z.boolean(),
    notes: z.string().trim().min(1),
    manualReviewNotes: z.string().trim().min(1).max(500).optional(),
    reviewStatus: z
      .enum(["CONFIRMED", "PENDING_MANUAL_REVIEW"])
      .optional()
      .default("PENDING_MANUAL_REVIEW"),
  })
  .superRefine((value, context) => {
    const forbidden = new Set(value.forbiddenSourceKeys);
    for (const key of value.expectedSourceKeys)
      if (forbidden.has(key))
        context.addIssue({
          code: "custom",
          message: "Uma sourceKey nao pode ser esperada e proibida.",
          path: ["forbiddenSourceKeys"],
        });
  });
export const ragEvaluationCasesSchema = z.array(ragEvaluationCaseSchema).min(1);
