import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { compareBaselines } from "../src/modules/rag-evaluation/rag-evaluation.compare.js";
import { parseRagEvaluationCliArgs } from "../src/modules/rag-evaluation/rag-evaluation.cli.js";
import { loadRagEvaluationCases } from "../src/modules/rag-evaluation/rag-evaluation.loader.js";
import {
  formatRagEvaluationReport,
  serializeRagEvaluationReports,
} from "../src/modules/rag-evaluation/rag-evaluation.reporter.js";
import { ragEvaluationCaseSchema } from "../src/modules/rag-evaluation/rag-evaluation.schemas.js";
import {
  aggregateMetrics,
  evaluateRetrievalCase,
  RagEvaluationService,
} from "../src/modules/rag-evaluation/rag-evaluation.service.js";
import type {
  EvaluationSearchResult,
  RagEvaluationCase,
  RagEvaluationReport,
} from "../src/modules/rag-evaluation/rag-evaluation.types.js";

const expected = "live:webinar-trier-compras-inteligentes";
const base: RagEvaluationCase = {
  id: "caso-1",
  category: "TRIER",
  answerType: "DIRECT",
  question: "Estoque minimo?",
  expectedSourceKeys: [expected],
  forbiddenSourceKeys: [],
  expectedTerms: ["estoque", "mínimo"],
  optionalTerms: [],
  shouldFindResults: true,
  shouldNeedHuman: false,
  notes: "teste",
  reviewStatus: "CONFIRMED",
};
const item = (
  sourceKey = expected,
  content = "Estoque mínimo e segurança",
): EvaluationSearchResult => ({
  chunkId: "c1",
  content,
  sourceKey,
  title: "Webinar",
  module: "Estoque",
});

describe("schema e loader", () => {
  it("exige answerType e aceita apenas os cinco valores controlados", () => {
    for (const answerType of [
      "DIRECT",
      "SYNTHESIS",
      "METADATA",
      "OUT_OF_SCOPE",
      "UNCERTAIN",
    ])
      expect(
        ragEvaluationCaseSchema.safeParse({ ...base, answerType }).success,
      ).toBe(true);
    const { answerType: _, ...withoutAnswerType } = base;
    expect(ragEvaluationCaseSchema.safeParse(withoutAnswerType).success).toBe(
      false,
    );
    expect(
      ragEvaluationCaseSchema.safeParse({
        ...base,
        answerType: "INVALID",
      }).success,
    ).toBe(false);
  });
  it("aceita caso valido e rejeita question vazia/sourceKey invalida/conflito", () => {
    expect(ragEvaluationCaseSchema.safeParse(base).success).toBe(true);
    expect(
      ragEvaluationCaseSchema.safeParse({ ...base, question: "" }).success,
    ).toBe(false);
    expect(
      ragEvaluationCaseSchema.safeParse({
        ...base,
        expectedSourceKeys: ["INVALIDA"],
      }).success,
    ).toBe(false);
    expect(
      ragEvaluationCaseSchema.safeParse({
        ...base,
        forbiddenSourceKeys: [expected],
      }).success,
    ).toBe(false);
  });
  it("carrega UTF-8 e detecta IDs duplicadas", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rag-eval-"));
    const valid = join(dir, "valid.json");
    await writeFile(valid, JSON.stringify([base]));
    await expect(loadRagEvaluationCases(valid)).resolves.toHaveLength(1);
    const duplicate = join(dir, "duplicate.json");
    await writeFile(duplicate, JSON.stringify([base, base]));
    await expect(loadRagEvaluationCases(duplicate)).rejects.toThrow(
      "duplicada",
    );
  });
  it("valida o dataset v2 real, IDs únicos, perguntas e sourceKeys", async () => {
    const cases = await loadRagEvaluationCases(
      "SPECS/evaluations/knowledge-search-cases.json",
    );
    expect(cases).toHaveLength(25);
    expect(new Set(cases.map((item) => item.id))).toHaveProperty("size", 25);
    expect(cases.every((item) => item.question.trim().length > 0)).toBe(true);
    expect(cases.every((item) => item.answerType !== undefined)).toBe(true);
  });
});
describe("metricas por caso", () => {
  it("PASS no top1, normaliza acentos e calcula reciprocal rank", () => {
    const result = evaluateRetrievalCase(base, [
      item(expected, "ESTOQUE MINIMO"),
    ]);
    expect(result).toMatchObject({
      status: "PASS",
      expectedSourceAtTop1: true,
      expectedTermCoverage: 1,
      reciprocalRank: 1,
    });
  });
  it("PASS no top3", () => {
    const result = evaluateRetrievalCase(base, [
      item("live:historia-farmstok"),
      item(expected),
    ]);
    expect(result.status).toBe("PASS");
    expect(result.expectedSourceInTop3).toBe(true);
    expect(result.reciprocalRank).toBe(0.5);
  });
  it("PARTIAL fora do top3 ou cobertura parcial", () => {
    const result = evaluateRetrievalCase(base, [
      item("live:historia-farmstok"),
      item("live:historia-farmstok"),
      item("live:historia-farmstok"),
      item(expected, "estoque"),
    ]);
    expect(result.status).toBe("PARTIAL");
    expect(result.expectedSourceInTop5).toBe(true);
  });
  it("FAIL fora do top5, fonte proibida ou vazio inesperado", () => {
    expect(
      evaluateRetrievalCase(
        base,
        Array.from({ length: 5 }, () => item("live:historia-farmstok")),
      ).status,
    ).toBe("FAIL");
    expect(
      evaluateRetrievalCase(
        { ...base, forbiddenSourceKeys: ["live:historia-farmstok"] },
        [item(expected), item("live:historia-farmstok")],
      ).status,
    ).toBe("FAIL");
    expect(evaluateRetrievalCase(base, []).status).toBe("FAIL");
  });
  it("resultado vazio esperado passa e inadequado falha", () => {
    const noResult = {
      ...base,
      expectedSourceKeys: [],
      forbiddenSourceKeys: [expected],
      expectedTerms: ["xyz"],
      shouldFindResults: false,
      shouldNeedHuman: true,
    };
    expect(evaluateRetrievalCase(noResult, []).status).toBe("PASS");
    expect(evaluateRetrievalCase(noResult, [item()]).status).toBe("FAIL");
  });
  it("agrega relatorio", () => {
    const metrics = aggregateMetrics([
      evaluateRetrievalCase(base, [item()]),
      evaluateRetrievalCase(base, []),
    ]);
    expect(metrics).toMatchObject({
      pass: 1,
      fail: 1,
      top1Accuracy: 0.5,
      meanReciprocalRank: 0.5,
    });
  });
  it("agrega cobertura de SYNTHESIS nos primeiros resultados", () => {
    const synthesis = {
      ...base,
      answerType: "SYNTHESIS" as const,
      expectedTerms: ["segurança", "cobertura"],
    };
    const result = evaluateRetrievalCase(synthesis, [
      item(expected, "estoque de segurança"),
      item(expected, "cobertura de estoque"),
    ]);
    expect(result.expectedTermCoverage).toBe(1);
    expect(result.status).toBe("PASS");
  });
});
describe("service, filtros e modos", () => {
  it("usa service injetado e VECTOR indisponivel vira SKIPPED", async () => {
    const service = {
      search: vi.fn().mockResolvedValue({
        results: [],
        effectiveMode: "VECTOR",
        unavailable: true,
      }),
    };
    const report = await new RagEvaluationService({ VECTOR: service }).evaluate(
      [base],
      "VECTOR",
      { date: "2026-07-21", sources: 2, chunks: 148, configuration: {} },
    );
    expect(service.search).toHaveBeenCalledWith(base.question);
    expect(report.metrics.skipped).toBe(1);
    expect(report.results[0]?.status).toBe("SKIPPED");
  });
  it("ignora METADATA no TEXT sem consultar busca nem penalizar oficiais", async () => {
    const search = vi.fn();
    const report = await new RagEvaluationService({
      TEXT: { search },
    }).evaluate([{ ...base, answerType: "METADATA" }], "TEXT", {
      date: "2026-07-21",
      sources: 2,
      chunks: 148,
      configuration: {},
    });
    expect(search).not.toHaveBeenCalled();
    expect(report.results[0]?.status).toBe("SKIPPED");
    expect(report.officialConfirmedMetrics.fail).toBe(0);
    expect(report.metricsByAnswerType.METADATA).toMatchObject({
      cases: 1,
      supported: 0,
      skipped: 1,
    });
  });
  it("separa confirmed, pending e UNCERTAIN das metricas oficiais", async () => {
    const search = vi.fn().mockResolvedValue({
      results: [item()],
      effectiveMode: "TEXT",
    });
    const report = await new RagEvaluationService({
      TEXT: { search },
    }).evaluate(
      [
        base,
        {
          ...base,
          id: "pendente",
          reviewStatus: "PENDING_MANUAL_REVIEW",
          answerType: "SYNTHESIS",
        },
        {
          ...base,
          id: "incerto",
          reviewStatus: "PENDING_MANUAL_REVIEW",
          answerType: "UNCERTAIN",
        },
      ],
      "TEXT",
      { date: "2026-07-21", sources: 2, chunks: 148, configuration: {} },
    );
    expect(report.officialConfirmedMetrics.pass).toBe(1);
    expect(report.exploratoryPendingMetrics.pass).toBe(1);
    expect(report.metricsByAnswerType.UNCERTAIN.cases).toBe(1);
  });
  it("calcula rejeicao correta para OUT_OF_SCOPE", async () => {
    const search = vi.fn().mockResolvedValue({
      results: [],
      effectiveMode: "TEXT",
    });
    const report = await new RagEvaluationService({
      TEXT: { search },
    }).evaluate(
      [
        {
          ...base,
          answerType: "OUT_OF_SCOPE",
          expectedSourceKeys: [],
          shouldFindResults: false,
        },
      ],
      "TEXT",
      { date: "2026-07-21", sources: 2, chunks: 148, configuration: {} },
    );
    expect(report.metricsByAnswerType.OUT_OF_SCOPE.rejectionRate).toBe(1);
  });
  it("parser aplica case/category/limit e defaults", () => {
    expect(parseRagEvaluationCliArgs([]).modes).toEqual(["TEXT", "HYBRID"]);
    expect(
      parseRagEvaluationCliArgs([
        "--mode",
        "text",
        "--case",
        "caso-1",
        "--category",
        "trier",
        "--limit",
        "1",
        "--json",
      ]),
    ).toMatchObject({
      modes: ["TEXT"],
      caseId: "caso-1",
      category: "TRIER",
      limit: 1,
      json: true,
    });
    expect(() => parseRagEvaluationCliArgs(["--mode", "answer"])).toThrow(
      "ANSWER_REQUIRES_EXECUTE",
    );
    expect(() => parseRagEvaluationCliArgs(["--unknown"])).toThrow();
  });
});
describe("reporter e baseline", () => {
  const makeReport = (
    status: "PASS" | "PARTIAL" | "FAIL",
  ): RagEvaluationReport => {
    const result = {
      ...evaluateRetrievalCase(
        base,
        status === "PASS"
          ? [item()]
          : status === "PARTIAL"
            ? [item(expected, "estoque")]
            : [],
      ),
      status,
    };
    return {
      date: "2026-07-21",
      policyVersion: "rag-evaluation-v2",
      datasetVersion: "knowledge-search-cases-v2",
      evaluationPolicyVersion: "rag-evaluation-v2",
      mode: "TEXT",
      effectiveMode: "TEXT",
      cases: 1,
      confirmedCases: 1,
      pendingCases: 0,
      metrics: aggregateMetrics([result]),
      metricsByReviewStatus: {
        confirmed: aggregateMetrics([result]),
        pending: aggregateMetrics([]),
      },
      officialConfirmedMetrics: aggregateMetrics([result]),
      exploratoryPendingMetrics: aggregateMetrics([]),
      metricsByAnswerType: {
        DIRECT: { ...aggregateMetrics([result]), cases: 1, supported: 1 },
        SYNTHESIS: { ...aggregateMetrics([]), cases: 0, supported: 0 },
        METADATA: { ...aggregateMetrics([]), cases: 0, supported: 0 },
        OUT_OF_SCOPE: {
          ...aggregateMetrics([]),
          cases: 0,
          supported: 0,
          rejectionRate: 0,
        },
        UNCERTAIN: { ...aggregateMetrics([]), cases: 0, supported: 0 },
      },
      countsByAnswerType: {
        DIRECT: 1,
        SYNTHESIS: 0,
        METADATA: 0,
        OUT_OF_SCOPE: 0,
        UNCERTAIN: 0,
      },
      results: [result],
      sources: 2,
      chunks: 148,
      configuration: {},
    };
  };
  it("JSON e texto sao deterministicos", () => {
    const report = makeReport("PASS");
    expect(serializeRagEvaluationReports([report])).toBe(
      serializeRagEvaluationReports([report]),
    );
    expect(formatRagEvaluationReport(report)).toContain("PASS: 1");
  });
  it("compara melhoras, pioras e estaveis", () => {
    expect(
      compareBaselines(makeReport("FAIL"), makeReport("PASS")).improved,
    ).toEqual(["caso-1"]);
    expect(
      compareBaselines(makeReport("PASS"), makeReport("FAIL")).worsened,
    ).toEqual(["caso-1"]);
    expect(
      compareBaselines(makeReport("PASS"), makeReport("PASS")).unchanged,
    ).toEqual(["caso-1"]);
  });
  it("preserva baseline v1 e valida baseline versionada v2", async () => {
    const [v1, v2] = await Promise.all([
      readFile("SPECS/evaluations/baselines/text-baseline.json", "utf8"),
      readFile("SPECS/evaluations/baselines/text-baseline-v2.json", "utf8"),
    ]).then((values) => values.map((value) => JSON.parse(value)));
    expect(v1.policyVersion).toBe("rag-evaluation-v1");
    expect(v2).toMatchObject({
      datasetVersion: "knowledge-search-cases-v2",
      evaluationPolicyVersion: "rag-evaluation-v2",
      cases: 25,
      confirmedCases: 20,
      pendingCases: 5,
    });
    expect(v2.results).toHaveLength(25);
    expect(compareBaselines(v1, v2).unchanged.length).toBeGreaterThan(0);
  });
});
