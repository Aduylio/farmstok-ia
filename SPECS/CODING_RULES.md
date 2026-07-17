# Regras de desenvolvimento

## TypeScript

- Usar TypeScript em modo strict.
- Não utilizar `any`.
- Não utilizar `@ts-ignore`.
- Não desativar regras do compilador para ocultar erros.
- Tipar entradas e retornos das regras de negócio.
- Utilizar `unknown` quando o tipo realmente for desconhecido.
- Validar dados externos com Zod.

## Imports

- O projeto utiliza módulos ESM.
- Imports relativos devem utilizar extensão `.js`.
- Não alterar `"type": "module"` no package.json.
- Não trocar NodeNext sem decisão arquitetural documentada.

Exemplo:

```ts
import { buildApp } from './app.js';