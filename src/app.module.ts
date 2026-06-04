import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphqlConfigService } from './config/graphql.config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './config/database.module';
import { UserResolver } from './modules/users/user.resolver';
import {ConfigModule } from '@nestjs/config'
import { AgentsModule } from './agents/agents.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.local'] }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useClass: GraphqlConfigService,
    }),
    DatabaseModule,
    AuthModule,
    AgentsModule,
  ],
  controllers: [],
  providers: [UserResolver],
})
export class AppModule {}
