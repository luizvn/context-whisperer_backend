import { Injectable } from '@nestjs/common';
import { prisma, Artifact, ScopeProposal } from '@context-whisperer/database';

@Injectable()
export class ArtifactRepository {
  async findCompletedByRequisitionId(
    requisitionId: string,
  ): Promise<Artifact[]> {
    return await prisma.artifact.findMany({
      where: {
        requisitionId,
        status: 'COMPLETED',
      },
    });
  }

  async findScopeProposalByRequisitionId(
    requisitionId: string,
  ): Promise<ScopeProposal | null> {
    const approved = await prisma.scopeProposal.findFirst({
      where: {
        requisitionId,
        status: 'APPROVED',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (approved) {
      return approved;
    }

    return await prisma.scopeProposal.findFirst({
      where: { requisitionId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
