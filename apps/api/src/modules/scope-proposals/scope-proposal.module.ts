import { Module } from '@nestjs/common';
import { ScopeProposalService } from './scope-proposal.service';
import { DatabaseModule } from '../../config/database.module';
import { ScopeProposalRepository } from './scope-proposal.repository';
import { ScopeProposalResolver } from './scope-proposal.resolver';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [DatabaseModule, EventsModule],
  providers: [
    ScopeProposalRepository,
    ScopeProposalService,
    ScopeProposalResolver,
  ],
  exports: [ScopeProposalService],
})
export class ScopeProposalsModule {}
