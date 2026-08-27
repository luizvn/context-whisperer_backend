import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ScopeProposalModel } from './scope-proposal.model';
import { ScopeProposalService } from './scope-proposal.service';
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
    private readonly eventsService: EventsService,
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

    // Emite notificação SSE para os clientes conectados do usuário
    await this.eventsService.publishUserEvent(user.id, {
      type: SseEventType.SCOPE_APPROVED,
      userId: user.id,
      requisitionId: proposal.requisitionId,
      timestamp: new Date().toISOString(),
      data: proposal,
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

    // Emite notificação SSE para os clientes conectados do usuário
    await this.eventsService.publishUserEvent(user.id, {
      type: SseEventType.SCOPE_REJECTED,
      userId: user.id,
      requisitionId: proposal.requisitionId,
      timestamp: new Date().toISOString(),
      data: proposal,
    });

    return proposal;
  }
}
