# Contratos da API

## GET /api/health

Retorna o estado básico do serviço.

## POST /api/knowledge/ask

Endpoint simulado existente para perguntas sobre a base de conhecimento. Seu comportamento não foi alterado pela feature de ingestão.

## POST /api/knowledge/sources

Cadastra uma fonte e seus chunks em uma única transação.

### Payload

```json
{
  "sourceKey": "aula:gestao-estoques:curva-abc",
  "type": "AULA",
  "title": "Curva ABC",
  "course": "Farmstok",
  "module": "Gestão de Estoques",
  "lessonNumber": 1,
  "sourceUrl": "https://exemplo.com/aula",
  "instructor": "Nome do instrutor",
  "content": "Texto completo da aula..."
}
```

Obrigatórios: `sourceKey`, `type`, `title`, `course` e `content` não vazio. `sourceKey` deve ter até 200 caracteres e seguir `^[a-z0-9][a-z0-9:_-]*$`.

Opcionais: `module`, `lessonNumber`, `sourceUrl`, `recordedAt`, `version`, `priority`, `isActive`, `storagePath` e `instructor`.

### Sucesso — 201

```json
{
  "source": {
    "id": "uuid",
    "sourceKey": "aula:gestao-estoques:curva-abc",
    "type": "AULA",
    "title": "Curva ABC",
    "course": "Farmstok"
  },
  "ingestion": {
    "chunksCreated": 3,
    "charactersProcessed": 2450
  }
}
```

Embeddings, conteúdo dos chunks e detalhes internos não são retornados.

### Erros

- `400 INVALID_REQUEST`: payload inválido ou conteúdo vazio.
- `409 DUPLICATE_CONTENT`: conflito com conteúdo duplicado dentro da fonte.
- `409 DUPLICATE_SOURCE`: já existe fonte com a `sourceKey` informada.
- `500 INTERNAL_ERROR`: falha inesperada, sem exposição de SQL, credenciais ou stack trace.

## GET /api/knowledge/search

Busca textual diagnóstica nos chunks de fontes ativas.

Parâmetros: `q` obrigatório; `limit` opcional entre 1 e 20, padrão 5; filtros opcionais `sourceKey`, `course` e `type`.

```http
GET /api/knowledge/search?q=estoque%20mínimo%20Trier&limit=5
```

Retorna `query`, `results` e `total`. Cada resultado contém `chunkId`, `content`, `score`, `startTime`, `endTime` e fonte com `id`, `sourceKey`, `type`, `title`, `course`, `module`, `sourceUrl` e `timestampUrl`.

- `400 INVALID_REQUEST`: parâmetros ausentes ou inválidos.
- `200` com `results: []`: nenhum termo relevante.
- `500 INTERNAL_ERROR`: falha inesperada sem detalhes internos.

O ranking textual é determinístico, temporário e avalia no máximo 500 candidatos ativos antes de ordenar e aplicar `limit`.

## Comando interno: knowledge:search

```bash
npm run knowledge:search -- "estoque mínimo Trier" [--limit 10] [--source-key chave]
```

Reutiliza o mesmo service do endpoint e imprime resultados resumidos sem alterar dados.

## Comando interno: knowledge:import

Ferramenta local do MVP para importar pares `.txt`/`.md` e `.json` da pasta `data/knowledge/inbox`:

```bash
npm run knowledge:import
```

Não é um endpoint HTTP. O comando reutiliza o serviço de ingestão, move sucessos para `processed`, falhas para `failed` e imprime apenas um resumo agregado. PostgreSQL permanece como fonte de verdade.

## Comando interno: knowledge:reprocess

Substitui transacionalmente os chunks de uma fonte existente usando uma transcrição TXT ou Markdown:

```bash
npm run knowledge:reprocess -- <sourceId> <arquivo.txt|arquivo.md>
```

Forma preferencial:

```bash
npm run knowledge:reprocess -- --source-key <sourceKey> <arquivo.txt|arquivo.md>
```

O comando preserva a fonte e seus metadados, não cria fonte duplicada e preenche `startTime`/`endTime` quando encontra timestamps isolados. Não é um endpoint HTTP e não executa reprocessamento automático.
