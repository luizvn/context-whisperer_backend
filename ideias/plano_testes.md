# Plano Estratégico de Testes: Unitários e Integração

Este documento estabelece o planejamento detalhado para a implementação da suíte de testes unitários e de integração no backend do **Context-Whisperer**. O objetivo é garantir alta confiabilidade, prevenir regressões e facilitar a evolução contínua da arquitetura monorepo.

---

## 1. Objetivos e Metas de Cobertura

- **Meta de Cobertura Global:** Atingir **>= 80%** de cobertura de código em regras de negócio críticas (`Services`, `Repositories`, `Guards`, `LangGraph Nodes`).
- **Rapidez no Feedback:** Testes unitários executando em poucos segundos localmente.
- **Isolamento e Determinismo:** Testes sem dependência de serviços externos pagos (OpenAI) ou banco de dados de produção.

---

---

## 2. Estrutura de Diretórios de Testes (Isolamento de `src/`)

Para manter o código-fonte (`src/`) 100% livre de arquivos de teste e evitar poluição na compilação de produção, todos os testes residem no diretório dedicado `test/` de cada pacote:

```text
apps/api/
├── src/                          # 🟢 Apenas código de produção (ZERO arquivos .spec.ts)
│   ├── modules/
│   │   ├── auth/
│   │   └── users/
│   └── main.ts
│
└── test/                         # 🧪 Toda a suíte de testes da API
    ├── unit/                     # Testes Unitários (Mocks rápidos em memória)
    │   ├── auth/
    │   │   ├── auth.service.spec.ts
    │   │   ├── auth.resolver.spec.ts
    │   │   ├── jwt.strategy.spec.ts
    │   │   └── gql-auth.guard.spec.ts
    │   └── users/
    │       ├── user.service.spec.ts
    │       ├── user.repository.spec.ts
    │       └── user.resolver.spec.ts
    ├── integration/              # Testes de Integração (Resolvers + DB em memória)
    │   ├── auth.integration.spec.ts
    │   └── users.integration.spec.ts
    └── e2e/                      # Testes Ponta a Ponta
        └── app.e2e-spec.ts

packages/core/
├── src/                          # Apenas Schemas, DTOs e Tipagens
└── test/
    └── unit/                     # Testes dos Schemas Zod e DTOs
        └── proposed-scope.schema.spec.ts

apps/worker/
├── src/                          # 🟢 Apenas código de produção
│   ├── workflows/agents/
│   │   ├── nodes/
│   │   │   └── scope-agent.node.ts
│   │   ├── edges/
│   │   │   └── example.edge.ts
│   │   └── graph.ts
│   └── main.ts
└── test/                         # 🧪 Toda a suíte de testes do Worker
    └── unit/
        ├── nodes/
        │   └── scope-agent.node.spec.ts
        ├── edges/
        │   └── example.edge.spec.ts
        └── workflows/
            └── graph.spec.ts
```

---

## 3. Pirâmide de Testes no Context-Whisperer

```text
         / \
        /   \     E2E / Workflow Tests (~10%)
       / ----\    [Fluxo Completo: API -> Fila -> Worker -> Banco]
      /       \
     / --------\  Integration Tests (~30%)
    /           \ [GraphQL Resolvers, Fastify HTTP, Repositories + Mongo em memória]
   / ------------\
  /               \ Unit Tests (~60%)
 /_________________\ [Services, Repositories isolados, LangGraph Nodes, DTOs, Guards]
```

---

## 4. Escopo por Pacote / Aplicação

### 📦 `packages/core` (Testes de Schemas e DTOs)
- **O que testar:**
  - Validação de Schemas Zod (`ProposedScopeResponse`): garantir que inputs válidos passam e estruturas corrompidas de LLM disparam erros esperados.
  - Validação de DTOs do `class-validator` (`CreateProjectInput`, `SignupInput`, `LoginInput`).
- **Tecnologia:** Jest / TypeScript puro (execução ultrarrápida sem overhead de NestJS).

### 🗄️ `packages/database` (Testes de Integridade de Dados)
- **O que testar:**
  - Conexão e instanciação do `PrismaClient`.
  - Tipagem e integridade estrutural dos modelos.

### 🌐 `apps/api` (Camada Web, Regras de Negócio e Repositórios)

#### A. Testes Unitários (Mocks com `jest.fn()` ou `jest-mock-extended`):
1. **Módulo `auth`:**
   - [`AuthService`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/auth/auth.service.ts):
     - `validateUser`: Credenciais corretas retornam `UserModel` sem senha; senha incorreta ou usuário inexistente retorna `null`.
     - `login`: Gera token JWT válido e monta `AuthResponse` corretamente.
   - [`JwtStrategy`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/auth/strategies/jwt.strategy.ts): Validação de payload e lançamento de `UnauthorizedException` se usuário não for encontrado.
   - [`GqlAuthGuard`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/auth/guards/gql-auth.guard.ts): Extração correta da requisição no contexto GraphQL/Fastify.
2. **Módulo `users`:**
   - [`UsersService`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/users/user.service.ts):
     - `createUser`: Hasheia a senha com bcrypt (12 rounds) e persiste; lança `ConflictException` se e-mail já existir.
     - `findByEmail` / `findById`: Retorno correto de usuário ou `null`.
   - [`UserRepository`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/users/user.repository.ts): Chamadas corretas aos métodos do Prisma (`findUnique`, `create`).
3. **Módulo `requisitions`:**
   - [`RequisitionsService`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/requisitions/requisitions.service.ts):
     - `findById`: Retorna requisição ou lança `NotFoundException`.
     - `create`: Inicializa status como `AWAITING_SCOPE`.
     - `updateStatus`: Atualização correta de estado (`GENERATING`, `COMPLETED`, `FAILED`).
4. **Módulo `scope-proposals`:**
   - [`ScopeProposalService`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/scope-proposals/scope-proposal.service.ts):
     - `approve` / `reject`: Transições de status e armazenamento de feedback do usuário.
     - `buildMarkdownFromResponse`: Validação da formatação de saída Markdown estruturada a partir do DTO de escopo.
5. **Módulo `agents`:**
   - [`AgentsService`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/agents/agents.service.ts): Criação da requisição inicial e disparo do job no BullMQ com payload e `threadId` corretos.

#### B. Testes de Integração (API / GraphQL):
- **Ferramentas:** `supertest`, `mercurius`, `mongodb-memory-server` (banco MongoDB real em memória para testes).
- **Cenários:**
  - Mutation `signup` cria usuário no banco em memória e retorna JWT.
  - Mutation `login` com senha válida retorna token de autenticação.
  - Query `me` com cabeçalho `Authorization: Bearer <token>` retorna o usuário logado.
  - Mutation `createProject` enfileira o job e cria o registro de `Requisition`.

---

### ⚙️ `apps/worker` (Processamento Assíncrono, LangGraph e Agentes)

- **O que testar (Unitários em `apps/worker/test/unit/`):**
  - **Nós de Agentes (`nodes/scope-agent.node.spec.ts`):**
    - Mock do `ChatOpenAI` e `withStructuredOutput(ProposedScopeSchema)` para simular respostas do LLM sem gastar créditos.
    - Validação da conversão da resposta estruturada do LLM em Markdown formatado.
    - Persistência correta da `ScopeProposal` via `prisma.scopeProposal.create`.
    - Atualização do status da `Requisition` para `AWAITING_SCOPE`.
    - Emissão de mensagem no canal Redis Pub/Sub (`USER_EVENTS_${userId}`).
    - Retorno correto do estado com a nova `AIMessage` e `scopeProposalId`.
  - **Roteamento Condicional (`edges/example.edge.spec.ts`):**
    - Validação de regras de transição de nós com base no histórico de mensagens ou status do fluxo (`'__end__'` vs `'exampleNode'`).
  - **Construção do Grafo (`workflows/graph.spec.ts`):**
    - Instanciação correta do `StateGraph(GraphState)` com `MongoDBSaver` checkpointer.

---

## 4. Ferramentas e Infraestrutura de Testes

| Categoria | Ferramenta | Justificativa |
| :--- | :--- | :--- |
| **Test Runner** | `Jest` + `ts-jest` / `@swc/jest` | Padrão robusto do ecossistema NestJS com suporte a decorators e TypeScript. |
| **Banco em Memória** | `mongodb-memory-server` | Permite testes de integração com Prisma contra um MongoDB real em memória (sem precisar subir Docker). |
| **Mocking de Filas** | `ioredis-mock` / BullMQ test utils | Testa enfileiramento e consumo sem necessidade de instância Redis ativa. |
| **Asserções & Spies** | `jest.spyOn()` e `expect` | Verificação de chamadas, argumentos e exceções. |
| **Requisições HTTP/GraphQL** | `supertest` | Testes de integração de ponta a ponta na API Fastify. |

---

## 5. Roteiro de Execução (Fases de Implementação)

### 📌 Fase 1: Setup e Testes Unitários de Módulos Base (Auth & Users)
- [x] Configurar scripts de teste no `package.json` raiz e de cada pacote (`test`, `test:unit`, `test:integration`, `test:cov`).
- [x] Criar testes unitários para `UserRepository`, `UsersService` e `UserResolver` em `apps/api/test/unit/users/`.
- [x] Criar testes unitários para `AuthService`, `AuthResolver`, `JwtStrategy` e `GqlAuthGuard` em `apps/api/test/unit/auth/`.
- [x] Validação: 7 test suites, 28 testes passando com 100% de cobertura nos serviços e repositórios de Auth e Users.

### 📌 Fase 2: Testes Unitários de Domínio da API e Core
- [x] Criar testes para os Schemas e DTOs em `packages/core/test/unit/`.
- [x] Criar testes para `RequisitionsService` e `RequisitionRepository` em `apps/api/test/unit/requisitions/`.
- [x] Criar testes para `ScopeProposalService` e `ScopeProposalRepository` em `apps/api/test/unit/scope-proposals/`.
- [x] Criar testes para `AgentsService` e `AgentsResolver` em `apps/api/test/unit/agents/`.
- [x] Ajustar o `apps/worker` com MongoDB Checkpointer (`MongoDBSaver`), pipelines de build e lint (`tsconfig.json`, `eslint.config.mjs`) e ciclo de vida de requisições.
- [x] Validação: 14 test suites, 60 testes passando no monorepo (100% de sucesso).

### 📌 Fase 3: Testes Unitários do Worker (LangGraph & IA)
- [x] Configurar Jest e scripts de teste no `apps/worker/package.json` (`test`, `test:unit`, `test:cov`).
- [x] Criar testes unitários para `nodes/scope-agent.node.spec.ts` (Mock de ChatOpenAI, Prisma e Redis PubSub).
- [x] Criar testes unitários para `edges/example.edge.spec.ts` (Roteamento condicional de arestas).
- [x] Criar testes unitários para `workflows/graph.spec.ts` (Compilação do StateGraph com MongoDBSaver).
- [x] Validação: 3 test suites, 5 testes passando com 100% de cobertura nos nós e arestas do Worker.

### 📌 Fase 4: Testes de Integração com Fastify e Mercurius GraphQL
- [x] Configurar ambiente de testes de integração com `FastifyAdapter` e `MercuriusDriver` (`apps/api/test/integration/`).
- [x] Criar suíte de testes de integração do GraphQL para o fluxo de Auth e Usuários (`signup`, `login`, `me`).
- [x] Criar suíte de testes de integração do GraphQL para o fluxo de Agentes e Requisições (`createProject`, enfileiramento no BullMQ).
- [x] Validação: 2 test suites, 5 testes de integração passando (100% de sucesso via HTTP injection).

### 📌 Fase 5: Testes de Integração de Fluxo Assíncrono (API ➔ BullMQ ➔ Worker)
- [x] Extrair lógica de consumo de jobs em processador modular (`generation.processor.ts`).
- [x] Criar testes unitários para o processador de geração (`generation.processor.spec.ts`).
- [x] Criar testes de integração de ponta a ponta para o ciclo assíncrono completo (`async-flow.integration.spec.ts`):
  - Transição de status da requisição (`GENERATING` ➔ `AWAITING_SCOPE`).
  - Execução estruturada do nó LangGraph sem custo de API OpenAI.
  - Persistência da `ScopeProposal` em Markdown.
  - Emissão de evento de notificação em tempo real via Redis Pub/Sub (`USER_EVENTS_${userId}`).
- [x] Configurar script raiz `pnpm run test:integration` e `pnpm run test:all`.
- [x] Validação: 1 test suite adicional no worker, 100% de testes passando no monorepo.
