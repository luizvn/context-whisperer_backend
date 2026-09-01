import { Injectable } from '@nestjs/common';
import { RequisitionModel, RequisitionStatus } from './requisition.model';
import { RequisitionRepository } from './requisition.repository';
import { EntityNotFoundException } from '../../common/exceptions';

@Injectable()
export class RequisitionsService {
  constructor(private readonly requisitionRepository: RequisitionRepository) {}

  async findById(id: string): Promise<RequisitionModel> {
    const requisition = await this.requisitionRepository.findById(id);

    if (!requisition) {
      throw new EntityNotFoundException('Requisition', id);
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
      throw new EntityNotFoundException('Requisition', id);
    }
  }
}
