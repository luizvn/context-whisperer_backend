import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../config/database.config';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { requisitionsTable } from './requisition.schema';
import { eq } from 'drizzle-orm';
import { RequisitionStatus } from './requisition.model';

@Injectable()
export class RequisitionsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<Record<string, unknown>>,
  ) {}

  async findById(id: string) {
    const [requisition] = await this.db
      .select()
      .from(requisitionsTable)
      .where(eq(requisitionsTable.id, id));

    if (!requisition) {
      throw new NotFoundException(`Requisition with ID ${id} not found`);
    }

    return requisition;
  }

  async create(userId: string, originalPrompt: string) {
    const [newRequisition] = await this.db
      .insert(requisitionsTable)
      .values({
        userId,
        originalPrompt,
        status: RequisitionStatus.AWAITING_SCOPE,
      })
      .returning();

    return newRequisition;
  }

  async updateStatus(id: string, status: RequisitionStatus) {
    const [updated] = await this.db
      .update(requisitionsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(requisitionsTable.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Requisition with ID ${id} not found`);
    }

    return updated;
  }
}
