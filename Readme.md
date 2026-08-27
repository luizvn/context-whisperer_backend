# Context-Whisperer Backend (Monorepo)

Backend do ecossistema **Context-Whisperer**, estruturado como um monorepo moderno com `pnpm workspaces`. O sistema atua como um copiloto de engenharia e contexto técnico, utilizando Inteligência Artificial (OpenAI, LangGraph e LangChain) para gerar especificações de software, propostas de escopo, diagramas UML e artefatos técnicos a partir de ideias de projetos.

---

## 🚀 Tecnologias e Arquitetura

- **Gerenciador de Monorepo:** [pnpm Workspaces](https://pnpm.io/workspaces)
- **Framework Web:** [NestJS](https://nestjs.com/) com plataforma [Fastify](https://fastify.dev/) (alta performance)
- **API & Comunicação:**
  - **GraphQL:** Mercurius / Apollo Code-First (Endpoint: `/api/graphql`)
  - **Notificações em Tempo Real:** Redis Pub/Sub integrado a GraphQL Subscriptions
- **Banco de Dados & ORM:**
  - **Banco:** [MongoDB](https://www.mongodb.com/)
  - **ORM:** [Prisma ORM](https://www.prisma.io/) com padrão *Repository Pattern*
- **Processamento Assíncrono:** [BullMQ](https://docs.bullmq.io/) apoiado por Redis
- **IA & Orquestração de Agentes:**
  - [OpenAI](https://openai.com/) (GPT-4 / GPT-4o)
  - [LangChain](https://js.langchain.com/) & [LangGraph](https://langchain-ai.github.io/langgraphjs/)
  - Checkpointer de estado em memória e persistência via `@langchain/langgraph-checkpoint-mongodb` (`MongoDBSaver`)
- **Autenticação:** JWT (Passport JWT Strategy + Bcrypt + Guards GraphQL)
- **Qualidade & Tipagem:** TypeScript 5, ESLint 9 (Flat Config com type-checking estrito), Prettier, Jest

---

## 📂 Estrutura do Monorepo

```text
context-whisperer_backend/
├── apps/
│   ├── api/                      # Gateway Web NestJS (Fastify + GraphQL + Auth + BullMQ Producer)
│   │   ├── src/                  # 100% código de produção da API
│   │   └── test/                 # Suítes de testes unitários e de integração (GraphQL)
│   └── worker/                   # Serviço Worker (BullMQ Consumer + LangGraph + OpenAI)
│       ├── src/                  # Workflows de IA, nós, edges e processadores
│       └── test/                 # Suítes de testes unitários e de fluxo assíncrono
│
├── packages/
│   ├── core/                     # Contratos compartilhados, DTOs, Enums e Schemas Zod
│   │   ├── src/
│   │   └── test/                 # Testes de validação de schemas
│   └── database/                 # Schema Prisma, Migrações e Singleton do PrismaClient
│
├── ideias/                       # Documentação técnica, arquitetura e planejamento de testes
└── docker-compose.yml            # Serviços locais (MongoDB com Replica Set, Redis)
```

---

## ⚙️ Pré-requisitos e Configuração

### 1. Requisitos
- **Node.js** 20+
- **pnpm** 9+ (recomendado: `corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker & Docker Compose** (para instâncias locais do MongoDB e Redis)

### 2. Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com base no modelo abaixo:

```env
# Banco de Dados (MongoDB Replica Set)
DATABASE_URL="mongodb://localhost:27017/context_whisperer?replicaSet=rs0&directConnection=true"
MONGODB_DB_NAME="context_whisperer"

# Autenticação
JWT_SECRET="seu-segredo-jwt-super-seguro"

# Redis & Filas
REDIS_URL="redis://localhost:6379"

# OpenAI & IA
OPENAI_API_KEY="sk-proj-..."
OPENAI_MODEL="gpt-4o-mini"

# Servidor API
PORT=3000
NODE_ENV="development"
```

---

## 🛠️ Instalação e Inicialização

### 1. Iniciar Serviços de Infraestrutura (Docker)
```bash
docker compose up -d
```

### 2. Instalar Dependências e Sincronizar Banco
```bash
# Instala as dependências de todos os workspaces
pnpm install

# Gera o cliente do Prisma e sincroniza as collections com o MongoDB
pnpm run db:push
```

### 3. Executar as Aplicações em Desenvolvimento
Abra dois terminais (ou execute em paralelo):

```bash
# Terminal 1: Iniciar API NestJS (Fastify + GraphQL)
pnpm run start:dev:api

# Terminal 2: Iniciar Worker de Agentes IA (BullMQ Consumer + LangGraph)
pnpm run start:dev:worker
```

---

## 🌐 Endpoints e Acesso

- **GraphQL Playground / Ide:** `http://localhost:3000/api/graphql`
- **Exemplo de Mutation (`signup`):**
  ```graphql
  mutation {
    signup(signupInput: {
      name: "Dev User",
      email: "dev@example.com",
      password: "password123"
    }) {
      accessToken
      user {
        id
        email
      }
    }
  }
  ```
- **Exemplo de Criação de Projeto (`createProject`):**
  ```graphql
  mutation {
    createProject(input: {
      name: "SaaS Task Manager",
      prompt: "Criar uma plataforma de tarefas com priorização inteligente por IA",
      artifacts: [REQUIREMENTS, ARCHITECTURE_DOC, UML_DIAGRAM]
    }) {
      jobId
      status
      requisitionId
    }
  }
  ```

---

## 🧪 Pirâmide de Testes e Qualidade

O projeto possui **100% de cobertura nos fluxos críticos** com testes unitários, testes de integração GraphQL e testes de ciclo de vida assíncrono.

```bash
# Executa todos os testes unitários em paralelo no monorepo
pnpm run test

# Executa as suítes de integração (GraphQL Fastify + Worker Flow)
pnpm run test:integration

# Executa a suíte de testes completa (Unitários + Integração)
pnpm run test:all

# Executa o Linter com checagem de tipos estrita em todos os pacotes
pnpm run lint

# Compila todos os pacotes e aplicações
pnpm run build
```

---

## 📜 Convenções de Código

- **Isolamento de Testes:** Todo código de teste reside no diretório `test/` de cada pacote, mantendo `src/` 100% livre para build de produção.
- **Repository Pattern:** Todas as operações de banco de dados no `apps/api` são encapsuladas em classes `*.repository.ts` injetadas nos `*.service.ts`.
- **GraphQL Models:** Tipos GraphQL são declarados em arquivos `*.model.ts` com sufixo `*Model` decorados com `@ObjectType()` e `@Field()`.
- **Contratos no Core:** DTOs e Schemas Zod residem no `@context-whisperer/core`.
- **Worker LangGraph:** Grafos e nós residem no `apps/worker` e utilizam `MongoDBSaver` para checkpoint de threads.

---

## 📚 Documentação Técnica Adicional

Consulte o diretório [`ideias/`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/ideias/) para histórico de decisões arquiteturais e planejamento:
- [`plano_testes.md`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/ideias/plano_testes.md) - Detalhamento completo e status da suíte de testes.
- [`arquitetura_monorepo.md`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/ideias/arquitetura_monorepo.md) - Arquitetura detalhada do monorepo e serviços.
- [`migracao_mongodb_prisma.md`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/ideias/migracao_mongodb_prisma.md) - Registro da migração para MongoDB e Prisma.
