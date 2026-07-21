import type {
  EvaluationSearchResult,
  RagCaseResult,
  RagEvaluationCase,
  RagEvaluationAnswerType,
  RagEvaluationMode,
  RagEvaluationReport,
  RagMetrics,
} from "./rag-evaluation.types.js";

export interface EvaluationSearchResponse {
  results: EvaluationSearchResult[];
  effectiveMode: string;
  unavailable?: boolean;
}
export interface EvaluationSearchService {
  search(question: string): Promise<EvaluationSearchResponse>;
}
function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}
function round(value: number) {
  return Number(value.toFixed(6));
}
export function evaluateRetrievalCase(
  test: RagEvaluationCase,
  results: EvaluationSearchResult[],
): RagCaseResult {
  const expected = new Set(test.expectedSourceKeys);
  const topKeys = results.map((item) => item.sourceKey);
  const expectedRank = topKeys.findIndex((key) => expected.has(key));
  const searchable = normalize(
    results
      .slice(0, 5)
      .map((item) => `${item.title} ${item.module ?? ""} ${item.content}`)
      .join(" "),
  );
  const matched = test.expectedTerms.filter((term) =>
    searchable.includes(normalize(term)),
  ).length;
  const coverage =
    test.expectedTerms.length === 0 ? 1 : matched / test.expectedTerms.length;
  const forbidden = topKeys.some((key) =>
    test.forbiddenSourceKeys.includes(key),
  );
  let status: "PASS" | "PARTIAL" | "FAIL";
  if (!test.shouldFindResults) status = results.length === 0 ? "PASS" : "FAIL";
  else if (results.length === 0 || forbidden || expectedRank === -1)
    status = "FAIL";
  else if (expectedRank < 3 && coverage === 1) status = "PASS";
  else status = "PARTIAL";
  return {
    id: test.id,
    category: test.category,
    answerType: test.answerType,
    reviewStatus: test.reviewStatus,
    status,
    resultsFound: results.length,
    expectedSourceAtTop1: expectedRank === 0,
    expectedSourceInTop3: expectedRank >= 0 && expectedRank < 3,
    expectedSourceInTop5: expectedRank >= 0 && expectedRank < 5,
    forbiddenSourceReturned: forbidden,
    expectedTermCoverage: round(coverage),
    reciprocalRank: expectedRank < 0 ? 0 : round(1 / (expectedRank + 1)),
    topResults: results.slice(0, 5).map((item) => ({
      sourceKey: item.sourceKey,
      chunkId: item.chunkId,
      excerpt: item.content.replace(/\s+/gu, " ").trim().slice(0, 160),
    })),
  };
}
export function aggregateMetrics(results: RagCaseResult[]): RagMetrics {
  const evaluated = results.filter((item) => item.status !== "SKIPPED");
  const count = evaluated.length || 1;
  return {
    pass: results.filter((i) => i.status === "PASS").length,
    partial: results.filter((i) => i.status === "PARTIAL").length,
    fail: results.filter((i) => i.status === "FAIL").length,
    skipped: results.filter((i) => i.status === "SKIPPED").length,
    top1Accuracy: round(
      evaluated.filter((i) => i.expectedSourceAtTop1).length / count,
    ),
    top3Accuracy: round(
      evaluated.filter((i) => i.expectedSourceInTop3).length / count,
    ),
    meanReciprocalRank: round(
      evaluated.reduce((s, i) => s + i.reciprocalRank, 0) / count,
    ),
    expectedTermCoverage: round(
      evaluated.reduce((s, i) => s + i.expectedTermCoverage, 0) / count,
    ),
  };
}
const answerTypes: RagEvaluationAnswerType[] = [
  "DIRECT",
  "SYNTHESIS",
  "METADATA",
  "OUT_OF_SCOPE",
  "UNCERTAIN",
];

function metricsForAnswerTypes(results: RagCaseResult[]) {
  return Object.fromEntries(
    answerTypes.map((answerType) => {
      const selected = results.filter((item) => item.answerType === answerType);
      const metrics = aggregateMetrics(selected);
      return [
        answerType,
        {
          ...metrics,
          cases: selected.length,
          supported: selected.filter((item) => item.status !== "SKIPPED")
            .length,
          ...(answerType === "OUT_OF_SCOPE"
            ? {
                rejectionRate:
                  selected.length === 0
                    ? 0
                    : round(metrics.pass / selected.length),
              }
            : {}),
        },
      ];
    }),
  ) as RagEvaluationReport["metricsByAnswerType"];
}
export class RagEvaluationService {
  constructor(
    private readonly services: Partial<
      Record<RagEvaluationMode, EvaluationSearchService>
    >,
  ) {}
  async evaluate(
    cases: RagEvaluationCase[],
    mode: RagEvaluationMode,
    metadata: {
      date: string;
      sources: number;
      chunks: number;
      configuration: Record<string, unknown>;
    },
  ): Promise<RagEvaluationReport> {
    const service = this.services[mode];
    if (service === undefined) throw new Error("EVALUATION_MODE_UNAVAILABLE");
    const caseResults: RagCaseResult[] = [];
    let effectiveMode: string = mode;
    for (const test of cases) {
      if (
        test.answerType === "METADATA" &&
        (mode === "TEXT" || mode === "HYBRID")
      ) {
        caseResults.push({
          id: test.id,
          category: test.category,
          answerType: test.answerType,
          reviewStatus: test.reviewStatus,
          status: "SKIPPED",
          resultsFound: 0,
          expectedSourceAtTop1: false,
          expectedSourceInTop3: false,
          expectedSourceInTop5: false,
          forbiddenSourceReturned: false,
          expectedTermCoverage: 0,
          reciprocalRank: 0,
          topResults: [],
        });
        continue;
      }
      const response = await service.search(test.question);
      effectiveMode = response.effectiveMode;
      if (response.unavailable) {
        caseResults.push({
          id: test.id,
          category: test.category,
          answerType: test.answerType,
          reviewStatus: test.reviewStatus,
          status: "SKIPPED",
          resultsFound: 0,
          expectedSourceAtTop1: false,
          expectedSourceInTop3: false,
          expectedSourceInTop5: false,
          forbiddenSourceReturned: false,
          expectedTermCoverage: 0,
          reciprocalRank: 0,
          topResults: [],
        });
      } else caseResults.push(evaluateRetrievalCase(test, response.results));
    }
    return {
      date: metadata.date,
      policyVersion: "rag-evaluation-v2",
      datasetVersion: "knowledge-search-cases-v2",
      evaluationPolicyVersion: "rag-evaluation-v2",
      mode,
      effectiveMode,
      cases: cases.length,
      confirmedCases: cases.filter((i) => i.reviewStatus === "CONFIRMED")
        .length,
      pendingCases: cases.filter(
        (i) => i.reviewStatus === "PENDING_MANUAL_REVIEW",
      ).length,
      metrics: aggregateMetrics(caseResults),
      metricsByReviewStatus: {
        confirmed: aggregateMetrics(
          caseResults.filter((i) => i.reviewStatus === "CONFIRMED"),
        ),
        pending: aggregateMetrics(
          caseResults.filter((i) => i.reviewStatus === "PENDING_MANUAL_REVIEW"),
        ),
      },
      officialConfirmedMetrics: aggregateMetrics(
        caseResults.filter(
          (item) =>
            item.reviewStatus === "CONFIRMED" &&
            item.answerType !== "METADATA" &&
            item.answerType !== "UNCERTAIN",
        ),
      ),
      exploratoryPendingMetrics: aggregateMetrics(
        caseResults.filter(
          (item) =>
            item.reviewStatus === "PENDING_MANUAL_REVIEW" &&
            item.answerType !== "METADATA" &&
            item.answerType !== "UNCERTAIN",
        ),
      ),
      metricsByAnswerType: metricsForAnswerTypes(caseResults),
      countsByAnswerType: Object.fromEntries(
        answerTypes.map((answerType) => [
          answerType,
          cases.filter((item) => item.answerType === answerType).length,
        ]),
      ) as RagEvaluationReport["countsByAnswerType"],
      results: caseResults,
      sources: metadata.sources,
      chunks: metadata.chunks,
      configuration: metadata.configuration,
    };
  }
}
