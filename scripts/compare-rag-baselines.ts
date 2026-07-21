import { readFile } from "node:fs/promises";
import { compareBaselines } from "../src/modules/rag-evaluation/rag-evaluation.compare.js";
import type { RagEvaluationReport } from "../src/modules/rag-evaluation/rag-evaluation.types.js";
try {
  const [oldPath, newPath] = process.argv.slice(2);
  if (!oldPath || !newPath) throw new Error("INVALID_ARGUMENTS");
  const parse = async (path: string) => {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    const report = Array.isArray(value) ? value[0] : value;
    if (typeof report !== "object" || report === null)
      throw new Error("INVALID_BASELINE");
    return report as RagEvaluationReport;
  };
  console.log(
    JSON.stringify(
      compareBaselines(await parse(oldPath), await parse(newPath)),
      null,
      2,
    ),
  );
} catch {
  console.error("Nao foi possivel comparar as baselines.");
  process.exitCode = 1;
}
