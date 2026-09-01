# Planejamento: Migração e Padronização de Logs com Pino

Este documento estabelece o planejamento para a substituição de todos os `console.log` e variações por um sistema de **Structured Logging profissional baseado em Pino**, com proibição via ESLint e padronização de todas as mensagens estritamente em **inglês**.

---

## 1. Diagnóstico do Estado Atual

### ⚠️ Problemas Identificados:
1. **Uso de `console.log`, `console.warn` e `console.error` dispersos:**
   - Encontradas ocorrências manuais em `apps/worker/src/main.ts`, `apps/worker/src/workflows/...`, `apps/api/src/main.ts`, `apps/api/src/modules/agents/...` e `apps/api/src/modules/events/...`.
   - Ocorrências de `console.warn` foram introduzidas em lógicas de fallback e alertas temporários sem padronização.
2. **Falta de Estrutura (Raw Strings):**
   - Logs concatenados em texto puro (ex: `console.log(`[Worker] Processando Job ${job.id}...`)`), sem suporte a campos estruturados para indexação (Datadog, Loki, CloudWatch).
3. **Inconsistência de Idioma:**
   - Mensagens misturando português (`"👷 Iniciando Worker do Context-Whisperer..."`, `"Job concluído com sucesso"`) e inglês (`"Server listening on..."`, `"EVALUATING CONDITIONAL EDGE"`).
4. **Falta de Rastreabilidade e Níveis Semânticos de Log:**
   - Não há distinção sistemática entre `debug`, `info`, `warn` e `error`.
   - Ausência de Correlation ID (`requestId`, `jobId`, `threadId`) propagado no contexto.

---

## 2. Escolha da Tecnologia: Por que Pino?

**Pino** é a escolha ideal para o projeto pelos seguintes motivos:
- **Performance:** É comprovadamente o logger JSON mais rápido para Node.js, com consumo mínimo de overhead de CPU e memória.
- **Integração Nativa com Fastify:** O Fastify já utiliza o Pino internamente. Integrar o NestJS com Pino via `nestjs-pino` unifica os logs HTTP, GraphQL e de aplicação sob a mesma engine.
- **Logs Estruturados (JSON First):** Em produção, emite JSON puro com campos padronizados (`level`, `time`, `pid`, `hostname`, `msg`, `context`, `reqId`, `jobId`).
- **DX (Developer Experience):** Em desenvolvimento local, utiliza `pino-pretty` para colorização e leitura clara no terminal.
- **Child Loggers Contextuais:** Permite criar loggers com contexto anexado (ex: `logger.child({ jobId, requisitionId })`), sem precisar passar variáveis manualmente em cada string.

---

## 3. Arquitetura Proposta

### 🅰️ API Gateway (`apps/api`): `nestjs-pino`
- Utilizar `nestjs-pino` e `pino-http`.
- Configurar no `AppModule` como `LoggerModule.forRootAsync(...)`.
- Injetar o Logger oficial do NestJS substituído pelo Pino (`app.useLogger(app.get(Logger))`).
- Habilitar rastreamento automático de Request ID em requisições HTTP e GraphQL.

### 🅱️ Worker (`apps/worker`): Instância Pino Estruturada
- Como o Worker é um processo standalone do BullMQ, criamos um logger centralizado em `apps/worker/src/utils/logger.ts` utilizando `pino`.
- Cada job do BullMQ cria um child logger com o contexto do job:
  ```typescript
  const jobLogger = logger.child({ jobId: job.id, threadId: job.data.threadId });
  jobLogger.info('Processing generation job');
  ```

### 🅲 Proibição Estrita de `console.*` via ESLint (incluindo `console.warn`)
- Adicionar no `eslint.config.mjs` de ambos os projetos (`apps/api` e `apps/worker`):
  ```javascript
  rules: {
    // Proíbe estritamente console.log, console.warn, console.error, console.info, console.debug, etc.
    'no-console': ['error', { allow: [] }],
  }
  ```
- **Sem exceções:** Qualquer uso de `console.warn`, `console.log` ou `console.error` gerará erro fatal no ESLint (`pnpm run lint`).
- Alertas e avisos não-críticos devem obrigatoriamente utilizar `logger.warn({ context }, "Warning message in English")`.

### 🅳 Padronização de Idioma (English Only)
- Todas as mensagens de log serão estritamente em **inglês**, seguindo o padrão imperativo/declarativo claro.

---

## 4. Tabela de Mapeamento de Logs (Antes x Depois)

| Local | Antes (Português / Console) | Depois (Pino / Inglês Estruturado) | Nível |
| :--- | :--- | :--- | :--- |
| `worker/main.ts` | `console.log("👷 Iniciando Worker...")` | `logger.info("Worker service initializing")` | `info` |
| `worker/main.ts` | `console.log("✅ LangGraph inicializado...")` | `logger.info("LangGraph workflow compiled with MongoDB checkpointer")` | `info` |
| `worker/main.ts` | `console.log(`Processando Job ${job.id}`)` | `jobLogger.info({ requisitionId }, "Processing generation job")` | `info` |
| `worker/main.ts` | `console.log(`Job concluído com sucesso`)` | `jobLogger.info({ durationMs }, "Generation job completed successfully")` | `info` |
| `worker/main.ts` | `console.error(`🚨 Job falhou: ${err.message}`)` | `jobLogger.error({ err }, "Generation job failed")` | `error` |
| `worker/main.ts` | `console.log("🎧 Worker escutando a fila...")` | `logger.info({ queue: "ai-generation" }, "Worker listening to queue")` | `info` |
| `scope-agent.node.ts` | `console.log("--- Executing Scope Generation ---")` | `logger.debug({ requisitionId, threadId }, "Executing scope generation node")` | `debug` |
| `scope-agent.node.ts` | `console.log("Publishing SCOPE_READY...")` | `logger.info({ eventType: SseEventType.SCOPE_READY, userId }, "Published user event to Redis")` | `info` |
| `api/main.ts` | `console.log(`Server listening on ${port}`)` | `logger.info({ port, host: '0.0.0.0' }, "Server listening")` | `info` |
| `agents.resolver.ts` | `console.log("Enqueueing project...")` | `logger.info({ threadId, userId }, "Enqueued project generation workflow")` | `info` |
| `events.service.ts` | `console.error("Redis Subscriber error")` | `logger.error({ err }, "Redis Subscriber connection error")` | `error` |
| `worker/main.ts` | `console.warn(...)` (Alertas/Retries) | `jobLogger.warn({ attempt, reason }, "Job execution encountered non-fatal condition")` | `warn` |
| `events.service.ts` | `console.warn(...)` (Heartbeat/SSE) | `logger.warn({ userId }, "SSE connection closed unexpectedly by client")` | `warn` |

---

## 5. Roteiro de Implementação (Fases)

### 📌 Fase 1: Governança no Linter (`apps/api` e `apps/worker`)
- Adicionar `'no-console': ['error', { allow: [] }]` nos arquivos `eslint.config.mjs`.
- Ajustar arquivos de teste (se houver consoles em testes) ou permitir mocks de logger.

### 📌 Fase 2: Configuração do Pino no Worker (`apps/worker`)
- Instalar `pino` e `pino-pretty` (como devDependency para formatação local).
- Criar `apps/worker/src/utils/logger.ts` com suporte a `NODE_ENV` (pretty-print em dev, JSON puro em prod).
- Migrar todas as chamadas em `main.ts`, `generation.processor.ts`, `graph.ts`, `scope-agent.node.ts` e `example.edge.ts` para usar o logger com mensagens em inglês.

### 📌 Fase 3: Configuração do Pino na API (`apps/api`)
- Instalar `nestjs-pino`, `pino` e `pino-http` no `apps/api`.
- Registrar o `LoggerModule` no `AppModule` configurado com `pino-pretty` em modo de desenvolvimento.
- Substituir o logger padrão do NestJS no `main.ts` com `app.useLogger(app.get(Logger))`.
- Injetar o `Logger` nos resolvers e services (`AgentsResolver`, `EventsService`).
- Substituir todos os `console.*` por chamadas do logger em inglês.

### 📌 Fase 4: Ajuste dos Testes e Validação
- Ajustar os testes unitários e de integração que verificavam logs ou precisem de mock do logger.
- Executar a suíte completa: `pnpm run test:all`, `pnpm -r lint` e `pnpm -r build`.
- Validar no terminal que a saída de logs está limpa, formatada e padronizada em inglês.
