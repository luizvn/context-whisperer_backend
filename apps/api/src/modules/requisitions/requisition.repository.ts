import { Injectable } from '@nestjs/common';
import { prisma, Requisition } from '@context-whisperer/database';

@Injectable()
export class RequisitionRepository {
  async findById(id: string): Promise<Requisition | null> {
    return await prisma.requisition.findUnique({
      where: { id },
    });
  }

  async findByUserId(userId: string): Promise<Requisition[]> {
    return await prisma.requisition.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdWithDetails(id: string): Promise<Requisition | null> {
    return await prisma.requisition.findUnique({
      where: { id },
      include: {
        scopeProposals: {
          orderBy: { createdAt: 'desc' },
        },
        artifacts: {
          orderBy: { createdAt: 'asc' },
        },
        evaluations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async create(data: {
    userId: string;
    name: string;
    originalPrompt: string;
    status: string;
    threadId?: string;
  }): Promise<Requisition> {
    return await prisma.requisition.create({
      data,
    });
  }

  async updateStatus(id: string, status: string): Promise<Requisition> {
    return await prisma.requisition.update({
      where: { id },
      data: { status },
    });
  }
}
