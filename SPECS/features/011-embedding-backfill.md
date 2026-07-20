# Feature 011 - Cliente de embeddings e backfill idempotente

## Objetivo e estado

Preparar a geracao manual de embeddings dos chunks ativos com OpenAI, persistencia segura em `knowledge_chunk_embeddings` e retomada idempotente. A implementacao termina validada apenas em dry-run: nenhuma chamada paga foi feita e a tabela permanece vazia.

## Configuracao confirmada

- SDK oficial `openai` 6.48.0.
- Provider `openai`, modelo `text-embedding-3-small`, 1536 dimensoes.
- `OPENAI_API_KEY` opcional no startup e obrigatoria apenas com `--execute`.
- Lotes de 1 a 100, padrao 20; 0 a 10 retries, padrao 3; backoff inicial padrao 1000 ms.
- O retry interno do SDK fica desabilitado; a aplicacao controla timeout de 30 s e retries testaveis.

DeepSeek pode ser avaliada futuramente para gerar respostas, independentemente do provider de embeddings. Ela nao e implementada nem usada nesta feature.

## Politica de input v1

`buildEmbeddingInput` monta deterministicamente:

```text
Titulo: <title>
Curso: <course>
Modulo: <module ou vazio>
Tipo: <type>
Conteudo:
<chunk.content>
```

Os rotulos reais preservam os acentos. Quebras CRLF/CR sao normalizadas para LF e espacos finais de cada linha sao removidos. Palavras, acentos e conteudo nao sao traduzidos, resumidos ou truncados. UUID, `sourceKey`, URL, timestamps, hashes e dados internos nao sao enviados. `input_hash` e o SHA-256 hexadecimal do UTF-8 desse texto exato.

## Idempotencia e selecao

Somente chunks de fontes ativas entram na consulta, ordenados por `sourceKey` e `chunkId`. Um registro esta atualizado apenas quando provider, modelo, dimensoes e `inputHash` coincidem. Ausencia gera `create`; divergencia gera `update`; `--force` reprocessa atualizados. A consulta aceita `sourceKey` e `limit`, nao seleciona vetores e carrega apenas campos usados pela politica.

Reprocessar uma fonte pode remover embeddings por cascade. Depois disso, executar primeiro o dry-run filtrado e, mediante decisao de custo, o backfill filtrado.

## Provider, retry e seguranca

`EmbeddingProvider` desacopla o servico do SDK. `OpenAIEmbeddingProvider` envia arrays de textos, pede 1536 dimensoes explicitamente e valida quantidade, indices/ordem e todos os vetores antes da persistencia. Rate limit, timeout/conexao e 5xx usam backoff exponencial limitado. 400, credencial invalida e resposta/vetor invalido nao repetem.

Erros sao mapeados para codigos internos. Chave, headers, resposta completa, textos e vetores nao sao registrados. Testes usam cliente, sleep, provider e repository falsos: nao usam internet, chave real ou PostgreSQL.

## Batching e falhas

O processamento e sequencial em pequenos lotes. A resposta completa e validada antes da escrita; cada lote usa uma transacao Prisma e upserts SQL parametrizados. Falha interrompe a execucao com status diferente de zero e nao deixa escrita parcial no lote. Lotes anteriores permanecem, permitindo retomada; registros atuais sao ignorados na nova execucao.

## CLI e custo

```bash
npm run knowledge:embed
npm run knowledge:embed -- --source-key live:historia-farmstok
npm run knowledge:embed -- --execute
npm run knowledge:embed -- --execute --yes --limit 3
```

O padrao e dry-run: nao exige chave, nao chama OpenAI e nao escreve. Caracteres sao exatos para os candidatos e tokens sao estimados por `ceil(caracteres / 4)`, valor aproximado que nao representa faturamento. `--execute` exige confirmacao `GERAR`; sem TTY exige `--yes`. Opcoes desconhecidas ou invalidas falham. Prisma sempre e encerrado.

Teste manual pago, somente apos configurar chave valida e autorizar:

```bash
npm run knowledge:embed
npm run knowledge:embed -- --execute --yes --limit 3
npm run db:vector-check
npm run knowledge:embed -- --limit 3
```

Confirmar que os tres ficam atuais antes de executar o restante com `npm run knowledge:embed -- --execute --yes`. Trocar provider, modelo, dimensao ou politica exige avaliar schema, versionar mudancas necessarias e executar dry-run; divergencia de metadados/hash agenda reprocessamento.

## Auditoria e criterios de aceitacao

`npm run db:vector-check` informa chunks ativos, embeddings, ausentes, desatualizados, orfaos, providers, modelos, dimensoes, hashes invalidos e vetores nulos sem imprimir vetores.

- [x] Input v1 puro, deterministico e com SHA-256.
- [x] Selecao idempotente, filtros, limite, force e ordem estavel.
- [x] Provider desacoplado, timeout, resposta validada e retry limitado.
- [x] Dry-run padrao sem chave, chamadas ou escrita.
- [x] Confirmacao adicional para execucao paga.
- [x] Uma transacao por batch e retomada segura.
- [x] Testes sem rede, chave real ou banco real.
- [x] Schema e migrations inalterados; busca textual e endpoints preservados.
- [x] Finalizacao com zero embeddings e nenhuma chamada externa.

## Riscos e rollback

Custos e limites do provider, latencia, inputs grandes e mudanca de modelo/politica sao os principais riscos. Mitigacoes: dry-run, limite, filtro, confirmacao, pequenos lotes, timeout, retry seletivo e auditoria. O rollback operacional e interromper o comando; lotes completos permanecem consistentes. Remocao deliberada deve usar operacao parametrizada e auditoria, nunca editar migration aplicada. Nao ha rollback de schema nesta feature.

## Fora do escopo

Execucao real do backfill, embeddings automaticos na importacao/startup, Batch API, HNSW/IVFFlat, busca vetorial, resposta por IA, DeepSeek, WhatsApp, Kommo e novos endpoints.
