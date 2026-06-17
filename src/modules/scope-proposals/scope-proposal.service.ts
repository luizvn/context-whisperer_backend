import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../config/database.config';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { scopeProposalsTable } from './scope-proposal.schema';
import { eq } from 'drizzle-orm';
import { ProposedScopeResponse } from '../agents/langgraph/schemas/proposed-scope.response';
import { ScopeProposalStatus } from './scope-proposal.model';

@Injectable()
export class ScopeProposalService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<Record<string, unknown>>,
  ) {}

  async findById(id: string) {
    const [proposal] = await this.db
      .select()
      .from(scopeProposalsTable)
      .where(eq(scopeProposalsTable.id, id));

    if (!proposal) {
      throw new NotFoundException(`Scope proposal with ID ${id} not found`);
    }

    return proposal;
  }

  async create(requisitionId: string, contentMd: string) {
    const [newProposal] = await this.db
      .insert(scopeProposalsTable)
      .values({
        requisitionId,
        contentMd,
        status: ScopeProposalStatus.PENDING,
      })
      .returning();

    return newProposal;
  }

  async approve(id: string) {
    const [updated] = await this.db
      .update(scopeProposalsTable)
      .set({ status: ScopeProposalStatus.APPROVED })
      .where(eq(scopeProposalsTable.id, id))
      .returning();

    return updated;
  }

  async reject(id: string, feedback: string) {
    const [updated] = await this.db
      .update(scopeProposalsTable)
      .set({
        status: ScopeProposalStatus.REJECTED,
        userFeedback: feedback,
      })
      .where(eq(scopeProposalsTable.id, id))
      .returning();

    return updated;
  }

  /**
   * Converte o objeto estruturado vindo do LLM (Zod/LangChain) em uma string Markdown formatada.
   */
  buildMarkdownFromResponse(data: ProposedScopeResponse) {
    let md = `# Proposta de Escopo\n\n`;

    md += `## 🎯 Objetivo do Projeto\n${data.projectGoal}\n\n`;

    md += `## ✅ Must Have (Indispensável)\n`;
    data.mustHave.forEach((item) => (md += `- ${item}\n`));
    md += `\n`;

    md += `## 🚀 Should Have (Importante)\n`;
    data.shouldHave.forEach((item) => (md += `- ${item}\n`));
    md += `\n`;

    md += `## ✨ Could Have (Desejável)\n`;
    data.couldHave.forEach((item) => (md += `- ${item}\n`));
    md += `\n`;

    md += `## 🚫 Won't Have (Fora de Escopo)\n`;
    data.wontHave.forEach((item) => (md += `- ${item}\n`));
    md += `\n`;

    if (data.businessConstraints && data.businessConstraints.length > 0) {
      md += `## ⚠️ Restrições de Negócio\n`;
      data.businessConstraints.forEach((item) => (md += `- ${item}\n`));
      md += `\n`;
    }

    return md;
  }
}
