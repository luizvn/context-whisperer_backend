import { Injectable, NotFoundException } from '@nestjs/common';
import { RequisitionModel, RequisitionStatus } from './requisition.model';
import { RequisitionRepository } from './requisition.repository';

@Injectable()
export class RequisitionsService {
  constructor(private readonly requisitionRepository: RequisitionRepository) {}

  async findById(id: string): Promise<RequisitionModel> {
    const requisition = await this.requisitionRepository.findById(id);

    if (!requisition) {
      throw new NotFoundException(`Requisition with ID ${id} not found`);
    }

    return requisition;
  }

  async create(
    userId: string,
    originalPrompt: string,
  ): Promise<RequisitionModel> {
    return this.requisitionRepository.create({
      userId,
      originalPrompt,
      status: RequisitionStatus.AWAITING_SCOPE,
    });
  }

  async updateStatus(
    id: string,
    status: RequisitionStatus,
  ): Promise<RequisitionModel> {
    try {
      return await this.requisitionRepository.updateStatus(id, status);
    } catch {
      throw new NotFoundException(`Requisition with ID ${id} not found`);
    }
  }
}
