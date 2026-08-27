# Planejamento: Migração para MongoDB + Prisma

## 1. Objetivo
Substituir o PostgreSQL e Drizzle ORM pelo MongoDB e Prisma, aproveitando a natureza orientada a documentos (NoSQL) para armazenar saídas não estruturadas de IA (artefatos, escopos) de forma mais coesa e otimizada, melhorando a escalabilidade do projeto e o valor do currículo do desenvolvedor.

## 2. Remodelagem dos Schemas (NoSQL Mindset)
No PostgreSQL, os dados estavam altamente normalizados em tabelas separadas (`users`, `requisitions`, `scope_proposals`, `artifacts`). No MongoDB, a abordagem de melhor performance para dados que são lidos juntos é utilizar **Documentos Embutidos (Embedded Documents)**, tratando a `Requisition` como o **Aggregate Root**.

### Proposta de Schema Prisma Refinada (`schema.prisma`)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(auto()) @map("_id") @db.ObjectId
  name         String
  email        String        @unique
  password     String
  role         String        @default("user")
  requisitions Requisition[]
  
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Template {
  id             String          @id @default(auto()) @map("_id") @db.ObjectId
  name           String
  description    String?
  content        String          // O prompt/template em si
  
  artifacts      Artifact[]
  scopeProposals ScopeProposal[]
  
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model Requisition {
  id             String          @id @default(auto()) @map("_id") @db.ObjectId
  userId         String          @db.ObjectId
  user           User            @relation(fields: [userId], references: [id])
  originalPrompt String
  status         String          @default("AWAITING_SCOPE")
  
  scopeProposals ScopeProposal[]
  artifacts      Artifact[]
  
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model ScopeProposal {
  id             String       @id @default(auto()) @map("_id") @db.ObjectId
  requisitionId  String       @db.ObjectId
  requisition    Requisition  @relation(fields: [requisitionId], references: [id])
  templateId     String       @db.ObjectId
  template       Template     @relation(fields: [templateId], references: [id])
  
  contentMd      String
  status         String       @default("PENDING") // PENDING, APPROVED, REJECTED
  userFeedback   String?
  
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

model Artifact {
  id               String       @id @default(auto()) @map("_id") @db.ObjectId
  requisitionId    String       @db.ObjectId
  requisition      Requisition  @relation(fields: [requisitionId], references: [id])
  templateId       String       @db.ObjectId
  template         Template     @relation(fields: [templateId], references: [id])
  
  artifactType     String
  fileName         String
  generatedContent String?
  status           String       @default("DRAFT")
  iterationCount   Int          @default(0)
  
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
}
```

**Por que voltamos para Coleções Separadas (Models)?**
Dado que haverá a necessidade de atuar diretamente em cima de um Artefato ou Proposta (como rotas `PATCH /artifacts/:id/rate` para avaliar ou `GET /artifacts/:id/download`), embuti-los em um array dentro de `Requisition` dificultaria muito as atualizações parciais e o roteamento. O Prisma não suporta o decorador `@id` em tipos embutidos (Composite Types). Portanto, mantê-los como coleções separadas (Models) oferece a flexibilidade do MongoDB (textos pesados e mutáveis) sem perder a capacidade de consultar entidades individualmente.

## 3. Plano de Tarefas (Checklist de Execução)

- [x] **Passo 1: Instalação e Configuração Básica**
  - Atualizar o `docker-compose.yml` para remover o Postgres e subir o MongoDB (com replica set simples exigido pelo Prisma).
  - Inicializar o Prisma (`npx prisma init`) na pasta `packages/database`.
- [x] **Passo 2: Definição e Remoção de Lixo**
  - Configurar o `schema.prisma` conforme definido acima.
  - Remover os arquivos `.schema.ts` antigos do Drizzle e desinstalar pacotes SQL.
- [x] **Passo 3: Exportação do Banco**
  - Gerar o Prisma Client (`npx prisma generate`).
  - Exportar uma instância Singleton do PrismaClient no `packages/database/src/index.ts`.
- [x] **Passo 4: Padrão Repository e Refatoração**
  - **Criação de Repositories:** Para cada módulo da API (Users, Requisitions, ScopeProposals, Artifacts, Templates), criado um arquivo `.repository.ts` abstraindo o `PrismaClient`.
  - Implementados os métodos padrão usando a sintaxe do Prisma (`findUnique`, `create`, `update`).
  - Refatorados todos os Services para injetar e utilizar os Repositories.

## 4. Próximos Passos
- Implementar a suíte de testes unitários e de integração conforme planejado em [**`plano_testes.md`**](./plano_testes.md).
