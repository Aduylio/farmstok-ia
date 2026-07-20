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
