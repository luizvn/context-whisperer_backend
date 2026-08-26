# Planejamento de Arquitetura: Filas, PubSub e Monorepo

Este documento detalha o planejamento arquitetural para a implementação de processamento assíncrono, notificações em tempo real e reestruturação do projeto Context-Whisperer.

## 1. Producer-Consumer com BullMQ (Processamento em Background)

**Objetivo:** Isolar o processamento pesado (chamadas à OpenAI, LangChain, geração de artefatos) do fluxo principal da API, evitando o bloqueio do Event Loop do Node.js.

**Solução:**
- **Filas de Tarefas:** Utilizar o BullMQ (apoiado por Redis) para gerenciar jobs.
- **Isolamento:** Criar um serviço de *Worker* dedicado para consumir as mensagens da fila. A API (Fastify) atuará apenas como *Producer*.
- **Resiliência:** Implementar estratégias de repetição (retries) com *backoff* exponencial para lidar com erros transitórios da API da OpenAI (ex: HTTP 429 Rate Limit).

## 2. PubSub e Server-Sent Events (SSE)

**Objetivo:** Notificar o front-end de forma eficiente sobre o progresso e a conclusão dos processamentos assíncronos, substituindo GraphQL Subscriptions.

**Solução:**
- **SSE na API:** Implementar endpoints SSE no NestJS. O SSE é ideal por ser unidirecional (Servidor -> Cliente), mais leve e nativo do protocolo HTTP.
- **Comunicação Interna (PubSub):** Utilizar o Redis (através dos recursos do BullMQ ou Redis Pub/Sub nativo) para comunicar o *Worker* com a *API*. Quando o *Worker* terminar uma tarefa, ele emite um evento no Redis. A instância da API escuta esse evento e o encaminha via SSE para o cliente conectado.

## 3. Estrutura de Monorepo

**Objetivo:** Facilitar o compartilhamento de código (schemas de banco de dados, tipos, regras de negócio) entre os diferentes serviços sem duplicar esforço.

**Solução:**
- **Ferramenta:** Utilizar `pnpm workspaces`, que já está integrado ao ecossistema do projeto.
- **Estrutura Proposta:**
  ```text
  /
  ├── packages/                  # Código compartilhado
  │   ├── database/              # Schemas do Drizzle, migrações e conexão
  │   └── core/                  # Tipagens TypeScript, utilitários e prompts LangChain
  └── apps/                      # Serviços executáveis
      ├── api/                   # Aplicação NestJS atual (Fastify + GraphQL)
      └── worker/                # Aplicação Node.js (ou NestJS) para rodar o BullMQ Consumer
  ```

## 4. Human-in-the-Loop e Gerenciamento de Estado (Melhoria)

**Objetivo:** Permitir a intervenção humana durante o fluxo de geração de software sem manter recursos bloqueados em espera.

**Solução:**
- **Evitar Jobs Longos (Sleeping Jobs):** Em fluxos que requerem aprovação, o Worker **não** deve ficar pausado (awaiting) dentro do processamento da fila esperando uma resposta externa, pois isso consome workers do BullMQ e conexões.
- **Separação de Etapas:** 
  1. O Worker processa a Fase 1.
  2. Ao finalizar a Fase 1, o Worker salva o resultado no banco de dados e atualiza o estado da requisição para algo como `WAITING_HUMAN_APPROVAL`.
  3. O Worker **encerra o job** com sucesso.
  4. Uma notificação é enviada via SSE ao cliente.
  5. O usuário revisa e aprova via chamada REST/GraphQL na API.
  6. A API enfileira um **novo job** para a Fase 2, passando o ID do contexto aprovado.

## 5. Gerenciamento de Custos e Tokens (Melhoria)

**Objetivo:** Monitorar ativamente e persistir o consumo de tokens das APIs de IA para controle de custos operacionais.

**Solução:**
- **Registro no Worker:** Toda chamada feita para a OpenAI pelo Worker deve capturar a métrica de tokens de prompt e tokens de completion retornados na resposta da API.
- **Persistência Assíncrona:** O Worker é o responsável por gravar esses dados no banco de dados (relacionando-os ao usuário, projeto ou job específico).
- **Vantagem Arquitetural:** Ao fazer isso no serviço de Worker, cálculos complexos de precificação e gravações extras no banco de dados não adicionam latência nas respostas da API para o cliente. É possível gerar relatórios precisos de custo por geração de artefato.

## 6. Modelagem de Dados e Persistência (Logs, Estatísticas e Estado)

**Objetivo:** Definir a estratégia de armazenamento para dados não estruturados, histórico de IA e métricas, sem introduzir complexidade de infraestrutura (como um banco NoSQL dedicado) no momento inicial.

**Solução (PostgreSQL + Redis):**
- **Evitar NoSQL Prematuro:** O PostgreSQL possui suporte avançado ao formato `JSONB`, sendo perfeitamente capaz de armazenar dados semi-estruturados, logs e configurações com alta performance, usando índices GIN quando necessário.
- **Armazenamento de Estado (LangGraph):** O LangGraph requer persistência de checkpoints de estado (memória das threads). Utilizar o **Redis** (que já fará parte da arquitetura por conta do BullMQ) para gerenciar essas interações rápidas de chave-valor.

**O que deve ser rastreado no Banco de Dados (PostgreSQL):**
1. **Versionamento e Snapshot de Prompts:** Salvar a string exata do prompt e os parâmetros da IA (modelo, temperatura, max_tokens) utilizados na geração. Isso garante rastreabilidade total caso a IA alucine ou produza um artefato ruim.
2. **Loop de Feedback do Usuário (Data Flywheel):** Armazenar avaliações (ex: thumbs up/down) ou as correções manuais que o usuário fez em cima do texto gerado pela IA. Esses dados são valiosos para futuros *fine-tunings* de LLMs.
3. **Métricas de Performance da IA (Latência):** Registrar o tempo total consumido por cada requisição à OpenAI. Essencial para identificar degradação de performance e criar estratégias de fallback para modelos mais rápidos.
4. **Histórico de Refinamento (Chat/RAG):** Persistir as mensagens intermediárias (back-and-forth) trocadas entre o usuário e a IA para refinamento da ideia original, permitindo que a IA tenha acesso a uma memória de longo prazo do contexto do projeto.
