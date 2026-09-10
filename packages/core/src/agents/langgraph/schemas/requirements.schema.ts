import { z } from 'zod';

export const FunctionalRequirementSchema = z.object({
  id: z
    .string()
    .describe('Identificador único do requisito funcional, ex: RF-01'),
  title: z.string().describe('Título conciso do requisito'),
  description: z
    .string()
    .describe('Descrição detalhada do comportamento esperado do sistema'),
  priority: z
    .enum(['HIGH', 'MEDIUM', 'LOW'])
    .describe('Nível de prioridade do requisito'),
});

export const NonFunctionalRequirementSchema = z.object({
  id: z
    .string()
    .describe('Identificador único do requisito não-funcional, ex: RNF-01'),
  category: z
    .string()
    .describe('Categoria: Segurança, Performance, Escalabilidade, etc.'),
  description: z.string().describe('Critério ou métrica mensurável exigida'),
});

export const BusinessRuleSchema = z.object({
  id: z.string().describe('Identificador da regra de negócio, ex: RN-01'),
  description: z
    .string()
    .describe('Regra ou restrição mandatória do domínio de negócio'),
});

export const RequirementsSchema = z.object({
  summary: z
    .string()
    .describe('Resumo executivo da especificação de requisitos e contexto'),
  functionalRequirements: z
    .array(FunctionalRequirementSchema)
    .describe('Lista de requisitos funcionais'),
  nonFunctionalRequirements: z
    .array(NonFunctionalRequirementSchema)
    .describe('Lista de requisitos não-funcionais'),
  businessRules: z
    .array(BusinessRuleSchema)
    .describe('Lista de regras de negócio'),
});

export type FunctionalRequirement = z.infer<typeof FunctionalRequirementSchema>;
export type NonFunctionalRequirement = z.infer<
  typeof NonFunctionalRequirementSchema
>;
export type BusinessRule = z.infer<typeof BusinessRuleSchema>;
export type RequirementsResponse = z.infer<typeof RequirementsSchema>;
