import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AgentsService } from './agents.service';
import { CreateProjectInput, JobQueuedResponse } from '@context-whisperer/core';
import { randomUUID } from 'crypto';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserModel } from '../users/user.model';

@Resolver()
export class AgentsResolver {
  constructor(private readonly agentsService: AgentsService) {}

  @Mutation(() => JobQueuedResponse, {
    description:
      'Inicia o fluxo de criação de um novo projeto via LangGraph inserindo na fila',
  })
  @UseGuards(GqlAuthGuard)
  async createProject(
    @Args('input') input: CreateProjectInput,
    @CurrentUser() user: UserModel,
  ): Promise<JobQueuedResponse> {
    const threadId = randomUUID();

    console.log(
      '[AgentsResolver] Enqueueing project workflow for thread:',
      threadId,
    );

    const result = await this.agentsService.executeWorkflow(
      input,
      threadId,
      user,
    );

    return result;
  }
}
