import type {
  RagEvaluationReport,
  RagMetrics,
} from "./rag-evaluation.types.js";

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function metricSummary(label: string, metrics: RagMetrics) {
  return `${label}: ${metrics.pass} PASS, ${metrics.partial} PARTIAL, ${metrics.fail} FAIL, ${metrics.skipped} SKIPPED; Top-1 ${percent(metrics.top1Accuracy)}; Top-3 ${percent(metrics.top3Accuracy)}; MRR ${metrics.meanReciprocalRank.toFixed(3)}`;
}

function answerTypeSummary(report: RagEvaluationReport) {
  return Object.entries(report.metricsByAnswerType).map(([type, metrics]) => {
    const rejection =
      metrics.rejectionRate === undefined
        ? ""
        : `; rejeicao correta ${percent(metrics.rejectionRate)}`;
    return `${type}: ${metrics.cases} casos, ${metrics.supported} suportados, ${metrics.pass} PASS, ${metrics.partial} PARTIAL, ${metrics.fail} FAIL, ${metrics.skipped} SKIPPED; Top-1 ${percent(metrics.top1Accuracy)}; Top-3 ${percent(metrics.top3Accuracy)}; MRR ${metrics.meanReciprocalRank.toFixed(3)}${rejection}`;
  });
}

export function formatRagEvaluationReport(report: RagEvaluationReport): string {
  const metrics = report.metrics;
  const failures = report.results
    .filter((item) => item.status === "FAIL")
    .map((item) => item.id);
  return [
    "RAG Evaluation",
    `Modo: ${report.mode}`,
    `Modo efetivo: ${report.effectiveMode}`,
    `Casos: ${report.cases} (confirmados: ${report.confirmedCases}; pendentes: ${report.pendingCases})`,
    "",
    `PASS: ${metrics.pass}`,
    `PARTIAL: ${metrics.partial}`,
    `FAIL: ${metrics.fail}`,
    `SKIPPED: ${metrics.skipped}`,
    "",
    `Top-1 accuracy: ${percent(metrics.top1Accuracy)}`,
    `Top-3 accuracy: ${percent(metrics.top3Accuracy)}`,
    `Mean Reciprocal Rank: ${metrics.meanReciprocalRank.toFixed(3)}`,
    `Expected term coverage: ${percent(metrics.expectedTermCoverage)}`,
    "",
    metricSummary("Confirmados", report.metricsByReviewStatus.confirmed),
    metricSummary("Pendentes", report.metricsByReviewStatus.pending),
    metricSummary(
      "Official confirmed metrics",
      report.officialConfirmedMetrics,
    ),
    metricSummary(
      "Exploratory pending metrics",
      report.exploratoryPendingMetrics,
    ),
    "",
    ...answerTypeSummary(report),
    "",
    `Falhas: ${failures.length === 0 ? "nenhuma" : failures.join(", ")}`,
    "Metricas oficiais excluem METADATA sem suporte e UNCERTAIN. OUT_OF_SCOPE usa rejeicao conservadora; a decisao final dependera do orquestrador de resposta e da politica de evidencia.",
  ].join("\n");
}

export function serializeRagEvaluationReports(
  reports: RagEvaluationReport[],
): string {
  return `${JSON.stringify(reports, null, 2)}\n`;
}
