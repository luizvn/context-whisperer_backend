import { Module } from '@nestjs/common';
import { RequisitionsService } from './requisitions.service';
import { DatabaseModule } from '../../config/database.module';

import { RequisitionRepository } from './requisition.repository';
import { RequisitionsResolver } from './requisitions.resolver';

@Module({
  imports: [DatabaseModule],
  providers: [RequisitionRepository, RequisitionsService, RequisitionsResolver],
  exports: [RequisitionsService, RequisitionRepository],
})
export class RequisitionsModule {}
