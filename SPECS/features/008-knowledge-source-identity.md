# Feature 008 — Identidade única de fontes de conhecimento

## Status

Implementada em 20/07/2026.

## Objetivo

Impedir o cadastro acidental da mesma aula, live, mentoria, PDF ou FAQ mais de uma vez, usando uma identidade estável e explícita que não depende do título exibido.

## Contrato de `sourceKey`

- Campo obrigatório `KnowledgeSource.sourceKey`, mapeado para `knowledge_sources.source_key`.
- Único no PostgreSQL e no schema Prisma.
- Fornecido pelo operador; nunca derivado automaticamente do título.
- Entre 1 e 200 caracteres.
- Armazenado em letras minúsculas.
- Formato `^[a-z0-9][a-z0-9:_-]*$`.
- Aceita letras ASCII minúsculas, números, `:`, `_` e `-`, sem iniciar por separador.

Exemplos válidos:

```text
live:historia-farmstok
live:webinar-trier-compras-inteligentes
aula:gestao-estoques:curva-abc
mentoria:compras:encontro-01
```

Maiúsculas, espaços, barras e separador inicial são rejeitados. A aplicação não normaliza silenciosamente uma chave inválida.

## Migração e registros existentes

A migration `20260720143000_add_knowledge_source_identity` foi criada sem modificar as migrations anteriores. Antes da aplicação foram confirmados 2 registros e 148 chunks:

| ID | Título confirmado | `sourceKey` atribuída |
|---|---|---|
| `6d20dd98-8829-4209-801a-f361cb7fe910` | História do Farmstok e apresentação do método | `live:historia-farmstok` |
| `db1214d6-f15f-4a45-b450-ca51788c5b5a` | Webinar Trier: Aprenda a Comprar de Forma Inteligente! Com Sérgio Samuel | `live:webinar-trier-compras-inteligentes` |

Estratégia segura:

1. adicionar `source_key` opcional;
2. preencher os dois registros por UUID e título exatos;
3. abortar se o banco não tiver exatamente as duas fontes auditadas ou restar valor nulo;
4. tornar a coluna obrigatória;
5. adicionar check de tamanho/formato e índice único.

Os `UPDATE`s não alteram `updated_at`. Fontes, chunks e timestamps temporais não são excluídos nem reprocessados.

## Ingestão HTTP e local

`POST /api/knowledge/sources` e o JSON do importador exigem `sourceKey`. O service consulta a chave antes de preparar a persistência. Se ela já existir, lança `DuplicateKnowledgeSourceError` antes da transação de criação.

A consulta prévia melhora a resposta, mas não é a proteção definitiva. A constraint única cobre concorrência; um `P2002` durante `knowledgeSource.create` também é convertido em `DuplicateKnowledgeSourceError`, sem criar chunks.

Resposta HTTP de conflito:

```json
{
  "error": "DUPLICATE_SOURCE",
  "message": "Já existe uma fonte com esta sourceKey."
}
```

No importador, os arquivos do par são movidos para `failed` e o `.error.json` usa o mesmo código e mensagem. UUID, SQL, stack, credenciais e detalhes Prisma não são expostos.

## Reprocessamento

O modo preferencial localiza a fonte pela chave:

```bash
npm run knowledge:reprocess -- --source-key <sourceKey> <arquivo.txt|arquivo.md>
```

O formato legado por UUID continua disponível. A resolução ocorre dentro da mesma transação que substitui os chunks. O reprocessamento preserva o ID, a `sourceKey` e os demais metadados, e nunca cria uma fonte.

## Critérios de aceitação

- [x] `sourceKey` obrigatória, explícita, estável, única e mapeada para `source_key`.
- [x] Tamanho e expressão regular validados na aplicação e no banco.
- [x] Registros existentes preenchidos explicitamente sem alterar timestamps.
- [x] Migrations anteriores preservadas e nova migration aplicada sem reset.
- [x] Endpoint e importador exigem a chave.
- [x] Duplicidade tratada previamente e pela constraint contra corrida.
- [x] Conflito não cria fonte nem chunks e produz mensagem segura.
- [x] Reprocessamento preferencial por chave e compatível por UUID.
- [x] JSONs processados atualizados sem reimportação ou movimentação.
- [x] Testes unitários independentes do PostgreSQL real.
- [x] Nenhum embedding, pgvector, IA ou integração externa adicionada.

## Casos de teste

- aceita chave válida;
- rejeita maiúsculas, espaços, barras, separador inicial e campo ausente;
- cria fonte normalmente com a chave;
- interrompe o service antes da transação quando a chave existe;
- mapeia `P2002` da criação da fonte e não chama `createMany`;
- move duplicidade local para `failed` com `DUPLICATE_SOURCE` seguro;
- encontra e reprocessa por chave preservando ID e chave;
- mantém rollback transacional e compatibilidade por UUID;
- preserva todos os testes anteriores.

## Riscos e rollback

- A chave é uma identidade operacional; renomeá-la sem planejamento pode quebrar automações locais.
- A consulta prévia ainda possui janela de corrida, deliberadamente fechada pela unicidade no banco.
- A migration pressupõe os dois registros auditados e aborta se o estado divergir, evitando backfill parcial.
- Para rollback de código, reverter os contratos e consultas. Para rollback de banco, criar migration compensatória deliberada que remova índice, check e coluna; não editar migration aplicada e não resetar o banco.

## Fora do escopo

Histórico de versões, geração automática de chave, pgvector, embeddings, busca semântica, IA, WhatsApp, Kommo, autenticação, upload HTTP e processamento em background.
