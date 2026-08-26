import { Module } from '@nestjs/common';
import { ScopeProposalService } from './scope-proposal.service';
import { DatabaseModule } from '../../config/database.module';

import { ScopeProposalRepository } from './scope-proposal.repository';

@Module({
  imports: [DatabaseModule],
  providers: [ScopeProposalRepository, ScopeProposalService],
  exports: [ScopeProposalService],
})
export class ScopeProposalsModule {}
