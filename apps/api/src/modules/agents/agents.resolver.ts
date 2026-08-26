import {
  Resolver,
  Mutation,
  Args,
  Subscription,
  Context,
} from '@nestjs/graphql';
import { AgentsService } from './agents.service';
import { CreateProjectInput, JobQueuedResponse } from '@context-whisperer/core';
import { randomUUID } from 'crypto';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserModel } from '../users/user.model';
import { ScopeProposalModel } from '../scope-proposals/scope-proposal.model';

interface AgentEventPayload {
  scopeGenerated?: ScopeProposalModel;
  threadId?: string;
  type?: string;
}

interface MercuriusContext {
  pubsub: {
    publish: (params: { topic: string; payload: any }) => void;

    subscribe: (topic: string) => Promise<AsyncIterableIterator<any>>;
  };
  reply?: {
    pubsub: any;
  };
  connection?: {
    server?: {
      app?: {
        graphql?: {
          pubsub?: any;
        };
      };
    };
  };
}

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
    @Context() _context: MercuriusContext,
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

  @Subscription(() => ScopeProposalModel, {
    nullable: true,
    description:
      'Recebe eventos de agentes para o usuário (via parâmetro livre)',
    resolve: (payload: AgentEventPayload | undefined) => {
      return payload?.scopeGenerated ?? null;
    },
  })
  agentEvents(
    @Args('userId') userId: string,
    @Context() context: MercuriusContext,
  ): Promise<AsyncIterableIterator<any>> {
    console.log(
      '[Subscription] Anonymous subscription created for USER_EVENTS_' + userId,
    );

    const pubSub =
      context.pubsub ||
      context.reply?.pubsub ||
      context.connection?.server?.app?.graphql?.pubsub;

    return pubSub.subscribe('USER_EVENTS_' + userId);
  }
}
