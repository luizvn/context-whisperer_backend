import { z } from 'zod';

export const RecommendedPromptSchema = z.object({
  projectOverview: z
    .string()
    .describe(
      'Visão executiva do projeto redigida em Português do Brasil (pt-BR), seu propósito central e a hipótese de valor que o MVP valida.',
    ),
  recommendedStack: z
    .string()
    .describe(
      'Recomendação justificada da stack tecnológica ideal para o MVP (frontend, backend, banco de dados, autenticação), redigida em Português do Brasil (pt-BR). A recomendação DEVE ser 100% opinativa e unificada (proibido usar "OU" ou oferecer opções alternativas). É terminantemente proibido recomendar plataformas Backend-as-a-Service (como Supabase, Firebase, Appwrite) ou Auth-as-a-Service terceirizado (como Clerk, Auth0, Kinde, Stytch). A stack deve ser totalmente auto-contida em código (Code-First), priorizando bancos de dados gerenciáveis localmente (PostgreSQL, SQLite, MongoDB), ORMs modernos (Prisma, Drizzle) e autenticação nativa em código (JWT, bcrypt, Passport).',
    ),
  implementationRoadmap: z
    .array(z.string())
    .describe(
      'Fases lógicas e sequenciais para guiar a construção do software passo a passo em Português do Brasil (pt-BR) (ex: Fase 1: Setup & Modelagem de Dados, Fase 2: Autenticação & RBAC, Fase 3: APIs de Domínio & Regras de Negócio, Fase 4: Frontend UI & Telas, Fase 5: Validação, Build & Testes).',
    ),
  masterPrompt: z
    .string()
    .describe(
      'O prompt mestre integral em Markdown, redigido 100% em Português do Brasil (pt-BR), contendo: 1) Persona de Engenharia; 2) Protocolo de Loop Engineering para execução autônoma contínua; 3) Referenciamento autoritativo a @docs/requirements.md como FONTE PRIMÁRIA DA VERDADE e @docs/scope.md como contexto executivo e limites de fronteira (sem duplicar requisitos em texto corrido); 4) Ciclo de execução em 5 loops passo a passo (Setup -> Dados -> Backend/Auth -> Frontend -> Validação); 5) Critério de conclusão e Definition of Done (DoD). Não envolva o texto com crases triplas ```markdown externas.',
    ),
  usageInstructions: z
    .string()
    .describe(
      'Instruções didáticas e práticas em Português do Brasil (pt-BR) ensinando o usuário a: 1. Baixar os arquivos gerados (requirements.md e scope.md); 2. Salvá-los na pasta docs/ ou raiz do novo repositório; 3. Abrir o projeto em ferramentas como Cursor (Agent mode), Windsurf (Cascade) ou Claude Code; 4. Colar o prompt mestre e disparar a geração autônoma em loop.',
    ),
});

export type RecommendedPromptResponse = z.infer<
  typeof RecommendedPromptSchema
>;
