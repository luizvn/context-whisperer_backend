import { z } from 'zod';

export const CausalViolationSchema = z.object({
  ruleCode: z
    .string()
    .describe(
      'Código formal da restrição de qualidade violada, ex: REQ_MOSCOW_COVERAGE',
    ),
  severity: z
    .enum(['CRITICAL', 'WARNING'])
    .describe(
      'Nível de severidade da violação (CRITICAL impede aprovação imediata; WARNING gera recomendação)',
    ),
  location: z
    .string()
    .describe(
      'Trecho, ID do requisito ou seção onde o defeito causal foi observado, ex: RF-03 ou Seção RNF',
    ),
  cause: z
    .string()
    .describe('Diagnóstico da causa-raiz: o que levou à violação da regra'),
  remedy: z
    .string()
    .describe(
      'Instrução contrafactual: o que deve ser modificado especificamente para sanar o defeito',
    ),
});

export const CausalEvaluationSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(10)
    .describe('Nota técnica global de qualidade do artefato de 0.0 a 10.0'),
  summary: z
    .string()
    .describe('Síntese executiva da avaliação técnica e conformidade geral'),
  rootCauses: z
    .array(z.string())
    .describe(
      'Lista resumida dos principais fatores causais de falha ou fragilidade técnica',
    ),
  violations: z
    .array(CausalViolationSchema)
    .describe(
      'Lista detalhada de violações a restrições de qualidade encontradas',
    ),
  counterfactualFeedback: z
    .string()
    .describe(
      'Feedback contrafactual integrado e acionável para orientar a auto-correção do agente especialista',
    ),
});

export type CausalViolation = z.infer<typeof CausalViolationSchema>;
export type CausalEvaluation = z.infer<typeof CausalEvaluationSchema>;
