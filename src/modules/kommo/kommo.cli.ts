export function parseKommoLeadId(args: string[]): number {
  if (args.length !== 1) throw new Error('INVALID_LEAD_ID');
  const id = Number(args[0]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('INVALID_LEAD_ID');
  return id;
}
