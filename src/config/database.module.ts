import { Global, Module } from '@nestjs/common';
import { databaseProvider, DATABASE_CONNECTION } from './database.config';

@Global()
@Module({
  providers: [databaseProvider],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
