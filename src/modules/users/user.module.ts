import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../config/database.module';
import { UsersService } from './user.service';
import { UserResolver } from './user.resolver';

@Module({
  imports: [DatabaseModule],
  providers: [UsersService, UserResolver],
  exports: [UsersService],
})
export class UsersModule {}
