import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  CreateKnowledgeSourceBody,
  KnowledgeIngestionResponse,
} from '../src/modules/knowledge-ingestion/knowledge-ingestion.schemas.js';
import {
  findKnowledgeFiles,
  formatKnowledgeImportSummary,
  runKnowledgeImport,
  type KnowledgeImportDirectories,
} from '../src/modules/knowledge-import/local-knowledge-import.js';
import { DuplicateKnowledgeSourceError } from '../src/modules/knowledge-ingestion/knowledge-ingestion.repository.js';

class FakeIngestionService {
  readonly inputs: CreateKnowledgeSourceBody[] = [];

  constructor(private readonly failingTitles = new Set<string>()) {}

  async ingest(
    input: CreateKnowledgeSourceBody,
  ): Promise<KnowledgeIngestionResponse> {
    this.inputs.push(input);

    if (this.failingTitles.has(input.title)) {
      throw new Error('falha simulada');
    }

    return {
      source: {
        id: '3e1e04ad-32e5-4eed-b131-e72f16f063b7',
        sourceKey: input.sourceKey,
        type: input.type,
        title: input.title,
        course: input.course,
      },
      ingestion: {
        chunksCreated: 2,
        charactersProcessed: input.content.length,
      },
    };
  }
}

class DuplicateSourceService extends FakeIngestionService {
  override async ingest(): Promise<never> {
    throw new DuplicateKnowledgeSourceError();
  }
}

const fixedDate = new Date('2026-07-20T12:00:00.000Z');
const validMetadata = {
  sourceKey: 'aula:curva-abc',
  type: 'AULA',
  title: 'Curva ABC',
  course: 'Farmstok',
  module: 'Gestão de Estoques',
  lessonNumber: 1,
  sourceUrl: null,
  instructor: 'Nome do instrutor',
};

describe('importacao local de conhecimento', () => {
  let root: string;
  let directories: KnowledgeImportDirectories;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'farmstok-knowledge-import-'));
    directories = {
      inbox: join(root, 'inbox'),
      processed: join(root, 'processed'),
      failed: join(root, 'failed'),
    };

    await Promise.all(
      Object.values(directories).map((directory) =>
        mkdir(directory, { recursive: true }),
      ),
    );
  });

  afterEach(async () => {
    if (root.startsWith(tmpdir())) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function writePair(
    baseName: string,
    extension: '.md' | '.txt',
    content = 'Texto completo da aula.',
    metadata: unknown = validMetadata,
  ) {
    await writeFile(join(directories.inbox, `${baseName}${extension}`), content);
    await writeFile(
      join(directories.inbox, `${baseName}.json`),
      JSON.stringify(metadata),
    );
  }

  it('encontra TXT e Markdown, ignora extensoes diferentes e ordena', async () => {
    await Promise.all([
      writeFile(join(directories.inbox, 'zeta.md'), 'z'),
      writeFile(join(directories.inbox, 'alpha.txt'), 'a'),
      writeFile(join(directories.inbox, 'meio.MD'), 'm'),
      writeFile(join(directories.inbox, 'ignorado.pdf'), 'pdf'),
      writeFile(join(directories.inbox, 'alpha.json'), '{}'),
    ]);

    await expect(findKnowledgeFiles(directories.inbox)).resolves.toEqual([
      'alpha.txt',
      'meio.MD',
      'zeta.md',
    ]);
  });

  it('move arquivo sem metadados para failed e cria erro seguro', async () => {
    await writeFile(join(directories.inbox, 'sem-json.txt'), 'Conteúdo');
    const service = new FakeIngestionService();

    const summary = await runKnowledgeImport({
      directories,
      maxBytes: 1024,
      service,
      now: () => fixedDate,
    });

    expect(summary).toEqual({
      filesFound: 1,
      imported: 0,
      failures: 1,
      chunksCreated: 0,
    });
    expect(await readdir(directories.failed)).toEqual([
      'sem-json.error.json',
      'sem-json.txt',
    ]);
    const error = JSON.parse(
      await readFile(join(directories.failed, 'sem-json.error.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(error).toEqual({
      fileName: 'sem-json.txt',
      code: 'MISSING_METADATA',
      message: 'O arquivo de metadados correspondente não foi encontrado.',
      attemptedAt: fixedDate.toISOString(),
    });
  });

  it('trata JSON invalido e move o par para failed', async () => {
    await writeFile(join(directories.inbox, 'invalido.md'), 'Conteúdo');
    await writeFile(join(directories.inbox, 'invalido.json'), '{ inválido');

    const summary = await runKnowledgeImport({
      directories,
      maxBytes: 1024,
      service: new FakeIngestionService(),
      now: () => fixedDate,
    });

    expect(summary.failures).toBe(1);
    expect(await readdir(directories.failed)).toEqual([
      'invalido.error.json',
      'invalido.json',
      'invalido.md',
    ]);
    expect(
      await readFile(join(directories.failed, 'invalido.error.json'), 'utf8'),
    ).toContain('INVALID_JSON');
  });

  it('rejeita metadados JSON que nao seguem o schema compartilhado', async () => {
    await writePair('metadados-invalidos', '.txt', 'Conteúdo', {
      type: 'DESCONHECIDO',
      title: '',
    });

    const summary = await runKnowledgeImport({
      directories,
      maxBytes: 1024,
      service: new FakeIngestionService(),
      now: () => fixedDate,
    });

    expect(summary.failures).toBe(1);
    expect(
      await readFile(
        join(directories.failed, 'metadados-invalidos.error.json'),
        'utf8',
      ),
    ).toContain('INVALID_METADATA');
  });

  it('rejeita conteudo vazio', async () => {
    await writePair('vazio', '.txt', '   \n');

    const summary = await runKnowledgeImport({
      directories,
      maxBytes: 1024,
      service: new FakeIngestionService(),
      now: () => fixedDate,
    });

    expect(summary.failures).toBe(1);
    expect(
      await readFile(join(directories.failed, 'vazio.error.json'), 'utf8'),
    ).toContain('EMPTY_CONTENT');
  });

  it('rejeita arquivo acima do limite antes de chamar o service', async () => {
    await writePair('grande', '.txt', '123456');
    const service = new FakeIngestionService();

    const summary = await runKnowledgeImport({
      directories,
      maxBytes: 5,
      service,
      now: () => fixedDate,
    });

    expect(summary.failures).toBe(1);
    expect(service.inputs).toHaveLength(0);
    expect(
      await readFile(join(directories.failed, 'grande.error.json'), 'utf8'),
    ).toContain('FILE_TOO_LARGE');
  });

  it('reutiliza o service e move o par somente apos sucesso', async () => {
    await writePair('curva-abc', '.txt');
    const service = new FakeIngestionService();

    const summary = await runKnowledgeImport({
      directories,
      maxBytes: 1024,
      service,
      now: () => fixedDate,
    });

    expect(service.inputs).toHaveLength(1);
    expect(service.inputs[0]).toMatchObject({
      type: 'AULA',
      title: 'Curva ABC',
      content: 'Texto completo da aula.',
    });
    expect(summary).toEqual({
      filesFound: 1,
      imported: 1,
      failures: 0,
      chunksCreated: 2,
    });
    expect(await readdir(directories.inbox)).toEqual([]);
    expect(await readdir(directories.processed)).toEqual([
      'curva-abc.json',
      'curva-abc.txt',
    ]);
  });

  it('adiciona timestamp seguro quando existe colisao em processed', async () => {
    await writePair('curva-abc', '.txt');
    await writeFile(join(directories.processed, 'curva-abc.txt'), 'anterior');

    await runKnowledgeImport({
      directories,
      maxBytes: 1024,
      service: new FakeIngestionService(),
      now: () => fixedDate,
    });

    expect(await readdir(directories.processed)).toEqual([
      'curva-abc-2026-07-20T12-00-00-000Z.json',
      'curva-abc-2026-07-20T12-00-00-000Z.txt',
      'curva-abc.txt',
    ]);
  });

  it('continua os demais arquivos quando uma importacao falha', async () => {
    await writePair('a-falha', '.txt', 'Conteúdo A', {
      ...validMetadata,
      title: 'Falhar',
    });
    await writePair('b-sucesso', '.md', 'Conteúdo B', {
      ...validMetadata,
      title: 'Sucesso',
    });
    const service = new FakeIngestionService(new Set(['Falhar']));

    const summary = await runKnowledgeImport({
      directories,
      maxBytes: 1024,
      service,
      now: () => fixedDate,
    });

    expect(service.inputs.map((input) => input.title)).toEqual([
      'Falhar',
      'Sucesso',
    ]);
    expect(summary).toEqual({
      filesFound: 2,
      imported: 1,
      failures: 1,
      chunksCreated: 2,
    });
    expect(await readdir(directories.processed)).toContain('b-sucesso.md');
    expect(await readdir(directories.failed)).toContain('a-falha.txt');
  });

  it('encerra pasta vazia com sucesso e informa ausencia de arquivos', async () => {
    const summary = await runKnowledgeImport({
      directories,
      maxBytes: 1024,
      service: new FakeIngestionService(),
      now: () => fixedDate,
    });

    expect(summary).toEqual({
      filesFound: 0,
      imported: 0,
      failures: 0,
      chunksCreated: 0,
    });
    expect(formatKnowledgeImportSummary(summary)).toContain(
      'Nenhum arquivo de conhecimento encontrado.',
    );
  });

  it('move sourceKey duplicada para failed com erro seguro', async () => {
    await writePair('duplicada', '.txt');

    const summary = await runKnowledgeImport({
      directories,
      maxBytes: 1024,
      service: new DuplicateSourceService(),
      now: () => fixedDate,
    });

    expect(summary.failures).toBe(1);
    const errorContent = await readFile(
      join(directories.failed, 'duplicada.error.json'),
      'utf8',
    );
    expect(JSON.parse(errorContent)).toMatchObject({
      code: 'DUPLICATE_SOURCE',
      message: 'Já existe uma fonte com esta sourceKey.',
    });
    expect(errorContent).not.toContain('P2002');
    expect(await readdir(directories.failed)).toEqual([
      'duplicada.error.json',
      'duplicada.json',
      'duplicada.txt',
    ]);
  });
});
