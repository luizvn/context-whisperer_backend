import { Injectable } from '@nestjs/common';
import { prisma, ScopeProposal } from '@context-whisperer/database';

@Injectable()
export class ScopeProposalRepository {
  async findById(id: string): Promise<ScopeProposal | null> {
    return await prisma.scopeProposal.findUnique({
      where: { id },
    });
  }

  async create(data: {
    requisitionId: string;
    templateId: string;
    contentMd: string;
    status: string;
  }): Promise<ScopeProposal> {
    return await prisma.scopeProposal.create({
      data,
    });
  }

  async updateStatus(
    id: string,
    status: string,
    userFeedback?: string,
  ): Promise<ScopeProposal> {
    return await prisma.scopeProposal.update({
      where: { id },
      data: { status, userFeedback },
    });
  }
}
