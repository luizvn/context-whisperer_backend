# Context-Whisperer Backend

Este é o backend do projeto Context-whisperer, desenvolvido em NestJS utilizando a plataforma Fastify. O sistema é projetado para atuar como um assistente de contexto que utiliza IA (OpenAI) para gerar especificações de software, requisitos, diagramas UML e outros artefatos técnicos a partir de descrições simples de projetos.

## 🚀 Tecnologias e Arquitetura

- **Framework:** [NestJS](https://nestjs.com/) (com Fastify)
- **API:**
  - **GraphQL:** Apollo Server (Abordagem Code-First) - Endpoint: `/api/graphql`
  - **REST/Swagger:** Documentação automática - Endpoint: `/api`
- **Banco de Dados:** [PostgreSQL](https://www.postgresql.org/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/) com driver `postgres.js`
- **Autenticação:** JWT (Passport)
- **IA:** OpenAI (GPT-4) e LangChain
- **Estilização/Ferramentas:** TypeScript, pnpm, ESLint, Prettier, Jest

## 📂 Estrutura do Projeto

- `src/main.ts`: Ponto de entrada da aplicação (configuração Fastify, ValidationPipe, Swagger).
- `src/app.module.ts`: Módulo raiz que orquestra as dependências globais.
- `src/agents/`: Lógica central de IA para geração de artefatos UML e especificações de software.
  - `prompts/`: Contém templates de prompts complexos para a IA.
- `src/modules/`: Módulos de domínio da aplicação.
  - `auth/`: Autenticação e estratégias JWT.
  - `users/`: Gestão de usuários e permissões.
  - `artifacts/`, `requisitions/`, `scope-proposals/`, `templates/`: Módulos para gerenciamento de fluxo de trabalho de geração de contexto.
- `src/config/`: Configurações de banco de dados, GraphQL e scripts de migração.
- `src/openai/`: Serviço encapsulado para interação com as APIs da OpenAI.
- `drizzle/`: Migrações geradas pelo Drizzle ORM.

## 🛠️ Comandos Principais

### Desenvolvimento
- `pnpm install`: Instala as dependências.
- `pnpm run start:dev`: Inicia o servidor em modo watch.
- `pnpm run lint`: Executa o linter e aplica correções automáticas.
- `pnpm run format`: Formata o código com Prettier.

### Banco de Dados (Drizzle)
- `pnpm run db:generate`: Gera novas migrações a partir das mudanças nos schemas.
- `pnpm run db:migrate`: Aplica as migrações ao banco de dados.
- `pnpm run db:push`: Empurra as mudanças do schema diretamente para o banco (útil em desenvolvimento local).
- `pnpm run db:studio`: Abre a interface visual do Drizzle para explorar o banco.

### Testes
- `pnpm test`: Executa testes unitários.
- `pnpm run test:e2e`: Executa testes de ponta a ponta.

## 📜 Convenções de Desenvolvimento

- **Drizzle Schemas:** Defina as tabelas do banco de dados em arquivos `*.schema.ts` dentro dos módulos (ex: `user.schema.ts`).
- **GraphQL Models:** Defina os Object Types do GraphQL em arquivos `*.model.ts` utilizando os decoradores `@ObjectType()` e `@Field()` do `@nestjs/graphql`.
- **Validação:** Utilize `class-validator` nos DTOs. O `ValidationPipe` global está configurado para `whitelist: true` e `forbidNonWhitelisted: true`.
- **Injeção de Dependência:** O banco de dados é injetado via token `DATABASE_CONNECTION`.
- **Prompt Engineering:** Novos prompts para o assistente de IA devem ser armazenados em `src/agents/prompts/` como arquivos `.txt`.

## ⚠️ Observações Importantes

- **Variáveis de Ambiente:** O projeto requer `DATABASE_URL`, `JWT_SECRET` e `OPENAI_API_KEY`. Consulte `.env.example`.
- **Módulos Comentados:** Note que no `AppModule`, os módulos `AgentsModule` e `OpenAIModule` podem estar comentados dependendo do estado atual do desenvolvimento. Descomente-os se precisar utilizar as funcionalidades de IA.
- **Fastify:** Como o projeto usa Fastify em vez de Express, evite utilizar middlewares ou plugins específicos de Express sem o adaptador correspondente.
