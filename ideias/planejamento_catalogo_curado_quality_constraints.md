# Planejamento: Catálogo Curado de QualityConstraints & Seleção Contextual Inteligente

Este documento estabelece a arquitetura, taxonomia baseada em normas internacionais (ISO/IEC/IEEE 29148, ISO/IEC 25010 e BABOK v3) e a mecânica de **Seleção Dinâmica de Restrições** para o Agente Juiz (`judgeAgent`) no Context-Whisperer.

---

## 1. Contexto e Motivação

Com a implementação do `judgeAgent` com Avaliação Causal, o sistema passou a validar os requisitos gerados contra regras formais cadastradas no banco (`QualityConstraint`).

Para elevar a qualidade das avaliações sem incorrer em **Attention Dilution** (o modelo ignorar regras no meio de um prompt gigantesco) ou **Prompt Bloat** (desperdício de tokens com regras irrelevantes para o projeto atual), adotamos uma estratégia estruturada em 3 fases:

1. **Aspecto 2 (Taxonomia & Estrutura de Metadados no Prisma):** Enriquecer a entidade `QualityConstraint` com campos de governança técnica (`category`, `sourceReference`, `isCore`, `contextKeywords`).
2. **Aspecto 1 (Catálogo Curado em Normas Internacionais):** Mapear regras formais da ISO/IEC/IEEE 29148:2018, ISO/IEC 25010 e BABOK v3 com causas-raiz e remédios contrafactuais de alta precisão.
3. **Aspecto 3 (Seleção Contextual Inteligente no JudgeAgent):** Injetar no prompt do Juiz sempre as regras universais (`isCore: true`) somadas exclusivamente às regras contextuais (`isCore: false`) ativadas pelos termos identificados no escopo do projeto.

---

## 2. Taxonomia e Metadados do Banco (`QualityConstraint`)

O model `QualityConstraint` no Prisma passa a conter os seguintes campos:

```prisma
model QualityConstraint {
  id              String       @id @default(auto()) @map("_id") @db.ObjectId
  artifactType    String       // "REQUIREMENTS", "API_SPEC", "ARCHITECTURE_DOC"
  code            String       @unique // Ex: "REQ_ISO29148_UNAMBIGUOUS"
  title           String       // Título conciso da restrição
  description     String       // O que a regra exige ou veta formalmente
  type            String       // "INVARIANT" | "NEGATIVE_CONSTRAINT"
  severity        String       // "CRITICAL" | "WARNING"
  remedyHint      String?      // Diretriz contrafactual para guiar a auto-correção
  isActive        Boolean      @default(true)
  
  // Novos Metadados de Governança e Seleção Inteligente
  category        String       // "SCOPE_INTEGRITY", "AMBIGUITY", "TESTABILITY", "PERFORMANCE", "SECURITY", "BUSINESS_LOGIC"
  sourceReference String?      // Ex: "ISO/IEC/IEEE 29148:2018 §5.2.4", "ISO/IEC 25010 §4.2"
  isCore          Boolean      @default(true) // Regra mandatória universal (sempre avaliada)
  contextKeywords String[]     // Termos de ativação para regras contextuais (ex: ["auth", "payment", "crypto", "latency"])

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}
```

---

## 3. Catálogo Curado de Normas Internacionais

O catálogo é dividido entre **Regras Core (Universais)** e **Regras Contextuais (Ativadas por Gatilho)**:

### 🏛️ Grupo A: Core Invariants & Escopo (Sempre Ativas para REQUIREMENTS)

| Código | Norma / Fonte | Severidade | Categoria | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `REQ_MOSCOW_COVERAGE` | Context-Whisperer | `CRITICAL` | `SCOPE_INTEGRITY` | 100% das funcionalidades **Must Have** do escopo aprovado devem possuir pelo menos um RF correspondente. |
| `REQ_NO_SCOPE_CREEP` | Context-Whisperer | `CRITICAL` | `SCOPE_INTEGRITY` | Proibido incluir itens da seção **Won't Have (Fora de Escopo)** ou capacidades estranhas ao MVP. |
| `REQ_ISO29148_UNAMBIGUOUS` | ISO/IEC/IEEE 29148:2018 §5.2.2 | `CRITICAL` | `AMBIGUITY` | Requisitos não devem usar termos ambíguos ("conforme necessário", "adequado", "etc.", "fácil de usar") sem definição inequívoca. |
| `REQ_ISO29148_TESTABILITY` | ISO/IEC/IEEE 29148:2018 §5.2.5 | `CRITICAL` | `TESTABILITY` | Cada requisito funcional deve possuir comportamento verificável e passível de validação por caso de teste objetivo de QA. |
| `REQ_ISO29148_ATOMICITY` | ISO/IEC/IEEE 29148:2018 §5.2.7 | `WARNING` | `TESTABILITY` | Cada requisito deve descrever uma única capacidade coesa, evitando requisitos compostos ("monolíticos") com múltiplos objetivos. |
| `REQ_BABOK_CONDITIONAL_LOGIC` | BABOK Guide v3 §10.11 | `CRITICAL` | `BUSINESS_LOGIC` | Regras de Negócio (RN) devem expressar condições lógicas formais (SE ... ENTÃO ... SENÃO) e políticas de domínio, não meros ecos dos RFs. |
| `REQ_NO_PREMATURE_TECH_STACK` | Clean Architecture / ISO 29148 | `WARNING` | `AMBIGUITY` | Requisitos funcionais não devem prescrever detalhes prematuros de implementação interna (tabelas SQL, portas de rede, libs). |

---

### 🔍 Grupo B: Regras Contextuais (Ativação Dinâmica por Palavras-Chave)

Essas regras só são injetadas no prompt se o escopo ou prompt do projeto contiverem os termos gatilho:

| Código | Norma / Fonte | Severidade | Categoria | Palavras-Chave (Gatilhos) | Descrição |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ_ISO25010_PERFORMANCE_METRIC` | ISO/IEC 25010 §4.2 (Performance) | `CRITICAL` | `PERFORMANCE` | `latency`, `throughput`, `response time`, `tempo de resposta`, `concorrência`, `tempo real`, `real-time`, `escala` | Todo RNF de performance deve especificar métricas quantificáveis (ex: P95 < 200ms, RPS mínimo, limite de CPU/RAM). |
| `REQ_ISO25010_SECURITY_AUTH` | ISO/IEC 25010 §4.5 (Security) & OWASP | `CRITICAL` | `SECURITY` | `auth`, `login`, `senha`, `jwt`, `token`, `oauth`, `permissão`, `rbac`, `papel`, `credencial` | Requisitos de autenticação e autorização devem definir expiração de sessão, proteção contra força bruta e controle de acesso RBAC. |
| `REQ_ISO25010_SECURITY_CONFIDENTIALITY` | ISO/IEC 25010 §4.5 & LGPD/GDPR | `CRITICAL` | `SECURITY` | `dados pessoais`, `lgpd`, `gdpr`, `privacidade`, `cpf`, `pagamento`, `cartão`, `credit card`, `criptografia` | Dados sensíveis ou regulados devem exigir criptografia obrigatória em trânsito (TLS 1.3+) e em repouso (AES-256). |
| `REQ_ISO25010_RELIABILITY_AVAILABILITY` | ISO/IEC 25010 §4.4 (Reliability) | `WARNING` | `PERFORMANCE` | `disponibilidade`, `uptime`, `sla`, `fault tolerance`, `tolerância a falhas`, `recuperação`, `backup` | Metas de disponibilidade devem especificar o SLA numérico (ex: 99.9% uptime) e janelas máximas de recuperação (RTO/RPO). |

---

## 4. Mecânica de Seleção Contextual no `judgeAgent`

No arquivo `judge-agent.node.ts`:
1. **Busca Core:** `prisma.qualityConstraint.findMany({ where: { artifactType: 'REQUIREMENTS', isActive: true, isCore: true } })`.
2. **Extração de Contexto:** Agrega texto do prompt do usuário e do escopo aprovado (`textToScan = prompt + approvedScope`).
3. **Matching de Palavras-Chave:** Para as constraints onde `isCore: false`, verifica se pelo menos uma `contextKeyword` dá match (case-insensitive) no `textToScan`.
4. **Composição Otimizada:** Combina as regras Core + Contextuais selecionadas, garantindo um prompt conciso (tipicamente de 7 a 9 restrições cirúrgicas, em vez de 30 desnecessárias).

---

## 5. Roteiro de Execução

- [x] **Etapa 0:** Documentação do planejamento arquitetural.
- [ ] **Etapa 1 (Aspecto 2):** Atualização do schema Prisma (`category`, `sourceReference`, `isCore`, `contextKeywords`) e compilação do pacote database.
- [ ] **Etapa 2 (Aspecto 1):** Atualização do catálogo curado com 11 regras ISO/IEEE/BABOK no `seed.js`.
- [ ] **Etapa 3 (Aspecto 3):** Implementação da seleção contextual no nó `judge-agent.node.ts`.
- [ ] **Etapa 4:** Atualização dos testes unitários e de integração, verificação de linter e build geral.
