import { Module } from '@nestjs/common';
import { RequisitionsService } from './requisitions.service';
import { DatabaseModule } from '../../config/database.module';

import { RequisitionRepository } from './requisition.repository';

@Module({
  imports: [DatabaseModule],
  providers: [RequisitionRepository, RequisitionsService],
  exports: [RequisitionsService],
})
export class RequisitionsModule {}
