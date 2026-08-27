# Arquitetura do Monorepo: Context-Whisperer

Este documento descreve detalhadamente a estrutura, padrões de projeto e decisões técnicas consolidadas após a refatoração do backend do **Context-Whisperer** para um **Monorepo PNPM**.

---

## 1. Visão Geral da Estrutura

O repositório foi transformado de uma aplicação monolítica para uma arquitetura de **Monorepo** gerenciada por `pnpm workspaces`. Isso viabiliza o desacoplamento de responsabilidades, o compartilhamento eficiente de código e a escalabilidade independente de cada serviço.

```text
context-whisperer_backend/
├── apps/
│   ├── api/                     # API Principal (NestJS + Fastify + GraphQL)
│   └── worker/                  # Processador de Tarefas em Background (BullMQ + LangGraph)
├── packages/
│   ├── core/                    # DTOs, Schemas Zod, Interfaces e Tipos Compartilhados
│   └── database/                # Schema Prisma, Migrações e Singleton do PrismaClient
├── ideias/                      # Documentação técnica e planejamento arquitetural
├── docker-compose.yml           # Serviços locais (MongoDB, Redis)
├── package.json                 # Scripts raiz do monorepo
├── pnpm-workspace.yaml          # Definição dos workspaces e dependências compiladas
└── tsconfig.json                # Configuração base do TypeScript
```

---

## 2. Divisão de Responsabilidades

### 🌐 `apps/api` (Web API Server)
- **Tecnologias:** NestJS, Fastify, Mercurius GraphQL (Apollo Code-First), Passport JWT.
- **Função:** Atuar como gateway rápido de I/O para o front-end:
  - Autenticação e gestão de usuários.
  - CRUD e consultas de requisições, templates e artefatos.
  - Validação de entrada via DTOs (`class-validator`).
  - Enfileiramento de jobs assíncronos via **BullMQ Producer** (não executa IA diretamente).
- **Desacoplamento:** Não contém lógicas pesadas de LLM bloqueantes no event loop.

### ⚙️ `apps/worker` (Background Worker Service)
- **Tecnologias:** BullMQ Consumer, LangGraph, LangChain, OpenAI API.
- **Função:** Processamento assíncrono e resiliente:
  - Consumo de jobs da fila `ai-generation`.
  - Execução de grafos de agentes com LangGraph (ex: `ScopeAgentNode`).
  - Chamadas para OpenAI com controle de retries, rate limits e fallback.
  - Persistência dos resultados parciais e finais no banco de dados.

### 📦 `packages/core` (Shared Contracts & Domain Types)
- **Tecnologias:** TypeScript Puro, Zod, Class-Validator.
- **Função:** Contratos de comunicação e schemas compartilhados:
  - Interfaces de estado do LangGraph (`AgentState`).
  - Schemas de validação e respostas estruturadas de IA (`ProposedScopeResponse`).
  - DTOs de entrada comuns (`CreateProjectInput`, `JobQueuedResponse`).
  - Enums universais (`ArtifactType`).

### 🗄️ `packages/database` (Data Access Layer)
- **Tecnologias:** Prisma ORM, MongoDB.
- **Função:** Única fonte da verdade para persistência:
  - Arquivo `schema.prisma` com os modelos (`User`, `Requisition`, `ScopeProposal`, `Template`, `Artifact`).
  - Exportação de instância Singleton do `prisma`.
  - Exportação de todas as tipagens geradas pelo Prisma Client.

---

## 3. Padrões de Projeto e Boas Práticas

### 🏛️ Padrão Repository (Data Mapper)
Para evitar o acoplamento direto dos Services ao Prisma, introduzimos a camada de repositórios em cada módulo:
- Exemplo: `UserRepository`, `RequisitionRepository`, `ScopeProposalRepository`.
- **Benefícios:**
  1. **Testabilidade:** Permite criar testes unitários para Services mockando facilmente os Repositories via injeção de dependência do NestJS.
  2. **Isolamento:** Regras de negócio ficam nos Services; queries e manipulações de persistência ficam nos Repositories.
  3. **Manutenibilidade:** Mudanças de ORM ou queries não afetam a camada de negócio.

### 🏷️ Convenção de Nomenclatura (`*Model` vs Database Types)
Para evitar conflito de identificadores e tipagens complexas:
- **Entidades de Banco (`packages/database`):** Exportam os tipos nativos do Prisma (`User`, `Requisition`, `ScopeProposal`).
- **Modelos GraphQL (`apps/api`):** Usam a terminação `*Model` (ex: `UserModel`, `RequisitionModel`, `ScopeProposalModel`) decorados com `@ObjectType()` e `@Field()`.
- **Vantagem:** Clareza imediata sobre se um tipo pertence à camada pública GraphQL ou à camada interna de banco de dados.

---

## 4. Gestão de Build, Lint e Monorepo

- **PNPM Workspaces:** Pacotes internos são consumidos via referências de workspace sem necessidade de publicação externa.
- **`onlyBuiltDependencies`:** Centralizado no `pnpm-workspace.yaml` para autorizar compilações nativas de pacotes como `@prisma/client`, `@swc/core`, `bcrypt` e `prisma`.
- **ESLint & TypeScript Type-Checking:**
  - Flat Config (`eslint.config.mjs`) com `recommendedTypeChecked`.
  - 100% dos métodos possuem declaração explícita de tipos de retorno (`Promise<T>`).
  - 0 erros e 0 warnings no comando `pnpm run lint`.
- **Compilação Rápida:** Transpilação via SWC no NestJS (`apps/api`) garantindo builds em menos de 1 segundo.

---

## 5. Scripts Principais na Raiz

| Comando | Descrição |
| :--- | :--- |
| `pnpm install` | Instala e resolve dependências em todos os workspaces. |
| `pnpm build` | Compila os packages compartilhados e as aplicações NestJS. |
| `pnpm run lint` | Executa o linter com checagem estrita de tipos em todo o monorepo. |
| `pnpm run start:dev:api` | Inicia o servidor HTTP/GraphQL da API em modo watch. |
| `pnpm run start:dev:worker` | Inicia o Worker consumidor de filas BullMQ em modo watch. |
| `pnpm run db:generate` | Gera o Prisma Client com base no `schema.prisma`. |
| `pnpm run db:push` | Sincroniza o schema diretamente com o MongoDB. |
