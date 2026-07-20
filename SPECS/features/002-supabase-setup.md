# Feature 002 — Configuração do Supabase

## Objetivo

Configurar o cliente Supabase no backend, criar o banco de dados com migrations versionadas, ativar a extensão pgvector e criar as tabelas `knowledge_sources` e `knowledge_chunks` para suportar a base de conhecimento do Farmstok AI.

## Escopo

- Instalar o pacote `@supabase/supabase-js`.
- Configurar variáveis de ambiente para conexão.
- Criar cliente Supabase no módulo `config/`.
- Criar estratégia de migrations SQL versionadas na pasta `supabase/migrations/`.
- Ativar a extensão `vector` (pgvector).
- Criar tabela `knowledge_sources`.
- Criar tabela `knowledge_chunks` com coluna de embedding vetorial.
- Criar índices necessários.
- Criar repositório de leitura e escrita no módulo `knowledge/`.
- Testar conexão, inserção e leitura básica.

## Fora do escopo

- Geração de embeddings.
- Conexão com OpenAI.
- Conexão com WhatsApp.
- Conexão com Kommo.
- Autenticação de alunos.
- Busca vetorial por similaridade.
- Ingestão de transcrições.
- Docker.
- Qualquer integração com provedores de IA.

## Dependências necessárias

| Pacote | Tipo | Uso |
|--------|------|-----|
| `@supabase/supabase-js` | dependency | Cliente JavaScript oficial do Supabase |

Nenhuma outra dependência deve ser instalada nesta etapa.

## Variáveis de ambiente necessárias

| Variável | Tipo | Obrigatória | Descrição |
|----------|------|-------------|-----------|
| `SUPABASE_URL` | string | Sim | URL do projeto Supabase (ex: `https://xyzcompany.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | string | Sim | Chave de serviço (service role) do Supabase. Usada apenas no backend. |
| `SUPABASE_ANON_KEY` | string | Não | Chave anônima. Não utilizada nesta etapa. |

### Validação

As variáveis devem ser validadas com Zod no arquivo `src/config/env.ts`, seguindo o padrão existente. A validação deve ocorrer apenas quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estiverem presentes (modo opcional para não quebrar ambientes que ainda não configuraram o Supabase).

## Estrutura de arquivos planejada

```
src/
├── config/
│   ├── env.ts              (atualizar: adicionar variáveis Supabase)
│   └── supabase.ts         (novo: cliente Supabase)
├── modules/
│   └── knowledge/
│       ├── knowledge.routes.ts        (existente, sem alteração)
│       ├── knowledge.schemas.ts       (existente, sem alteração)
│       ├── knowledge.service.ts       (existente, sem alteração)
│       ├── knowledge.repository.ts    (novo: repositório de acesso ao banco)
│       └── knowledge.types.ts         (novo: tipos das tabelas)
supabase/
└── migrations/
    └── 001_enable_pgvector_and_create_tables.sql
```

## Configuração do cliente Supabase

O arquivo `src/config/supabase.ts` deve:

1. Importar `createClient` de `@supabase/supabase-js`.
2. Importar as variáveis de ambiente de `env.ts`.
3. Exportar uma instância do cliente criada com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
4. O tipo do cliente deve ser `SupabaseClient` (inferido pelo SDK).
5. Usar service role key porque o backend é o único consumidor direto do banco.
6. Não exportar a chave em nenhum log ou resposta.

## Estratégia de migrations SQL versionadas

### Formato dos arquivos

```
supabase/migrations/
└── { sequencia }_{nome_descritivo }.sql
```

Exemplo: `001_enable_pgvector_and_create_tables.sql`

### Regras

1. Cada migration deve ser um arquivo SQL independente.
2. As migrations devem ser idempotentes quando possível (usar `IF NOT EXISTS`).
3. O número sequencial deve ser incremental e com zeros à esquerda (3 dígitos).
4. A pasta `supabase/migrations/` deve ser versionada no repositório.
5. Não alterar migrations já aplicadas. Criar novas migrations para correções.
6. A ordem de execução é determinada pela ordenação alfabética do nome do arquivo.

## Ativação da extensão pgvector

A primeira migration deve ativar a extensão `vector`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Isso deve ser a primeira instrução da migration `001`, antes da criação de tabelas.

## Modelo detalhado das tabelas

### knowledge_sources

Armazena as fontes oficiais de conhecimento (aulas, módulos, materiais).

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| `id` | `uuid` | Não | Chave primária, gerada automaticamente (`gen_random_uuid()`) |
| `title` | `text` | Não | Título da fonte (ex: "Aula 9 — Curva ABC") |
| `module` | `text` | Sim | Nome do módulo (ex: "Gestão de Estoque") |
| `lesson_number` | `integer` | Sim | Número da aula dentro do módulo |
| `url` | `text` | Sim | Link direto para o conteúdo |
| `start_time` | `text` | Sim | Minuto de início do conteúdo (ex: "00:12:30") |
| `created_at` | `timestamptz` | Não | Data de criação do registro (default: `now()`) |
| `updated_at` | `timestamptz` | Não | Data da última atualização (default: `now()`) |

#### Constraints

- Chave primária: `id`
- Check: `lesson_number > 0` quando não nulo

### knowledge_chunks

Armazena trechos de conteúdo derivados das fontes, com embeddings vetoriais para busca por similaridade.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| `id` | `uuid` | Não | Chave primária, gerada automaticamente (`gen_random_uuid()`) |
| `source_id` | `uuid` | Não | Chave estrangeira para `knowledge_sources.id` |
| `content` | `text` | Não | Texto do trecho |
| `embedding` | `vector(1536)` | Sim | Vetor de embedding. Será populado na etapa de ingestão. A dimensão 1536 corresponde ao padrão do MVP e depende do modelo de embedding escolhido (ex: OpenAI `text-embedding-3-small`). Caso o modelo seja alterado, a dimensão da coluna e a migration devem ser ajustadas. |
| `chunk_index` | `integer` | Não | Índice do trecho dentro da fonte (começa em 0) |
| `token_count` | `integer` | Sim | Quantidade estimada de tokens do trecho |
| `created_at` | `timestamptz` | Não | Data de criação do registro (default: `now()`) |

#### Constraints

- Chave primária: `id`
- Chave estrangeira: `source_id` references `knowledge_sources(id) ON DELETE CASCADE`
- Check: `chunk_index >= 0`
- Check: `token_count > 0` quando não nulo
- Unique: `(source_id, chunk_index)` — evita duplicação de trechos dentro da mesma fonte

## Índices necessária

### knowledge_sources

| Índice | Colunas | Tipo | Descrição |
|--------|---------|------|-----------|
| `idx_knowledge_sources_module` | `module` | B-tree | Busca por módulo |

### knowledge_chunks

| Índice | Colunas | Tipo | Descrição |
|--------|---------|------|-----------|
| `idx_knowledge_chunks_source_id` | `source_id` | B-tree | Busca por fonte |
| `idx_knowledge_chunks_embedding` | `embedding` | A definir | Índice vetorial para busca por similaridade. **Não será criado nesta etapa.** A estratégia (IVFFlat, HNSW) e os parâmetros serão definidos somente após a ingestão de dados reais, quando for possível avaliar volume e performance. |

## Regras de integridade e relacionamentos

1. **Cascade delete**: quando um `knowledge_source` é removido, todos os seus `knowledge_chunks` devem ser removidos automaticamente.
2. **Embedding nullable**: a coluna `embedding` em `knowledge_chunks` é nullable para permitir inserção de trechos antes da geração de embeddings.
3. **Índice vetorial adiado**: o índice de similaridade vetorial não deve ser criado nesta etapa. Será avaliado e criado somente após a ingestão de dados reais, quando volume e padrão de consulta estiverem claros.
4. **Sem duplicação**: a combinação `(source_id, chunk_index)` deve ser única para evitar inserções duplicadas.
5. **Auditoria**: colunas `created_at` e `updated_at` devem ser preenchidas automaticamente.

## Estratégia de conexão segura

1. **Service role somente no backend**: a chave `SUPABASE_SERVICE_ROLE_KEY` é usada apenas no backend. Ela bypassa Row Level Security (RLS).
2. **Sem exposição ao cliente**: a service role key nunca deve ser retornada em respostas HTTP ou logs.
3. **Variáveis em `.env`**: as credenciais devem estar em `.env` (não versionado) e `.env.example` (versionado, sem valores reais).
4. **RLS desativado nesta etapa**: como não há autenticação de alunos, RLS será configurado em etapa futura.

## Critérios de aceitação

1. [ ] Pacote `@supabase/supabase-js` instalado e adicionado ao `package.json`.
2. [ ] Variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` validadas com Zod.
3. [ ] Cliente Supabase criado e exportado em `src/config/supabase.ts`.
4. [ ] Extensão `vector` ativada via migration SQL.
5. [ ] Tabela `knowledge_sources` criada com todas as colunas e constraints.
6. [ ] Tabela `knowledge_chunks` criada com todas as colunas, constraints e chave estrangeira.
7. [ ] Índices B-tree criados para buscas por módulo e source_id.
8. [ ] Índice vetorial **não** criado nesta etapa (adiado para após ingestão de dados reais).
9. [ ] Repositório `knowledge.repository.ts` criado com operações de insert e select.
10. [ ] Tipos TypeScript das tabelas definidos em `knowledge.types.ts`.
11. [ ] Testes automatizados passam (`npm run test:run`).
12. [ ] Typecheck passa (`npm run typecheck`).
13. [ ] Nenhum segredo exposto em código ou logs.
14. [ ] `.env.example` atualizado com as novas variáveis (sem valores reais).

## Casos de teste

1. **Inserir knowledge_source**: inserir um registro válido e verificar retorno com `id`.
2. **Inserir knowledge_chunk**: inserir um chunk vinculado a uma source existente.
3. **Inserir chunk sem embedding**: inserir chunk com `embedding = null` e verificar sucesso.
4. **Foreign key constraint**: tentar inserir chunk com `source_id` inexistente e verificar erro.
5. **Unique constraint**: inserir dois chunks com mesmo `(source_id, chunk_index)` e verificar erro.
6. **Consulta por módulo**: buscar sources filtrando por `module`.
7. **Consulta por source_id**: buscar chunks filtrando por `source_id`.
8. **Delete cascade**: deletar source e verificar que chunks associados foram removidos.

## Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Variáveis de ambiente não configuradas | Aplicação não inicia | Validação com Zod + mensagem clara de erro |
| Supabase indisponível | Falha na conexão | Retry com backoff no repositório (futuro) |
| Credenciais expostas | Segurança comprometida | Sem logs de credenciais, `.env` não versionado |
| Índice vetorial criado prematuramente | Performance ruim na busca | Índice vetorial adiado para etapa de ingestão, quando dados reais permitirão avaliar a melhor estratégia |
| Migração SQL com erro | Banco corrompido | Testar migrations em ambiente de staging antes de produção |
| Versão incompatível do Supabase SDK | Erros em runtime | Travar versão no `package.json`, testar antes de atualizar |

## Plano de rollback

1. **Se a migration não foi aplicada**: remover o arquivo de migration da pasta `supabase/migrations/`.
2. **Se a migration já foi aplicada**:
   - Criar migration de rollback: `DROP TABLE IF EXISTS knowledge_chunks; DROP TABLE IF EXISTS knowledge_sources; DROP EXTENSION IF EXISTS vector;`
   - Executar a migration de rollback no Supabase Dashboard.
3. **Se o código já foi deployado**:
   - Remover variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do ambiente.
   - Reverter o commit do código que adiciona o cliente e repositório.
   - Remover `@supabase/supabase-js` do `package.json`.
4. **Dados**: nessa etapa não há dados reais, então rollback é seguro.

## Próximos passos

1. Feature 003 — Ingestão de transcrições e geração de embeddings.
2. Feature 004 — Busca vetorial por similaridade.
3. Feature 005 — Conexão com provedor de IA para geração de respostas.
4. Feature 006 — Integração com WhatsApp.
5. Feature 007 — Integração com Kommo.
