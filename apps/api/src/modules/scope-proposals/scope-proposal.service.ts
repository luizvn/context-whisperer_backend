import { Injectable, NotFoundException } from '@nestjs/common';
import { ProposedScopeResponse } from '@context-whisperer/core';
import {
  ScopeProposalModel,
  ScopeProposalStatus,
} from './scope-proposal.model';
import { ScopeProposalRepository } from './scope-proposal.repository';

@Injectable()
export class ScopeProposalService {
  constructor(
    private readonly scopeProposalRepository: ScopeProposalRepository,
  ) {}

  async findById(id: string): Promise<ScopeProposalModel> {
    const proposal = await this.scopeProposalRepository.findById(id);

    if (!proposal) {
      throw new NotFoundException(`Scope proposal with ID ${id} not found`);
    }

    return proposal;
  }

  async create(
    requisitionId: string,
    templateId: string,
    contentMd: string,
  ): Promise<ScopeProposalModel> {
    return this.scopeProposalRepository.create({
      requisitionId,
      templateId,
      contentMd,
      status: ScopeProposalStatus.PENDING,
    });
  }

  async approve(id: string): Promise<ScopeProposalModel> {
    return this.scopeProposalRepository.updateStatus(
      id,
      ScopeProposalStatus.APPROVED,
    );
  }

  async reject(id: string, feedback: string): Promise<ScopeProposalModel> {
    return this.scopeProposalRepository.updateStatus(
      id,
      ScopeProposalStatus.REJECTED,
      feedback,
    );
  }

  /**
   * Converte o objeto estruturado vindo do LLM (Zod/LangChain) em uma string Markdown formatada.
   */
  buildMarkdownFromResponse(data: ProposedScopeResponse): string {
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
