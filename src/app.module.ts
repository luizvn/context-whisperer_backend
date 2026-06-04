import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphqlConfigService } from './config/graphql.config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './config/database.module';
import { UserResolver } from './modules/users/user.resolver';
import {ConfigModule } from '@nestjs/config'
import { AgentsModule } from './agents/agents.module';
import { OpenAIModule } from './openai/openai.module';

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
    OpenAIModule,
  ],
  controllers: [],
  providers: [UserResolver],
})
export class AppModule {}
