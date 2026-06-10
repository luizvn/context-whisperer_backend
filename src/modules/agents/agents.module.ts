import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsResolver } from './agents.resolver';
import { OpenAIModule } from '../../openai/openai.module';
import { ScopeProposalsModule } from '../scope-proposals/scope-proposal.module';
import { RequisitionsModule } from '../requisitions/requisitions.module';

@Module({
  imports: [OpenAIModule, ScopeProposalsModule, RequisitionsModule],
  providers: [AgentsService, AgentsResolver],
  exports: [AgentsService],
})
export class AgentsModule {}
