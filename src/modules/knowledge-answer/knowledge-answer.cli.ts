export interface AskCliOptions { execute: boolean; yes: boolean; question: string }
export function parseAskCliArgs(args: string[]): AskCliOptions {
  let execute = false; let yes = false; const words: string[] = [];
  for (const arg of args) { if (arg === '--execute') execute = true; else if (arg === '--yes') yes = true; else if (arg.startsWith('--')) throw new Error('INVALID_ARGUMENTS'); else words.push(arg); }
  const question = words.join(' ').trim(); if (question.length < 3 || (yes && !execute)) throw new Error('INVALID_ARGUMENTS');
  return { execute, yes, question };
}
