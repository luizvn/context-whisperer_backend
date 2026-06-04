import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../config/database.module';
import { UsersService } from './user.service';

@Module({
  imports: [DatabaseModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
