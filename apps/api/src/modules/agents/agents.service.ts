import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateProjectInput, JobQueuedResponse } from '@context-whisperer/core';
import { UserModel } from '../users/user.model';
import { RequisitionsService } from '../requisitions/requisitions.service';

@Injectable()
export class AgentsService {
  constructor(
    @InjectQueue('ai-generation') private readonly queue: Queue,
    private readonly requisitionService: RequisitionsService,
  ) {}

  async executeWorkflow(
    projectRequest: CreateProjectInput,
    threadId: string,
    user: UserModel,
  ): Promise<JobQueuedResponse> {
    const { id: requisitionId } = await this.requisitionService.create(
      user.id,
      projectRequest.prompt,
    );

    const job = await this.queue.add('generate-artifacts', {
      projectRequest,
      requisitionId,
      userId: user.id,
      threadId,
    });

    return { jobId: job.id ?? '', status: 'QUEUED', requisitionId };
  }
}
