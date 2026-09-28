# Planejamento Arquitetural: Persistência de `Requisition.name` & Investigação de Uso no Ecossistema

## 🎯 Descrição do Problema

Ao submeter a mutation GraphQL `createProject`, o usuário envia os seguintes parâmetros através do DTO `CreateProjectInput`:
```graphql
input CreateProjectInput {
  name: String!
  prompt: String!
  artifacts: [ArtifactType!]!
}
```

No entanto, no método [`AgentsService.executeWorkflow`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/agents/agents.service.ts), apenas os campos `prompt`, `user.id` e `threadId` eram repassados para `RequisitionsService.create(...)`. O campo `name` era descartado e não era persistido na collection `Requisition` do MongoDB.

### Consequências Identificadas:
1. **Nomeação Genérica de Arquivos:** O arquivo `.zip` gerado pela API não utilizava o nome do projeto, recorrendo ao identificador hexadecimal (`specs-[id].zip`), dificultando a identificação imediata do arquivo na pasta de downloads do desenvolvedor.
2. **Perda de Identidade do Projeto:** O banco de dados não armazenava a identificação nominal do projeto.
3. **Limitação na Apresentação no Frontend:** O [`RequisitionModel`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/requisitions/requisition.model.ts) do GraphQL não expunha o campo `name`, forçando a interface a exibir prompts longos ou IDs para identificar os projetos do usuário.

---

## 🔍 Investigação: Onde o `name` tem e terá uso no Ecossistema?

Uma análise em todos os módulos e pacotes do monorepo (`apps/api`, `apps/worker`, `packages/core`, `packages/database`) identificou **6 áreas de alto impacto** para a utilização de `name`:

### 1. Nomeação Inteligente do Arquivo ZIP (`ArtifactsService`)
- Em vez de um nome estático e opaco como `specs-d09ae4.zip`, o ZIP deve ser batizado usando um **slug limpo e legível** derivado do nome do projeto:
  - Ex: `"Plataforma de Telemedicina 2.0"` ➔ `specs-plataforma-de-telemedicina-2-0.zip`.
  - A função `slugifyProjectName` higieniza acentuação, caracteres especiais e limita a extensão do arquivo, caindo no fallback do ID apenas em casos extremos de nomes vazios.

### 2. Dashboard e Listagem de Projetos no Frontend (GraphQL)
- Atualmente, uma consulta ao histórico de requisições do usuário dispõe apenas de `id` e `originalPrompt` (que pode ser um texto descritivo de vários parágrafos).
- Com `Requisition.name` persistido e exposto no GraphQL, o frontend pode renderizar cards de projetos, tabelas, abas e breadcrumbs de navegação com títulos limpos e profissionais.

### 3. Injeção Contextual no `scopeAgent` (Worker)
- **Lacuna Detectada no Worker:** O [`scope-agent.node.ts`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/worker/src/workflows/agents/nodes/scope-agent.node.ts) era o único nó de geração do LangGraph que **não** incluía o nome do projeto em seu prompt para o LLM (injetava apenas `state.projectRequest.prompt`), enquanto os nós subsequentes (`requirementsAgent`, `judgeAgent` e `recommendedPromptAgent`) já o utilizavam.
- **Ajuste:** Injetar `Nome do Projeto: ${state.projectRequest.name}` no prompt do `scopeAgent`, garantindo que a proposta inicial de escopo e a hipótese de valor nasçam alinhadas com o nome/marca do produto.

### 4. Notificações em Tempo Real (SSE / Redis PubSub)
- Eventos de atualização de status (`SCOPE_READY`, `ARTIFACT_COMPLETED`, `REQUISITION_STATUS_CHANGED`) passam a carregar `projectName: requisition.name`, permitindo que o frontend exiba notificações ricas (toasts de navegador):
  - *"A proposta de escopo do projeto 'Telemedicina Express' está pronta para revisão!"*

### 5. Cabeçalho dos Documentos Técnicos Gerados (`scope.md`, `README.md`)
- Os artefatos e o `README.md` gerado na raiz do ZIP passam a ter cabeçalhos personalizados com a identidade do projeto:
  - `# 🚀 ${requisition.name} - AI Coding Blueprint`
  - `# Proposta de Escopo: ${requisition.name}`

### 6. Auditoria, Rastreabilidade e Recuperação de Estado (Disaster Recovery)
- Em cenários onde o worker ou o Redis reiniciem durante etapas de Human-in-the-Loop, o registro no MongoDB conterá todos os metadados primários (`name`, `originalPrompt`, `userId`, `threadId`), possibilitando auditoria, recuperação de checkpoints ou reprocessamento sem perda de contexto.

---

## 🛠️ Mudanças Arquiteturais no Monorepo

### 1. `packages/database` (Prisma ORM)
- No schema [`schema.prisma`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/packages/database/prisma/schema.prisma), adicionar o campo `name` no model `Requisition` com valor padrão `"Projeto"` (garantindo compatibilidade reversa com registros existentes no MongoDB):
  ```prisma
  model Requisition {
    id             String          @id @default(auto()) @map("_id") @db.ObjectId
    userId         String          @db.ObjectId
    user           User            @relation(fields: [userId], references: [id])
    name           String          @default("Projeto")
    originalPrompt String
    status         String          @default("AWAITING_SCOPE")
    threadId       String?
    
    scopeProposals ScopeProposal[]
    artifacts      Artifact[]
    evaluations    ArtifactEvaluation[]
    
    createdAt      DateTime        @default(now())
    updatedAt      DateTime        @updatedAt
  }
  ```
- Sincronização: Executar `pnpm run db:generate` e `pnpm run db:push`.

---

### 2. `apps/api` (Camada Web & GraphQL)

#### A. Repositório e Serviço de Requisições
- **[`requisition.repository.ts`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/requisitions/requisition.repository.ts):**
  - Atualizar o método `create` para aceitar `name: string`.
- **[`requisitions.service.ts`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/requisitions/requisitions.service.ts):**
  - Atualizar a assinatura de `create` para `(userId: string, name: string, originalPrompt: string, threadId?: string)`.
- **[`requisition.model.ts`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/requisitions/requisition.model.ts):**
  - Expor `@Field(() => String, { description: 'Nome do projeto atribuído pelo usuário' }) name!: string;`.

#### B. Serviço de Agentes
- **[`agents.service.ts`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/agents/agents.service.ts):**
  - Passar `sanitizedRequest.name` na chamada de `requisitionService.create(...)`.

#### C. Serviço de Artefatos & Nomeação do ZIP
- **[`artifacts.service.ts`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/api/src/modules/artifacts/artifacts.service.ts):**
  - Implementar a função utilitária `slugifyProjectName`:
    ```typescript
    export function slugifyProjectName(name: string): string {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
    }
    ```
  - Utilizar o slug na definição do nome do arquivo ZIP:
    ```typescript
    const slug = slugifyProjectName(requisition.name || 'projeto');
    const fileName = `specs-${slug || requisitionId.slice(-6)}.zip`;
    ```

---

### 3. `apps/worker` (Worker & LangGraph)

- **[`scope-agent.node.ts`](file:///C:/Users/joker/OneDrive/Documents/github/context-whisperer_backend/apps/worker/src/workflows/agents/nodes/scope-agent.node.ts):**
  - Atualizar a montagem do prompt para incluir:
    ```typescript
    let prompt = `${promptTemplate.content}

    Nome do Projeto: ${state.projectRequest.name}
    Prompt do usuário:
    ${state.projectRequest.prompt}
    `;
    ```

---

## 🧪 Plano de Validação & Testes

1. **Testes Unitários:**
   - `apps/api/test/unit/requisitions/requisitions.service.spec.ts`: Validar persistência do campo `name`.
   - `apps/api/test/unit/agents/agents.service.spec.ts`: Validar repasse de `projectInput.name`.
   - `apps/api/test/unit/artifacts/artifacts.service.spec.ts`: Validar `slugifyProjectName` e nomeação de arquivos ZIP com nomes reais de projetos.
   - `apps/worker/test/unit/nodes/scope-agent.node.spec.ts`: Validar inclusão de `Nome do Projeto` no prompt enviado ao LLM.
2. **Verificação de Compilação e Integridade:**
   ```bash
   pnpm test
   pnpm run test:integration
   pnpm run lint
   pnpm run build
   ```
