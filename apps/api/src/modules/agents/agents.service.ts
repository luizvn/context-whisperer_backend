import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ArtifactType,
  CreateProjectInput,
  JobQueuedResponse,
} from '@context-whisperer/core';
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
    const artifacts = projectRequest.artifacts
      ? [...projectRequest.artifacts]
      : [];
    if (!artifacts.includes(ArtifactType.REQUIREMENTS)) {
      artifacts.unshift(ArtifactType.REQUIREMENTS);
    }

    const sanitizedRequest: CreateProjectInput = {
      ...projectRequest,
      artifacts,
    };

    const { id: requisitionId } = await this.requisitionService.create(
      user.id,
      sanitizedRequest.name,
      sanitizedRequest.prompt,
      threadId,
    );

    const job = await this.queue.add('generate-artifacts', {
      projectRequest: sanitizedRequest,
      requisitionId,
      userId: user.id,
      threadId,
    });

    return { jobId: job.id ?? '', status: 'QUEUED', requisitionId };
  }
}
