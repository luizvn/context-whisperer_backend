import type { Constraint, Template } from "@core/models/types";

/**
 * Catálogo padrão de templates e constraints exibido na base de conhecimento (RF05/RNF04)
 */
export const mockTemplates: Template[] = [
  {
    id: "tpl-1",
    name: "Template de Requisitos (ISO 29148)",
    targetDocument: "1_Requisitos.md",
    contentMd: `# 1_Requisitos.md\n\n## 1. Escopo e Objetivos\n## 2. Requisitos Funcionais (RF)\n## 3. Requisitos Não Funcionais (RNF)\n## 4. Regras de Negócio (RN)\n## 5. Matriz de Rastreabilidade`,
  },
  {
    id: "tpl-2",
    name: "Template de Arquitetura de Software",
    targetDocument: "2_Arquitetura.md",
    contentMd: `# 2_Arquitetura.md\n\n## 1. Visão Geral e Contexto\n## 2. Camadas e Responsabilidades\n## 3. Integrações e Contratos\n## 4. Decisões Arquiteturais (ADRs)\n## 5. Estratégia de Deploy e Observabilidade`,
  },
  {
    id: "tpl-3",
    name: "Template UML e Modelagem",
    targetDocument: "3_UML.md",
    contentMd: `# 3_UML.md\n\n## 1. Diagrama de Casos de Uso\n## 2. Diagrama de Classes de Domínio\n## 3. Diagramas de Sequência (Fluxos Críticos)`,
  },
  {
    id: "tpl-4",
    name: "Template de Especificação de Agentes",
    targetDocument: "agents.md",
    contentMd: `# agents.md\n\n## 1. Topologia de Agentes\n## 2. Estado Compartilhado (State Graph)\n## 3. Políticas de Retry e Dead Letter\n## 4. Critérios de Parada e Circuit Breakers`,
  },
];

export const mockConstraints: Constraint[] = [
  {
    id: "c-1",
    category: "RNF01 — Performance",
    ruleDescription: "Latência P95 em endpoints síncronos",
    ruleContent: "Endpoints HTTP/GraphQL devem definir SLA < 1500ms para 95% das requisições.",
    isActive: true,
  },
  {
    id: "c-2",
    category: "RNF02 — Segurança",
    ruleDescription: "Autenticação em todas as rotas mutacionais",
    ruleContent:
      "Mutations e comandos de escrita exigem JWT válido e verificação de escopo de permissão.",
    isActive: true,
  },
  {
    id: "c-3",
    category: "RNF03 — Rastreabilidade",
    ruleDescription: "Snapshot do estado global no LangGraph",
    ruleContent:
      "Cada transição de nó do grafo deve persistir snapshot de estado com timestamp e threadId.",
    isActive: true,
  },
  {
    id: "c-4",
    category: "RNF04 — Determinismo",
    ruleDescription: "Injeção determinística de templates no RAG",
    ruleContent:
      "O prompt do agente drafter deve carregar estritamente o template aprovado correspondente.",
    isActive: true,
  },
  {
    id: "c-5",
    category: "RNF05 — Causalidade",
    ruleDescription: "Feedback acionável no Juiz",
    ruleContent:
      "Toda reprovação do Juiz deve indicar explicitamente a regra violada e a ação corretiva.",
    isActive: true,
  },
];
