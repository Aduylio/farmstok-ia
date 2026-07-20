# Arquitetura

## Fluxo principal planejado

Aluno no WhatsApp
→ WhatsApp Cloud API
→ Backend Farmstok AI
→ Supabase
→ Busca na base de conhecimento
→ Provedor de inteligência artificial
→ Resposta ao aluno

## Stack principal

- Node.js
- TypeScript
- Fastify
- Zod
- Supabase
- PostgreSQL
- pgvector
- Vitest
- Pino
- Docker

## Princípios arquiteturais

- Backend modular.
- TypeScript em modo strict.
- Separação entre rotas, serviços e repositórios.
- Validação de entradas e saídas.
- Dependências externas isoladas.
- Código testável sem iniciar servidor em porta real.
- Sem lógica de negócio diretamente nas rotas.
- Sem integração prematura com WhatsApp ou Kommo.
- A aplicação deve funcionar primeiro como API independente.

## Organização inicial

src/
├── config/
│   └── env.ts
├── modules/
│   └── knowledge/
│       ├── knowledge.routes.ts
│       ├── knowledge.schemas.ts
│       └── knowledge.service.ts
├── app.ts
└── server.ts

## Responsabilidades

### app.ts

Monta a aplicação, registra plugins e rotas.

### server.ts

Inicia o servidor HTTP.

### config/

Centraliza configurações e variáveis de ambiente.

### modules/

Agrupa funcionalidades por domínio.

### routes

Recebem requisições, validam dados e chamam serviços.

### services

Contêm regras de negócio.

### repositories

Serão responsáveis pelo acesso ao banco de dados.

## Decisões do MVP

- Não utilizar n8n no núcleo.
- Não utilizar banco vetorial externo.
- Usar PostgreSQL com pgvector.
- Não conectar WhatsApp antes do núcleo de conhecimento funcionar.
- Não conectar Kommo antes do fluxo principal estar testado.
- Não criar módulos vazios sem necessidade imediata.

## Persistência atual

- Prisma ORM 7 acessa o PostgreSQL por meio de `@prisma/adapter-pg`.
- `src/config/env.ts` valida `DATABASE_URL` e `src/config/prisma.ts` centraliza o Prisma Client.
- O schema usa UUID nativo, nomes camelCase no Prisma e snake_case no PostgreSQL.
- Migrations são versionadas em `prisma/migrations/`; migrations aplicadas são imutáveis.
- `scripts/db-check.ts` executa somente `SELECT 1` para validar a conexão e sempre encerra o client.
- pgvector e integrações externas permanecem fora da implementação atual.
