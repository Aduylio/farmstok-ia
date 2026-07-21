export function parseVectorSearchCliArgs(args: string[]): unknown {
  const [q, ...options] = args;
  const parsed: Record<string, string | undefined> = { q };
  const flags: Record<string, string> = {
    '--limit': 'limit', '--source-key': 'sourceKey', '--course': 'course',
    '--type': 'type', '--min-similarity': 'minSimilarity',
  };
  for (let index = 0; index < options.length; index += 2) {
    const flag = options[index];
    const value = options[index + 1];
    if (flag === undefined || value === undefined || flags[flag] === undefined) return null;
    parsed[flags[flag]] = value;
  }
  return parsed;
}
