import { Module } from '@nestjs/common';
import { ScopeProposalService } from './scope-proposal.service';
import { DatabaseModule } from '../../config/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ScopeProposalService],
  exports: [ScopeProposalService],
})
export class ScopeProposalsModule {}
