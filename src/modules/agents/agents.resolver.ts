import {
  Resolver,
  Mutation,
  Args,
  Subscription,
  Context,
} from '@nestjs/graphql';
import { AgentsService } from './agents.service';
import { CreateProjectInput } from './dto/create-project.input';
import { randomUUID } from 'crypto';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.model';
import { ScopeProposal } from '../scope-proposals/scope-proposal.model';

interface AgentEventPayload {
  scopeGenerated?: ScopeProposal;
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

  @Mutation(() => String, {
    description: 'Inicia o fluxo de criação de um novo projeto via LangGraph',
  })
  @UseGuards(GqlAuthGuard)
  createProject(
    @Args('input') input: CreateProjectInput,
    @CurrentUser() user: User,
    @Context() context: MercuriusContext,
  ): string {
    const threadId = randomUUID();

    console.log(
      '[AgentsResolver] Starting project workflow for thread:',
      threadId,
    );

    const pubSub = context.pubsub || context.reply?.pubsub;

    this.agentsService
      .executeWorkflow(input, threadId, user, pubSub)
      .catch((err: Error) =>
        console.error(
          '[AgentsResolver] Error in workflow for thread:',
          err.message,
        ),
      );

    return threadId;
  }

  @Subscription(() => ScopeProposal, {
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
