import { z } from 'zod';

export const ProposedScopeSchema = z.object({
  projectGoal: z
    .string()
    .describe('O objetivo principal e proposta de valor do projeto para o MVP'),
  mustHave: z
    .array(z.string())
    .describe(
      'Lista dinâmica de funcionalidades essenciais e indispensáveis para a validação do MVP',
    ),
  shouldHave: z
    .array(z.string())
    .describe(
      'Lista dinâmica de funcionalidades de alto valor agregado, mas que podem ser postergadas ou contornadas na v1',
    ),
  couldHave: z
    .array(z.string())
    .describe(
      'Lista dinâmica de melhorias de conveniência ou baixo esforço que só entram se houver capacidade excedente',
    ),
  wontHave: z
    .array(z.string())
    .describe(
      'Lista dinâmica de itens deliberadamente fora do escopo do MVP para blindagem de prazo (ex: ERPs pesados, automações complexas)',
    ),
  businessConstraints: z
    .array(z.string())
    .describe(
      'Restrições e premissas inegociáveis extraídas ou diretamente fundamentadas no contexto do usuário (ex: conformidade legal/LGPD, plataformas alvo). NUNCA invente prazos, datas, cronogramas ou valores monetários que não tenham sido informados pelo usuário. Se não houver restrições explícitas, retorne lista vazia.',
    ),
});

export type ProposedScopeResponse = z.infer<typeof ProposedScopeSchema>;
