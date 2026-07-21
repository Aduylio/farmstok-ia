import type { z } from "zod";
import type {
  ragEvaluationCaseSchema,
  ragEvaluationCategories,
  ragEvaluationAnswerTypes,
} from "./rag-evaluation.schemas.js";
export type RagEvaluationCase = z.infer<typeof ragEvaluationCaseSchema>;
export type RagEvaluationCategory = (typeof ragEvaluationCategories)[number];
export type RagEvaluationAnswerType = (typeof ragEvaluationAnswerTypes)[number];
export type RagEvaluationMode = "TEXT" | "VECTOR" | "HYBRID" | "ANSWER";
export type RagEvaluationStatus = "PASS" | "PARTIAL" | "FAIL" | "SKIPPED";
export interface EvaluationSearchResult {
  chunkId: string;
  content: string;
  sourceKey: string;
  title: string;
  module: string | null;
}
export interface RagCaseResult {
  id: string;
  category: RagEvaluationCategory;
  answerType: RagEvaluationAnswerType;
  reviewStatus: "CONFIRMED" | "PENDING_MANUAL_REVIEW";
  status: RagEvaluationStatus;
  resultsFound: number;
  expectedSourceAtTop1: boolean;
  expectedSourceInTop3: boolean;
  expectedSourceInTop5: boolean;
  forbiddenSourceReturned: boolean;
  expectedTermCoverage: number;
  reciprocalRank: number;
  topResults: Array<{ sourceKey: string; chunkId: string; excerpt: string }>;
}
export interface RagMetrics {
  pass: number;
  partial: number;
  fail: number;
  skipped: number;
  top1Accuracy: number;
  top3Accuracy: number;
  meanReciprocalRank: number;
  expectedTermCoverage: number;
}
export interface RagEvaluationReport {
  date: string;
  policyVersion: string;
  datasetVersion: string;
  evaluationPolicyVersion: string;
  mode: RagEvaluationMode;
  effectiveMode: string;
  cases: number;
  confirmedCases: number;
  pendingCases: number;
  metrics: RagMetrics;
  metricsByReviewStatus: { confirmed: RagMetrics; pending: RagMetrics };
  officialConfirmedMetrics: RagMetrics;
  exploratoryPendingMetrics: RagMetrics;
  metricsByAnswerType: Record<
    RagEvaluationAnswerType,
    RagMetrics & { cases: number; supported: number; rejectionRate?: number }
  >;
  countsByAnswerType: Record<RagEvaluationAnswerType, number>;
  results: RagCaseResult[];
  sources: number;
  chunks: number;
  configuration: Record<string, unknown>;
}
