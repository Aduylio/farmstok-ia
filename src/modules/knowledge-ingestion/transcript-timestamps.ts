import {
  chunkText,
  TARGET_CHUNK_CHARACTERS,
} from './knowledge-ingestion.utils.js';

export interface TranscriptSegment {
  startTime: string | null;
  endTime: string | null;
  content: string;
}

export function normalizeTranscriptTimestamp(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/u.exec(value.trim());

  if (match === null) {
    return null;
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] === undefined ? undefined : Number(match[3]);
  const hours = third === undefined ? 0 : first;
  const minutes = third === undefined ? first : second;
  const seconds = third === undefined ? second : third;

  if (minutes > 59 || seconds > 59) {
    return null;
  }

  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, '0'))
    .join(':');
}

export function parseTranscriptSegments(content: string): TranscriptSegment[] {
  const lines = content.replace(/\r\n?/gu, '\n').split('\n');
  const segments: TranscriptSegment[] = [];
  let currentStartTime: string | null = null;
  let currentLines: string[] = [];

  const appendSegment = (endTime: string | null) => {
    const segmentContent = currentLines.join('\n').trim();

    if (segmentContent.length > 0) {
      segments.push({
        startTime: currentStartTime,
        endTime,
        content: segmentContent,
      });
    }

    currentLines = [];
  };

  for (const line of lines) {
    const timestamp = normalizeTranscriptTimestamp(line);

    if (timestamp !== null) {
      appendSegment(timestamp);
      currentStartTime = timestamp;
      continue;
    }

    currentLines.push(line);
  }

  appendSegment(null);
  return segments;
}

function combineTemporalSegments(
  segments: TranscriptSegment[],
): TranscriptSegment[] {
  const expanded = segments.flatMap((segment) =>
    chunkText(segment.content).map((content) => ({
      startTime: segment.startTime,
      endTime: segment.endTime,
      content,
    })),
  );
  const chunks: TranscriptSegment[] = [];

  for (const segment of expanded) {
    const previous = chunks.at(-1);

    if (previous === undefined) {
      chunks.push({ ...segment });
      continue;
    }

    const combinedContent = `${previous.content}\n\n${segment.content}`;
    const sameTemporalKind =
      (previous.startTime === null) === (segment.startTime === null);

    if (
      sameTemporalKind &&
      combinedContent.length <= TARGET_CHUNK_CHARACTERS
    ) {
      previous.content = combinedContent;
      previous.endTime = segment.endTime;
      continue;
    }

    chunks.push({ ...segment });
  }

  return chunks;
}

export function chunkTranscript(content: string): TranscriptSegment[] {
  const hasTimestampMarker = content
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .some((line) => normalizeTranscriptTimestamp(line) !== null);

  if (!hasTimestampMarker) {
    return chunkText(content).map((chunkContent) => ({
      startTime: null,
      endTime: null,
      content: chunkContent,
    }));
  }

  return combineTemporalSegments(parseTranscriptSegments(content));
}
