import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, MercuriusDriverConfig } from '@nestjs/mercurius';
import { GraphqlConfigService } from './config/graphql.config';
import { DatabaseModule } from './config/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/user.module';
import { AgentsModule } from './modules/agents/agents.module';
import { OpenAIModule } from './openai/openai.module';
import { RequisitionsModule } from './modules/requisitions/requisitions.module';
import { ScopeProposalsModule } from './modules/scope-proposals/scope-proposal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRootAsync<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      useClass: GraphqlConfigService,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    AgentsModule,
    OpenAIModule,
    RequisitionsModule,
    ScopeProposalsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
