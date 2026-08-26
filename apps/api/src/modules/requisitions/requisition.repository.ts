import { Injectable } from '@nestjs/common';
import { prisma, Requisition } from '@context-whisperer/database';

@Injectable()
export class RequisitionRepository {
  async findById(id: string): Promise<Requisition | null> {
    return await prisma.requisition.findUnique({
      where: { id },
    });
  }

  async create(data: {
    userId: string;
    originalPrompt: string;
    status: string;
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
