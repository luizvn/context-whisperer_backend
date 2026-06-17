# Backend do projeto Context-whisperer

Este repositório contém o backend em NestJS para o projeto Context-whisperer.

## Requisitos

- Node.js 20+ (ou compatível com o projeto)
- npm
- PostgreSQL
- Variáveis de ambiente:
  - `DATABASE_URL` (por exemplo: `postgresql://postgres:senha@localhost:5432/context_whisperer`)
  - `JWT_SECRET` (chave usada para assinar tokens JWT)

## Instalação

1. Instale as dependências:

```bash
npm install
```

2. Configure o banco de dados PostgreSQL e a variável `DATABASE_URL`.

## Banco de dados

O projeto usa Drizzle ORM. Para criar ou aplicar migrações:

```bash
npm run db:migrate
```

Se precisar gerar novas migrações a partir dos schemas:

```bash
npm run db:generate
```

## Executando a aplicação

### Modo de desenvolvimento

```bash
npm run start:dev
```

## Executando a api de documentação: 

Entre no navegador após rodar o comando anterior e coloque o seguinte trecho:

```
http://localhost:3000/api/graphql
```

Para testar a geração de artefatos do módulo de agente gerador de MVP, teste a rota:

`/agents/uml`

### Compilando e executando em produção

```bash
npm run build
npm run start:prod
```

## GraphQL

O servidor expõe uma API GraphQL em:

```
http://localhost:3000/api/graphql
```

Use o playground em desenvolvimento para testar as mutações de login e registro.

## Ponto de entrada

O ponto de entrada principal está em `src/main.ts` na função `bootstrap()`.

## Observações

- O módulo de autenticação utiliza JWT.
- Certifique-se de definir `JWT_SECRET` antes de iniciar a aplicação em qualquer ambiente que não seja de desenvolvimento.
- A tabela `users` inclui campos de senha hashed e `role` para suporte a autorização.
