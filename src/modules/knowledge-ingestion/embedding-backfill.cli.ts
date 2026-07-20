export interface EmbeddingCliOptions {
  execute: boolean;
  yes: boolean;
  force: boolean;
  limit?: number;
  batchSize?: number;
  sourceKey?: string;
}

function positiveInteger(value: string | undefined, option: string, max?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || (max !== undefined && parsed > max)) {
    throw new Error(`Valor invÃ¡lido para ${option}.`);
  }
  return parsed;
}

export function parseEmbeddingCliArgs(args: string[]): EmbeddingCliOptions {
  const options: EmbeddingCliOptions = { execute: false, yes: false, force: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--execute') options.execute = true;
    else if (argument === '--yes') options.yes = true;
    else if (argument === '--force') options.force = true;
    else if (argument === '--limit') options.limit = positiveInteger(args[++index], argument);
    else if (argument === '--batch-size') options.batchSize = positiveInteger(args[++index], argument, 100);
    else if (argument === '--source-key') {
      const value = args[++index];
      if (value === undefined || value.trim() === '') throw new Error('Valor invÃ¡lido para --source-key.');
      options.sourceKey = value;
    } else throw new Error(`OpÃ§Ã£o desconhecida: ${argument}`);
  }
  if (options.yes && !options.execute) throw new Error('--yes exige --execute.');
  return options;
}
