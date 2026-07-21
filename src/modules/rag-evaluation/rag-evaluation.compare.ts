import type { RagEvaluationReport } from "./rag-evaluation.types.js";
export interface BaselineComparison {
  metrics: {
    pass: number;
    partial: number;
    fail: number;
    top1Accuracy: number;
    top3Accuracy: number;
    meanReciprocalRank: number;
    expectedTermCoverage: number;
  };
  improved: string[];
  worsened: string[];
  unchanged: string[];
}
const weight = { SKIPPED: 0, FAIL: 1, PARTIAL: 2, PASS: 3 } as const;
const delta = (current: number, previous: number) =>
  Number((current - previous).toFixed(6));
export function compareBaselines(
  oldReport: RagEvaluationReport,
  newReport: RagEvaluationReport,
): BaselineComparison {
  const oldMap = new Map(oldReport.results.map((i) => [i.id, i.status]));
  const improved: string[] = [];
  const worsened: string[] = [];
  const unchanged: string[] = [];
  for (const item of newReport.results) {
    const previous = oldMap.get(item.id);
    if (previous === undefined || previous === item.status)
      unchanged.push(item.id);
    else if (weight[item.status] > weight[previous]) improved.push(item.id);
    else worsened.push(item.id);
  }
  return {
    metrics: {
      pass: delta(newReport.metrics.pass, oldReport.metrics.pass),
      partial: delta(newReport.metrics.partial, oldReport.metrics.partial),
      fail: delta(newReport.metrics.fail, oldReport.metrics.fail),
      top1Accuracy: delta(
        newReport.metrics.top1Accuracy,
        oldReport.metrics.top1Accuracy,
      ),
      top3Accuracy: delta(
        newReport.metrics.top3Accuracy,
        oldReport.metrics.top3Accuracy,
      ),
      meanReciprocalRank: delta(
        newReport.metrics.meanReciprocalRank,
        oldReport.metrics.meanReciprocalRank,
      ),
      expectedTermCoverage: delta(
        newReport.metrics.expectedTermCoverage,
        oldReport.metrics.expectedTermCoverage,
      ),
    },
    improved,
    worsened,
    unchanged,
  };
}
