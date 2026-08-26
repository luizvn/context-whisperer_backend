import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsResolver } from './agents.resolver';
import { OpenAIModule } from '../../config/openai/openai.module';
import { ScopeProposalsModule } from '../scope-proposals/scope-proposal.module';
import { RequisitionsModule } from '../requisitions/requisitions.module';

import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    OpenAIModule,
    ScopeProposalsModule,
    RequisitionsModule,
    BullModule.registerQueue({
      name: 'ai-generation',
    }),
  ],
  providers: [AgentsService, AgentsResolver],
  exports: [AgentsService],
})
export class AgentsModule {}
