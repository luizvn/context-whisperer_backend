import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ScopeProposalModel } from './scope-proposal.model';
import { ScopeProposalService } from './scope-proposal.service';
import { RequisitionsService } from '../requisitions/requisitions.service';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserModel } from '../users/user.model';
import { EventsService } from '../events/events.service';
import { SseEventType } from '@context-whisperer/core';

@Resolver(() => ScopeProposalModel)
@UseGuards(GqlAuthGuard)
export class ScopeProposalResolver {
  constructor(
    private readonly scopeProposalService: ScopeProposalService,
    private readonly requisitionsService: RequisitionsService,
    private readonly eventsService: EventsService,
    @InjectQueue('ai-generation') private readonly queue: Queue,
  ) {}

  @Query(() => ScopeProposalModel, {
    name: 'scopeProposal',
    description: 'Busca uma proposta de escopo pelo ID',
  })
  async getScopeProposal(@Args('id') id: string): Promise<ScopeProposalModel> {
    return this.scopeProposalService.findById(id);
  }

  @Mutation(() => ScopeProposalModel, {
    description:
      'Aprova uma proposta de escopo e sinaliza para prosseguir a geração de artefatos',
  })
  async approveScopeProposal(
    @Args('id') id: string,
    @CurrentUser() user: UserModel,
  ): Promise<ScopeProposalModel> {
    const proposal = await this.scopeProposalService.approve(id);
    const requisition = await this.requisitionsService.findById(
      proposal.requisitionId,
    );

    const threadId = requisition.threadId || proposal.requisitionId;

    // Emite notificação SSE para os clientes conectados do usuário
    await this.eventsService.publishUserEvent(user.id, {
      type: SseEventType.SCOPE_APPROVED,
      userId: user.id,
      requisitionId: proposal.requisitionId,
      threadId,
      timestamp: new Date().toISOString(),
      data: proposal,
    });

    // Enfileira retomada do workflow no BullMQ
    await this.queue.add('process-hitl', {
      action: 'APPROVE',
      requisitionId: proposal.requisitionId,
      threadId,
      userId: user.id,
    });

    return proposal;
  }

  @Mutation(() => ScopeProposalModel, {
    description:
      'Recusa uma proposta de escopo e envia o feedback do usuário para refinamento',
  })
  async rejectScopeProposal(
    @Args('id') id: string,
    @Args('feedback') feedback: string,
    @CurrentUser() user: UserModel,
  ): Promise<ScopeProposalModel> {
    const proposal = await this.scopeProposalService.reject(id, feedback);
    const requisition = await this.requisitionsService.findById(
      proposal.requisitionId,
    );

    const threadId = requisition.threadId || proposal.requisitionId;

    // Emite notificação SSE para os clientes conectados do usuário
    await this.eventsService.publishUserEvent(user.id, {
      type: SseEventType.SCOPE_REJECTED,
      userId: user.id,
      requisitionId: proposal.requisitionId,
      threadId,
      timestamp: new Date().toISOString(),
      data: proposal,
    });

    // Enfileira retomada do workflow para re-refinamento com feedback
    await this.queue.add('process-hitl', {
      action: 'REJECT',
      feedback,
      requisitionId: proposal.requisitionId,
      threadId,
      userId: user.id,
    });

    return proposal;
  }
}
