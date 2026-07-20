# Feature 006 — Importação local de conhecimento

## Status

Implementada em 20/07/2026.

## Objetivo

Importar arquivos locais `.txt` e `.md` para o PostgreSQL por um comando npm, reutilizando integralmente o serviço transacional da Feature 005.

## Escopo implementado

- Comando `npm run knowledge:import`.
- Descoberta determinística de `.txt` e `.md` na inbox.
- Metadados em arquivo JSON de mesmo nome-base.
- Validação com o schema Zod compartilhado da Feature 005.
- Limite configurável verificado antes da leitura integral do conteúdo.
- Processamento sequencial, um arquivo por vez.
- Movimentação para `processed` somente após sucesso do serviço.
- Movimentação para `failed` e geração de erro seguro após falha.
- Continuação do lote quando um arquivo falha.
- Proteção contra sobrescrita por sufixo timestamp.
- Resumo final sem impressão do conteúdo das fontes.

## Fora do escopo

- Upload HTTP, observação automática da pasta ou execução em background.
- PDF, DOCX, áudio, vídeo e transcrição.
- Embeddings, pgvector, IA ou busca semântica.
- WhatsApp, Kommo e autenticação.
- Framework genérico de jobs.

## Estrutura de diretórios

```text
data/knowledge/
├── inbox/
├── processed/
└── failed/
```

- `inbox`: entrada temporária para pares de conteúdo e metadados ainda não processados.
- `processed`: evidência operacional local de arquivos importados; não substitui backup.
- `failed`: arquivos rejeitados e relatório resumido do erro.
- PostgreSQL é a fonte de verdade dos dados importados.
- Arquivos de conhecimento e metadados não devem conter segredos ou credenciais.

As três pastas são versionadas por arquivos `.gitkeep`; conteúdo real só deve ser adicionado deliberadamente.

## Formato de entrada

Cada fonte é formada por:

- um arquivo UTF-8 `.txt` ou `.md` com o conteúdo completo;
- um `.json` de mesmo nome-base com metadados.

Exemplo:

```text
data/knowledge/inbox/curva-abc.txt
data/knowledge/inbox/curva-abc.json
```

`curva-abc.txt`:

```text
Curva ABC

0:14
A Curva ABC classifica os itens de estoque conforme sua relevância.

0:48
Os itens A exigem acompanhamento mais frequente, enquanto os itens B e C possuem menor impacto relativo.
```

`curva-abc.json`:

```json
{
  "type": "AULA",
  "title": "Curva ABC",
  "course": "Farmstok",
  "module": "Gestão de Estoques",
  "lessonNumber": 1,
  "sourceUrl": null,
  "instructor": "Nome do instrutor"
}
```

Valores `null` em campos opcionais são removidos antes da validação. Campos obrigatórios continuam sujeitos ao schema da Feature 005.

## Configuração

Variável de ambiente:

```dotenv
KNOWLEDGE_IMPORT_MAX_BYTES=5242880
```

- Valor padrão: 5 MiB (`5 * 1024 * 1024` bytes).
- Validada com Zod como inteiro positivo em `src/config/env.ts`.
- O tamanho é obtido por `stat` antes de `readFile` do conteúdo.

## Fluxo

1. Garante a existência das três pastas.
2. Lista somente arquivos regulares `.txt` e `.md` da inbox.
3. Ordena os nomes por comparação de código Unicode, de forma determinística.
4. Processa um arquivo por vez.
5. Verifica o tamanho antes de ler o conteúdo completo.
6. Procura e interpreta o JSON correspondente.
7. Valida metadados e conteúdo com os schemas compartilhados.
8. Chama `KnowledgeIngestionService.ingest` sem duplicar chunking, hash ou persistência.
9. Aguarda o commit da transação Prisma.
10. Move o par para `processed` somente após o retorno bem-sucedido.
11. Em caso de falha, move os arquivos disponíveis para `failed`, cria o erro seguro e continua o lote.
12. Imprime somente o resumo agregado.

## Colisões de nomes

O importador nunca sobrescreve arquivos existentes em `processed` ou `failed`.

Quando há colisão, todo o conjunto recebe o mesmo timestamp UTC seguro:

```text
curva-abc-2026-07-20T12-00-00-000Z.txt
curva-abc-2026-07-20T12-00-00-000Z.json
```

Se o nome com timestamp também existir, um contador determinístico é acrescentado.

## Arquivo de erro

Exemplo: `curva-abc.error.json`.

Contém somente:

```json
{
  "fileName": "curva-abc.txt",
  "code": "INVALID_METADATA",
  "message": "Os metadados da fonte são inválidos.",
  "attemptedAt": "2026-07-20T12:00:00.000Z"
}
```

Nunca contém `DATABASE_URL`, SQL, stack trace, credenciais, conteúdo completo ou detalhes internos do Prisma.

Códigos seguros previstos:

- `FILE_TOO_LARGE`;
- `MISSING_METADATA`;
- `INVALID_JSON`;
- `INVALID_METADATA`;
- `EMPTY_CONTENT`;
- `INVALID_CONTENT`;
- `DUPLICATE_CONTENT`;
- `IMPORT_FAILED`.

## Saída do terminal

```text
Importação concluída.
Arquivos encontrados: 3
Importados: 2
Falhas: 1
Chunks criados: 14
```

Inbox vazia acrescenta `Nenhum arquivo de conhecimento encontrado.` e encerra com código zero.

## Reutilização da Feature 005

O script instancia:

- `PrismaKnowledgeIngestionRepository`;
- `KnowledgeIngestionService`.

O importador não conhece a implementação de chunks, SHA-256, tokenCount ou transação. Ele fornece metadados e conteúdo validados ao mesmo método `ingest` usado pelo endpoint HTTP.

Transcrições que possuem timestamps isolados são interpretadas pelo pipeline temporal da Feature 007. Arquivos sem timestamps mantêm o chunking anterior.

## Encerramento

O entrypoint sempre executa `prisma.$disconnect()` em `finally`. Falhas fatais do lote retornam código de processo diferente de zero sem imprimir detalhes internos.

## Critérios de aceitação

- [x] Especificação e comando npm criados.
- [x] Pastas inbox, processed e failed versionadas.
- [x] `.txt` e `.md` encontrados e ordenados deterministicamente.
- [x] Outras extensões ignoradas.
- [x] Metadados validados pelo schema compartilhado da Feature 005.
- [x] Arquivo sem JSON, JSON inválido e conteúdo vazio tratados de forma controlada.
- [x] Limite de 5 MiB configurável e validado antes da leitura integral.
- [x] Serviço existente reutilizado sem duplicar ingestão.
- [x] Arquivos movidos somente após sucesso transacional.
- [x] Falhas não interrompem os próximos arquivos.
- [x] Colisões não sobrescrevem arquivos.
- [x] Relatório de erro não contém informações sensíveis.
- [x] Prisma Client, conexão, typecheck e testes validados.
- [x] Schema, migrations, endpoints e chunking existentes não foram alterados.

## Testes

- Descoberta de `.txt`, `.md` e extensões em maiúsculas.
- Exclusão de outras extensões.
- Ordenação determinística.
- Metadados ausentes e JSON sintaticamente inválido.
- Conteúdo vazio.
- Arquivo acima do limite.
- Importação bem-sucedida e reutilização do serviço.
- Movimentação para `processed` e `failed`.
- Colisão de nomes com timestamp seguro.
- Continuação depois de falha.
- Inbox vazia e mensagem correspondente.

Os testes usam diretórios temporários e serviço injetado; não acessam PostgreSQL real.

## Riscos e limitações

- `processed` é uma conveniência operacional, não backup ou fonte de verdade.
- Uma falha de filesystem depois do commit pode deixar dados persistidos sem mover completamente o par; o operador deve conferir o resumo e as pastas.
- Não existe lock para duas execuções simultâneas; o comando deve ser executado por um operador por vez.
- Não existe idempotência no nível da fonte; reintroduzir um arquivo pode criar outra fonte.
- Arquivos grandes dentro do limite ainda usam memória proporcional ao conteúdo.
- O importer não valida encoding além da leitura UTF-8 do Node.js.
- Arquivos JSON órfãos são ignorados porque somente `.txt` e `.md` iniciam processamento.

## Rollback

Não houve alteração de schema ou migration. O rollback do código remove o comando, módulo e pastas versionadas. Dados já importados não devem ser excluídos automaticamente; qualquer limpeza deve ser explícita e respeitar relacionamentos do banco.

## Próximos passos

1. Definir idempotência e reprocessamento no nível da fonte.
2. Adicionar lock simples se houver necessidade real de execução concorrente.
3. Avaliar streaming somente se arquivos maiores forem necessários.
4. Criar teste opcional com banco descartável.
5. Manter PDF, embeddings e integrações externas em features separadas.
