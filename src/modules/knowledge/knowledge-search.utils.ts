export interface TextSearchScoreInput {
  query: string;
  terms: string[];
  title: string;
  module: string | null;
  content: string;
}

export function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/\s+/gu, ' ');
}

export function tokenizeSearchQuery(query: string): string[] {
  return normalizeSearchText(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0);
}

function countOccurrences(text: string, term: string): number {
  let count = 0;
  let position = 0;

  while (position < text.length) {
    const matchPosition = text.indexOf(term, position);

    if (matchPosition === -1) break;

    count += 1;
    position = matchPosition + term.length;
  }

  return count;
}

export function calculateTextSearchScore(input: TextSearchScoreInput): number {
  const phrase = normalizeSearchText(input.query);
  const title = normalizeSearchText(input.title);
  const module = normalizeSearchText(input.module ?? '');
  const content = normalizeSearchText(input.content);
  const searchableText = `${title} ${module} ${content}`;
  const relevantTerms = input.terms.filter((term) =>
    searchableText.includes(term),
  );

  if (relevantTerms.length === 0) return 0;

  const occurrenceScore = input.terms.reduce(
    (score, term) =>
      score +
      countOccurrences(title, term) * 5 +
      countOccurrences(module, term) * 3 +
      countOccurrences(content, term),
    0,
  );
  const exactPhraseScore =
    (title.includes(phrase) ? 10 : 0) +
    (module.includes(phrase) ? 6 : 0) +
    (content.includes(phrase) ? 3 : 0);
  const allTermsScore = input.terms.every((term) => searchableText.includes(term))
    ? 4
    : 0;

  return occurrenceScore + exactPhraseScore + allTermsScore;
}

export function timestampToSeconds(timestamp: string): number | null {
  const match = /^(\d{2}):([0-5]\d):([0-5]\d)$/u.exec(timestamp);

  if (match === null) return null;

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function buildTimestampUrl(
  sourceUrl: string | null,
  startTime: string | null,
): string | null {
  if (sourceUrl === null || startTime === null) return null;

  const seconds = timestampToSeconds(startTime);
  if (seconds === null) return null;

  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.toLowerCase();
    const isYoutube =
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be';

    if (!isYoutube) return null;

    url.searchParams.set('t', `${seconds}s`);
    return url.toString();
  } catch {
    return null;
  }
}
