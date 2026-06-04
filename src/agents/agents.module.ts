import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ConfigModule } from '@nestjs/config';
import { AgentsController } from './agents.controller';

@Module({
  imports: [ConfigModule],
  providers: [AgentsService],
  exports: [AgentsService],
  controllers: [AgentsController]
})
export class AgentsModule {}
