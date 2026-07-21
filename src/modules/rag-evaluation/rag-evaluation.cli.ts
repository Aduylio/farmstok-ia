import type {
  RagEvaluationCategory,
  RagEvaluationMode,
} from "./rag-evaluation.types.js";
import { ragEvaluationCategories } from "./rag-evaluation.schemas.js";
export interface RagEvaluationCliOptions {
  modes: RagEvaluationMode[];
  caseId?: string;
  category?: RagEvaluationCategory;
  limit?: number;
  json: boolean;
  execute: boolean;
  yes: boolean;
}
export function parseRagEvaluationCliArgs(
  args: string[],
): RagEvaluationCliOptions {
  const modes: RagEvaluationMode[] = [];
  const options: RagEvaluationCliOptions = {
    modes,
    json: false,
    execute: false,
    yes: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--execute") options.execute = true;
    else if (arg === "--yes") options.yes = true;
    else if (arg === "--mode") {
      const value = args[++i]?.toUpperCase() as RagEvaluationMode | undefined;
      if (
        value === undefined ||
        !["TEXT", "VECTOR", "HYBRID", "ANSWER"].includes(value)
      )
        throw new Error("INVALID_ARGUMENTS");
      modes.push(value);
    } else if (arg === "--case") {
      const value = args[++i];
      if (!value) throw new Error("INVALID_ARGUMENTS");
      options.caseId = value;
    } else if (arg === "--category") {
      const value = args[++i]?.toUpperCase() as
        RagEvaluationCategory | undefined;
      if (value === undefined || !ragEvaluationCategories.includes(value))
        throw new Error("INVALID_ARGUMENTS");
      options.category = value;
    } else if (arg === "--limit") {
      const value = Number(args[++i]);
      if (!Number.isInteger(value) || value < 1)
        throw new Error("INVALID_ARGUMENTS");
      options.limit = value;
    } else throw new Error("INVALID_ARGUMENTS");
  }
  if (modes.length === 0) modes.push("TEXT", "HYBRID");
  if (modes.includes("ANSWER") && !options.execute)
    throw new Error("ANSWER_REQUIRES_EXECUTE");
  if (options.execute && !options.yes) throw new Error("CONFIRMATION_REQUIRED");
  return options;
}
