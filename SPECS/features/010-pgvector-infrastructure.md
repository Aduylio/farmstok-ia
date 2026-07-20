# Feature 010 — Infraestrutura pgvector e armazenamento de embeddings

## Atualizacao pela Feature 011

O cliente e o backfill controlado, idempotente e retomavel foram implementados, mantendo dry-run como padrao. A infraestrutura continua sem indice aproximado e com zero embeddings ate autorizacao manual de uma execucao paga.

## Status

Implementada em 20/07/2026.

## Objetivo

Preparar PostgreSQL e código interno para armazenar embeddings de 1536 dimensões sem chamar a OpenAI, gerar vetores, alterar endpoints ou implementar busca vetorial.

## Preflight

Executado em transação somente leitura antes de qualquer alteração:

- PostgreSQL `18.4` para Windows x86_64;
- extensão `vector` disponível na versão `0.8.5` e ainda não instalada no banco;
- 2 fontes;
- 148 chunks;
- 0 valores não nulos em `knowledge_chunks.embedding`;
- coluna antiga confirmada como `TEXT`;
- fingerprints de fontes e chunks registrados para comparação final.

## Configuração confirmada

```ts
EMBEDDING_PROVIDER = 'openai'
EMBEDDING_MODEL = 'text-embedding-3-small'
EMBEDDING_DIMENSIONS = 1536
```

A futura métrica será similaridade de cosseno com busca exata inicialmente. Não há HNSW ou IVFFlat.

Trocar modelo ou dimensões exigirá nova migration, limpeza ou versionamento dos embeddings existentes, novo backfill e nova avaliação da busca.

## Arquitetura de dados

O vetor fica separado de `knowledge_chunks`:

```text
knowledge_chunks 1 ─── 0..1 knowledge_chunk_embeddings
```

`knowledge_chunk_embeddings`:

| Coluna | Tipo | Regra |
|---|---|---|
| `chunk_id` | UUID | PK e FK obrigatória para `knowledge_chunks.id`. |
| `embedding` | `vector(1536)` | Obrigatório. |
| `provider` | VARCHAR(50) | Obrigatório e não vazio. |
| `model` | VARCHAR(100) | Obrigatório e não vazio. |
| `dimensions` | INTEGER | Exatamente 1536. |
| `input_hash` | CHAR(64) | SHA-256 hexadecimal minúsculo. |
| `input_tokens` | INTEGER | Opcional e não negativo. |
| `embedded_at` | TIMESTAMPTZ(3) | Momento informado pelo futuro gerador. |
| `created_at` | TIMESTAMPTZ(3) | Default atual. |
| `updated_at` | TIMESTAMPTZ(3) | Atualizado em upsert. |

A FK usa `ON DELETE CASCADE`. Como o reprocessamento exclui e recria chunks, embeddings futuros dos IDs antigos serão removidos automaticamente.

## Migration

Migration `20260720153000_add_pgvector_infrastructure`:

1. executa `CREATE EXTENSION IF NOT EXISTS vector`;
2. aborta explicitamente se a coluna `knowledge_chunks.embedding` tiver valor não nulo;
3. remove a coluna antiga somente após a guarda;
4. cria a tabela separada e suas constraints;
5. adiciona FK com `ON DELETE CASCADE`;
6. não insere registros e não cria índice aproximado.

As migrations anteriores permanecem imutáveis. `prisma db push` não foi usado.

## Prisma

`KnowledgeChunkEmbedding` mapeia para `knowledge_chunk_embeddings`. O campo vetorial usa `Unsupported("vector(1536)")`, pois Prisma 7 não oferece CRUD nativo completo para pgvector.

A relação opcional em `KnowledgeChunk` preserva operações existentes. Gravações e futuras buscas vetoriais devem usar SQL parametrizado. Prisma Studio continua útil para fontes, chunks, conteúdo e timestamps, mas não é a ferramenta de inspeção dos vetores; usar `db:vector-check` e consultas SQL seguras.

## Utilitários vetoriais

`validateEmbeddingVector` exige um array com exatamente 1536 números finitos. Dimensões diferentes, valores não numéricos, `NaN`, `Infinity` e `-Infinity` são rejeitados sem truncamento, preenchimento ou normalização.

`serializeEmbeddingVector` só serializa após validação e produz deterministicamente `[n1,n2,...]`. Vetores não são registrados em logs ou mensagens de erro.

## Repository interno

`KnowledgeEmbeddingRepository` prepara:

- `upsertEmbedding`;
- `deleteEmbeddingByChunkId`;
- `countEmbeddings`;
- `countChunksWithoutEmbedding`.

Todas as operações usam tagged templates parametrizados. O vetor validado é enviado como parâmetro com cast explícito `::vector`. O upsert atualiza vetor, provider, model, dimensions, hash, tokens, `embeddedAt` e `updatedAt`, sem alterar o chunk.

O repository não é executado no startup nem chamado automaticamente nesta feature.

## Auditoria

```bash
npm run db:vector-check
```

O script é somente leitura e informa conexão, versão instalada, tabela, tipo vetorial, contagens, órfãos e ausência da coluna antiga sem exibir URL, credenciais, SQL sensível ou vetores.

Resultado após migration:

- pgvector 0.8.5 instalado;
- `embedding vector(1536)`;
- 2 fontes e 148 chunks;
- 0 embeddings;
- 148 chunks sem embedding;
- 0 embeddings órfãos;
- coluna antiga ausente.

## Compatibilidade

Nenhum contrato público foi alterado. Busca textual, ask, ingestão, importador, reprocessamento, chunking, hashes, timestamps e `sourceKey` mantêm o comportamento anterior.

## Critérios de aceitação

- [x] Preflight somente leitura aprovado.
- [x] Extensão pgvector habilitada pela migration.
- [x] Coluna antiga protegida antes da remoção.
- [x] Tabela separada com vetor de 1536 dimensões e FK em cascade.
- [x] Schema Prisma validado e Client gerado com tipo Unsupported.
- [x] Configuração OpenAI explícita sem API key ou SDK.
- [x] Utilitários validam dimensão e finitude.
- [x] Repository parametrizado preparado, mas não executado.
- [x] Auditoria vetorial somente leitura criada.
- [x] Nenhum embedding, índice aproximado ou chamada externa criado.
- [x] Fontes, chunks, IDs, hashes e timestamps preservados.
- [x] Testes unitários independentes do PostgreSQL real.

## Riscos e rollback

- Tipos Unsupported não possuem suporte completo no Prisma Client/Studio.
- O formato e dimensão ficam acoplados ao modelo escolhido.
- SQL vetorial futuro deve continuar parametrizado e validar todos os vetores.
- Busca exata poderá exigir otimização quando a base crescer.
- Rollback deve ser uma nova migration deliberada. Restaurar a antiga coluna `TEXT` não recuperaria embeddings; não editar a migration aplicada nem resetar o banco.

## Fora do escopo e próximo passo

Não há chamada OpenAI, chave, SDK, geração, backfill, busca vetorial/híbrida, endpoint novo, IA, filas ou integrações externas.

A Feature 011 deve implementar geração controlada e idempotente de embeddings, hash do texto exato, persistência pelo repository e backfill operacional com retomada segura, sem ainda conectar respostas geradas por IA.
