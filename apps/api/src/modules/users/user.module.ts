import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../config/database.module';
import { UsersService } from './user.service';
import { UserResolver } from './user.resolver';

import { UserRepository } from './user.repository';

@Module({
  imports: [DatabaseModule],
  providers: [UserRepository, UsersService, UserResolver],
  exports: [UsersService],
})
export class UsersModule {}
