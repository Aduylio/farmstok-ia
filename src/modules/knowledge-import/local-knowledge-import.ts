import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import { extname, join, parse } from 'node:path';

import {
  createKnowledgeSourceBodySchema,
  knowledgeSourceMetadataSchema,
} from '../knowledge-ingestion/knowledge-ingestion.schemas.js';
import {
  DuplicateKnowledgeChunkError,
  DuplicateKnowledgeSourceError,
} from '../knowledge-ingestion/knowledge-ingestion.repository.js';
import type { KnowledgeIngestionService } from '../knowledge-ingestion/knowledge-ingestion.service.js';

const CONTENT_EXTENSIONS = new Set(['.md', '.txt']);

export interface KnowledgeImportDirectories {
  inbox: string;
  processed: string;
  failed: string;
}

export interface KnowledgeImportOptions {
  directories: KnowledgeImportDirectories;
  maxBytes: number;
  service: Pick<KnowledgeIngestionService, 'ingest'>;
  now?: () => Date;
}

export interface KnowledgeImportSummary {
  filesFound: number;
  imported: number;
  failures: number;
  chunksCreated: number;
}

interface SafeImportFailure {
  fileName: string;
  code: string;
  message: string;
  attemptedAt: string;
}

class KnowledgeImportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeImportError';
  }
}

function compareFileNames(first: string, second: string): number {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

export function isKnowledgeContentFile(fileName: string): boolean {
  return CONTENT_EXTENSIONS.has(extname(fileName).toLowerCase());
}

export function sortKnowledgeFiles(fileNames: string[]): string[] {
  return [...fileNames].sort(compareFileNames);
}

export async function findKnowledgeFiles(inbox: string): Promise<string[]> {
  const entries = await readdir(inbox, { withFileTypes: true });

  return sortKnowledgeFiles(
    entries
      .filter((entry) => entry.isFile() && isKnowledgeContentFile(entry.name))
      .map((entry) => entry.name),
  );
}

function normalizeNullableMetadata(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== null),
  );
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function safeTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/gu, '-');
}

async function resolveDestinationNames(
  directory: string,
  baseName: string,
  contentExtension: string,
  includeMetadata: boolean,
  includeError: boolean,
  now: Date,
): Promise<{ content: string; metadata?: string; error?: string }> {
  let attempt = 0;

  while (true) {
    const suffix =
      attempt === 0
        ? ''
        : `-${safeTimestamp(now)}${attempt === 1 ? '' : `-${attempt - 1}`}`;
    const candidateBase = `${baseName}${suffix}`;
    const names = {
      content: `${candidateBase}${contentExtension}`,
      ...(includeMetadata ? { metadata: `${candidateBase}.json` } : {}),
      ...(includeError ? { error: `${candidateBase}.error.json` } : {}),
    };
    const paths = Object.values(names).map((name) => join(directory, name));
    const collisions = await Promise.all(paths.map(fileExists));

    if (!collisions.some(Boolean)) {
      return names;
    }

    attempt += 1;
  }
}

async function moveSuccessfulFiles(
  directories: KnowledgeImportDirectories,
  contentFileName: string,
  metadataFileName: string,
  now: Date,
): Promise<void> {
  const contentExtension = extname(contentFileName);
  const baseName = parse(contentFileName).name;
  const destination = await resolveDestinationNames(
    directories.processed,
    baseName,
    contentExtension,
    true,
    false,
    now,
  );

  await rename(
    join(directories.inbox, contentFileName),
    join(directories.processed, destination.content),
  );
  await rename(
    join(directories.inbox, metadataFileName),
    join(directories.processed, destination.metadata ?? metadataFileName),
  );
}

async function moveFailedFiles(
  directories: KnowledgeImportDirectories,
  contentFileName: string,
  metadataFileName: string,
  metadataExists: boolean,
  failure: SafeImportFailure,
  now: Date,
): Promise<void> {
  const contentExtension = extname(contentFileName);
  const baseName = parse(contentFileName).name;
  const destination = await resolveDestinationNames(
    directories.failed,
    baseName,
    contentExtension,
    metadataExists,
    true,
    now,
  );

  if (await fileExists(join(directories.inbox, contentFileName))) {
    await rename(
      join(directories.inbox, contentFileName),
      join(directories.failed, destination.content),
    );
  }

  if (
    metadataExists &&
    (await fileExists(join(directories.inbox, metadataFileName)))
  ) {
    await rename(
      join(directories.inbox, metadataFileName),
      join(directories.failed, destination.metadata ?? metadataFileName),
    );
  }

  await writeFile(
    join(directories.failed, destination.error ?? `${baseName}.error.json`),
    `${JSON.stringify(failure, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
}

function toSafeFailure(
  fileName: string,
  error: unknown,
  attemptedAt: Date,
): SafeImportFailure {
  if (error instanceof KnowledgeImportError) {
    return {
      fileName,
      code: error.code,
      message: error.message,
      attemptedAt: attemptedAt.toISOString(),
    };
  }

  if (error instanceof DuplicateKnowledgeChunkError) {
    return {
      fileName,
      code: 'DUPLICATE_CONTENT',
      message: 'A fonte contém chunks duplicados.',
      attemptedAt: attemptedAt.toISOString(),
    };
  }

  if (error instanceof DuplicateKnowledgeSourceError) {
    return {
      fileName,
      code: 'DUPLICATE_SOURCE',
      message: 'Já existe uma fonte com esta sourceKey.',
      attemptedAt: attemptedAt.toISOString(),
    };
  }

  return {
    fileName,
    code: 'IMPORT_FAILED',
    message: 'Não foi possível importar o arquivo.',
    attemptedAt: attemptedAt.toISOString(),
  };
}

async function importSingleFile(
  options: KnowledgeImportOptions,
  contentFileName: string,
): Promise<number> {
  const { directories, maxBytes, service } = options;
  const contentPath = join(directories.inbox, contentFileName);
  const baseName = parse(contentFileName).name;
  const metadataFileName = `${baseName}.json`;
  const metadataPath = join(directories.inbox, metadataFileName);
  const contentStats = await stat(contentPath);

  if (contentStats.size > maxBytes) {
    throw new KnowledgeImportError(
      'FILE_TOO_LARGE',
      `O arquivo excede o limite de ${maxBytes} bytes.`,
    );
  }

  if (!(await fileExists(metadataPath))) {
    throw new KnowledgeImportError(
      'MISSING_METADATA',
      'O arquivo de metadados correspondente não foi encontrado.',
    );
  }

  let rawMetadata: unknown;

  try {
    rawMetadata = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown;
  } catch {
    throw new KnowledgeImportError(
      'INVALID_JSON',
      'O arquivo de metadados não contém JSON válido.',
    );
  }

  const parsedMetadata = knowledgeSourceMetadataSchema.safeParse(
    normalizeNullableMetadata(rawMetadata),
  );

  if (!parsedMetadata.success) {
    throw new KnowledgeImportError(
      'INVALID_METADATA',
      'Os metadados da fonte são inválidos.',
    );
  }

  const content = await readFile(contentPath, 'utf8');
  const parsedInput = createKnowledgeSourceBodySchema.safeParse({
    ...parsedMetadata.data,
    content,
  });

  if (!parsedInput.success) {
    throw new KnowledgeImportError(
      content.trim().length === 0 ? 'EMPTY_CONTENT' : 'INVALID_CONTENT',
      content.trim().length === 0
        ? 'O arquivo de conteúdo está vazio.'
        : 'O conteúdo do arquivo é inválido.',
    );
  }

  const result = await service.ingest(parsedInput.data);
  return result.ingestion.chunksCreated;
}

export async function runKnowledgeImport(
  options: KnowledgeImportOptions,
): Promise<KnowledgeImportSummary> {
  const now = options.now ?? (() => new Date());

  await Promise.all(
    Object.values(options.directories).map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );

  const contentFiles = await findKnowledgeFiles(options.directories.inbox);
  const summary: KnowledgeImportSummary = {
    filesFound: contentFiles.length,
    imported: 0,
    failures: 0,
    chunksCreated: 0,
  };

  for (const contentFileName of contentFiles) {
    const attemptDate = now();
    const baseName = parse(contentFileName).name;
    const metadataFileName = `${baseName}.json`;
    const metadataPath = join(options.directories.inbox, metadataFileName);

    try {
      const chunksCreated = await importSingleFile(options, contentFileName);

      await moveSuccessfulFiles(
        options.directories,
        contentFileName,
        metadataFileName,
        attemptDate,
      );

      summary.imported += 1;
      summary.chunksCreated += chunksCreated;
    } catch (error) {
      const failure = toSafeFailure(contentFileName, error, attemptDate);
      const metadataExists = await fileExists(metadataPath);

      try {
        await moveFailedFiles(
          options.directories,
          contentFileName,
          metadataFileName,
          metadataExists,
          failure,
          attemptDate,
        );
      } catch {
        // A falha de movimentação não deve interromper os próximos arquivos.
      }

      summary.failures += 1;
    }
  }

  return summary;
}

export function formatKnowledgeImportSummary(
  summary: KnowledgeImportSummary,
): string {
  const emptyMessage =
    summary.filesFound === 0
      ? 'Nenhum arquivo de conhecimento encontrado.\n'
      : '';

  return `${emptyMessage}Importação concluída.\nArquivos encontrados: ${summary.filesFound}\nImportados: ${summary.imported}\nFalhas: ${summary.failures}\nChunks criados: ${summary.chunksCreated}`;
}
