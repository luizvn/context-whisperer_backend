# Planejamento Arquitetural: Nomenclatura Semântica de ZIP (`artifacts-...`) & Enriquecimento SSE com `projectName`

Este documento formaliza as decisões de arquitetura e design para:
1. **Nomenclatura do Pacote de Artefatos:** Padronização do arquivo ZIP compactado com o prefixo `artifacts-[project.name|requisitionId].zip`, refletindo a totalidade dos entregáveis do projeto.
2. **Identidade Nominal em Notificações SSE (Item B):** Propagação do campo `projectName` em todas as mensagens do barramento Redis PubSub e Server-Sent Events (SSE).

---

## 🎯 1. Nomenclatura Semântica do Arquivo ZIP

### Motivação:
Anteriormente, o endpoint GraphQL de download de ZIP utilizava o prefixo `specs-` (`specs-[slug].zip`). Como o arquivo compactado contém tanto especificações de escopo e requisitos quanto o prompt mestre executável de Loop Engineering (`PROMPT.md`), o blueprint completo (`README.md`) e futuros artefatos de código, o prefixo `artifacts-` é o descritor mais preciso e alinhado com o domínio do Context-Whisperer.

### Formato Padronizado:
```text
artifacts-${slug || requisitionId.slice(-6)}.zip
```
- **Exemplo com slug válido:** `artifacts-telemedicina-express.zip`
- **Exemplo de fallback (nome ausente ou com símbolos):** `artifacts-d09ae4.zip`

---

## 📡 2. Enriquecimento de Notificações em Tempo Real (SSE)

### Motivação:
No fluxo assíncrono do Context-Whisperer, o frontend conecta-se ao canal SSE `/api/events/stream` para acompanhar a evolução do projeto em tempo real. Até então, as mensagens continham `requisitionId` e `threadId`, mas não o nome do projeto (`projectName`). Para exibir notificações amigáveis (como toasts de navegador: *"A proposta de escopo do projeto Telemedicina Express está pronta"*), o frontend precisaria fazer uma query GraphQL avulsa ou manter um mapa manual em memória.

### Contrato de Mensagem (`packages/core`):
A interface `SseEventMessage` foi enriquecida com o campo opcional `projectName?: string`:

```typescript
export interface SseEventMessage<T = unknown> {
  id?: string;
  type: SseEventType;
  userId: string;
  requisitionId?: string;
  projectName?: string; // Nome nominal do projeto para exibição imediata
  threadId?: string;
  timestamp: string;
  data: T;
}
```

### Eventos Contemplados:
| Evento SSE | Origem | Campo `projectName` | Finalidade na UI |
| :--- | :--- | :--- | :--- |
| `SCOPE_READY` | `scopeAgent` | `state.projectRequest.name` | Notificar prontidão da proposta de escopo para revisão HITL |
| `SCOPE_APPROVED` | `ScopeProposalResolver` | `requisition.name` | Notificar confirmação da aprovação humana |
| `SCOPE_REJECTED` | `ScopeProposalResolver` | `requisition.name` | Notificar início de re-refinamento baseado em feedback |
| `ARTIFACT_GENERATING` | `artifactDispatcher` | `state.projectRequest.name` | Renderizar card de carregamento do artefato |
| `ARTIFACT_REWORKING` | `artifactDispatcher` | `state.projectRequest.name` | Sinalizar ciclo de auto-correção orientado pelo juiz |
| `ARTIFACT_COMPLETED` | `judgeAgent` / `recPrompt` | `state.projectRequest.name` | Renderizar conclusão do artefato com sucesso |
| `REQUISITION_STATUS_CHANGED` | `dispatcher` / `recPrompt` / `processor` | `state.projectRequest.name` | Atualizar badges de status do projeto |
| `WORKFLOW_FAILED` | `generationProcessor` | `projectRequest.name` | Exibir alerta de erro com o nome do projeto |

---

## 🧪 3. Validação e Qualidade

- Validação estrita de contratos TypeScript e compilação do monorepo.
- Testes unitários atualizados no `apps/api` e `apps/worker` garantindo asserções sobre `artifacts-` e a presença de `projectName` nos eventos emitidos.
