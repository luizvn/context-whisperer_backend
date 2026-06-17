import { z } from 'zod';

export const ProposedScopeSchema = z.object({
  projectGoal: z.string().describe('O objetivo principal do projeto'),
  mustHave: z.array(z.string()).describe('Requisitos indispensáveis (MVP)'),
  shouldHave: z
    .array(z.string())
    .describe('Requisitos importantes mas não vitais'),
  couldHave: z
    .array(z.string())
    .describe('Requisitos desejáveis (Nice to have)'),
  wontHave: z.array(z.string()).describe('Requisitos fora do escopo atual'),
  businessConstraints: z
    .array(z.string())
    .describe('Restrições de negócio ou técnicas'),
});

export type ProposedScopeResponse = z.infer<typeof ProposedScopeSchema>;
