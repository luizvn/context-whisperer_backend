import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../config/database.module';
import { RequisitionsModule } from '../requisitions/requisitions.module';
import { ArtifactRepository } from './artifact.repository';
import { ArtifactsService } from './artifacts.service';
import { ArtifactsResolver } from './artifacts.resolver';

@Module({
  imports: [DatabaseModule, RequisitionsModule],
  providers: [ArtifactRepository, ArtifactsService, ArtifactsResolver],
  exports: [ArtifactsService, ArtifactRepository],
})
export class ArtifactsModule {}
