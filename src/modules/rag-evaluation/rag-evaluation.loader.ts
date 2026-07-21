import { readFile } from "node:fs/promises";
import { ragEvaluationCasesSchema } from "./rag-evaluation.schemas.js";
import type { RagEvaluationCase } from "./rag-evaluation.types.js";
export class RagEvaluationLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RagEvaluationLoadError";
  }
}
export async function loadRagEvaluationCases(
  path: string,
): Promise<RagEvaluationCase[]> {
  try {
    const raw: unknown = JSON.parse(await readFile(path, "utf8"));
    const parsed = ragEvaluationCasesSchema.safeParse(raw);
    if (!parsed.success)
      throw new RagEvaluationLoadError("Os casos de avaliacao sao invalidos.");
    const ids = new Set<string>();
    for (const item of parsed.data) {
      if (ids.has(item.id))
        throw new RagEvaluationLoadError(`ID de caso duplicada: ${item.id}`);
      ids.add(item.id);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof RagEvaluationLoadError) throw error;
    throw new RagEvaluationLoadError(
      "Nao foi possivel carregar os casos de avaliacao.",
    );
  }
}
