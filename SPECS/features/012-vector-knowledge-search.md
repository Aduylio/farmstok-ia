# Feature 012 - Busca vetorial por similaridade de cosseno

## Status e objetivo

Implementada em 21/07/2026 sem chamada externa, backfill, escrita no banco, migration ou alteracao do schema. Prepara busca semantica exata sobre `knowledge_chunk_embeddings` e retorna imediatamente `NO_EMBEDDINGS_AVAILABLE` enquanto a tabela estiver vazia.

## Contrato HTTP

`GET /api/knowledge/vector-search`

Parametros: `q` obrigatoria (trim, 1 a 500 caracteres), `limit` de 1 a 20 (padrao 5), `sourceKey`, `course`, `type` e `minSimilarity` entre 0 e 1 (padrao 0). Entrada invalida retorna HTTP 400 `INVALID_REQUEST`.

Resposta possui `query`, `results`, `total` e `reason`. `reason` pode ser `NO_EMBEDDINGS_AVAILABLE`, `NO_RELEVANT_RESULTS` ou `null`. Cada resultado contem chunk, conteudo, similaridade, timestamps e fonte com link temporal YouTube quando aplicavel.

## Input da pergunta

`buildQueryEmbeddingInput`, versao `queryEmbeddingInputVersion = "v1"`, normaliza CRLF/CR para LF e aplica trim. Nao adiciona prompt, metadados, contexto ou instrucoes; nao traduz, resume ou remove acentos. E uma politica separada do input de chunks.

## Fluxo e provider

O service primeiro conta embeddings ativos e compativeis. Se a contagem for zero, nao instancia nem chama `EmbeddingProvider` e nao exige `OPENAI_API_KEY`. Havendo vetores, gera um unico embedding para a pergunta, valida exatamente 1536 numeros finitos e consulta o repository.

Erros de configuracao, rate limit, timeout, provider ou vetor invalido retornam HTTP 503 `EMBEDDING_PROVIDER_UNAVAILABLE`. Falhas internas retornam HTTP 500 `INTERNAL_ERROR`. Nenhum erro expoe chave, SQL, headers, vetor, stack ou resposta externa.

## SQL vetorial

```sql
1 - (embeddings.embedding <=> query_vector::vector) AS similarity
```

Somente fontes ativas e embeddings com `provider=openai`, `model=text-embedding-3-small` e `dimensions=1536` participam. `sourceKey`, curso, tipo, `minSimilarity` e limite sao aplicados no banco. Ordenacao: similaridade decrescente, `sourceKey`, `startTime NULLS LAST` e `chunkId`. Vetores armazenados nao sao selecionados nem registrados. A busca e exata, sem HNSW ou IVFFlat.

## CLI

```bash
npm run knowledge:vector-search -- "como definir estoque minimo"
npm run knowledge:vector-search -- "curva ABC" --limit 10 --min-similarity 0.7
```

Aceita `--limit`, `--source-key`, `--course`, `--type` e `--min-similarity`. Com zero embeddings informa que o backfill deve ser executado e nao exige chave.

## Aceitacao, riscos e rollback

- [x] Endpoint novo sem substituir a busca textual.
- [x] Cosseno exato parametrizado e espacos vetoriais compativeis apenas.
- [x] Zero embeddings nao chama provider.
- [x] Filtros, limite, threshold e desempate deterministico.
- [x] Links temporais reutilizam utilitario existente.
- [x] CLI e testes sem chamadas externas.
- [x] Schema, migrations, fontes e chunks inalterados.

Limitacao atual: com zero embeddings nao ha resultado semantico. Apos os tres primeiros embeddings, validar contagem compativel, chamada controlada do provider, ranking, faixa de similaridade, threshold, filtros, timestamps e ausencia de vazamento em logs. A busca exata pode ficar lenta com crescimento relevante; indice aproximado somente deve ser avaliado com dados e medicao. Rollback remove modulo, registro da rota, script e documentacao, sem rollback de dados.

## Fora do escopo

Backfill, chamadas reais durante implementacao, busca hibrida, resposta por IA, DeepSeek, WhatsApp, Kommo, autenticacao e indices HNSW/IVFFlat.
