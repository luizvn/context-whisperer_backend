# Context-Whisperer Backend (Monorepo)

Este é o backend do projeto **Context-Whisperer**, estruturado como um monorepo PNPM. O sistema é projetado para atuar como um assistente de contexto que utiliza IA (OpenAI, LangGraph e LangChain) para gerar especificações de software, requisitos, diagramas UML e artefatos técnicos a partir de descrições de projetos.

## 🚀 Tecnologias e Arquitetura

- **Arquitetura:** Monorepo com `pnpm workspaces`
- **Framework Web:** [NestJS](https://nestjs.com/) (com plataforma Fastify)
- **API:**
  - **GraphQL:** Mercurius / Apollo Code-First - Endpoint: `/api/graphql`
- **Banco de Dados:** [MongoDB](https://www.mongodb.com/)
- **ORM:** [Prisma ORM](https://www.prisma.io/) (com padrão Repository)
- **Processamento Assíncrono:** [BullMQ](https://docs.bullmq.io/) apoiado por Redis
- **Autenticação:** JWT (Passport)
- **IA & Agentes:** OpenAI (GPT-4), LangChain e LangGraph
- **Ferramentas:** TypeScript, pnpm, ESLint (Flat Config com type-checking), SWC, Jest

## 📂 Estrutura do Monorepo

```text
context-whisperer_backend/
├── apps/
│   ├── api/                     # Gateway Web NestJS (Fastify + GraphQL + Auth + BullMQ Producer)
│   └── worker/                  # Serviço Worker (BullMQ Consumer + LangGraph + OpenAI)
├── packages/
│   ├── core/                    # DTOs, Schemas Zod, Enums e Tipagens Compartilhadas
│   └── database/                # Schema Prisma, Migrações e Singleton do PrismaClient
├── ideias/                      # Documentação técnica, arquitetura e plano de testes
└── docker-compose.yml           # Serviços locais (MongoDB, Redis)
```

## 🛠️ Comandos Principais

### Desenvolvimento
- `pnpm install`: Instala as dependências de todos os workspaces.
- `pnpm run build`: Compila os pacotes compartilhados e as aplicações.
- `pnpm run start:dev:api`: Inicia a API NestJS em modo watch.
- `pnpm run start:dev:worker`: Inicia o Worker em modo watch.
- `pnpm run lint`: Executa o linter com checagem de tipos em todo o monorepo.

### Banco de Dados (Prisma)
- `pnpm run db:generate`: Gera o Prisma Client com base no `schema.prisma`.
- `pnpm run db:push`: Sincroniza o schema diretamente com o MongoDB.
- `pnpm run db:studio`: Abre a interface visual do Prisma Studio.

### Testes
- `pnpm test`: Executa testes unitários.
- `pnpm run test:e2e`: Executa testes de integração e ponta a ponta.

## 📜 Convenções de Desenvolvimento

- **Prisma & Repositories:** Todas as operações de banco de dados devem ser encapsuladas em classes `*.repository.ts` dentro de cada módulo, injetadas via DI nos `*.service.ts`.
- **GraphQL Models:** Defina os Object Types do GraphQL em arquivos `*.model.ts` com sufixo `*Model` (ex: `UserModel`, `RequisitionModel`, `ScopeProposalModel`) decorados com `@ObjectType()` e `@Field()`.
- **Tipagem Estrita:** Sempre declare explicitamente os tipos de retorno em funções e métodos assíncronos (`Promise<T>`).
- **Validação:** Utilize `class-validator` nos DTOs e Schemas `Zod` no `packages/core`.
- **Documentação Técnica:** Consulte o diretório `ideias/` para histórico e planejamento arquitetural.

## ⚠️ Observações Importantes

- **Variáveis de Ambiente:** O projeto requer `DATABASE_URL`, `JWT_SECRET` e `OPENAI_API_KEY`. Consulte `.env.example`.
- **Fastify:** Como o projeto usa Fastify em vez de Express, evite utilizar middlewares ou plugins específicos de Express sem o adaptador correspondente.
