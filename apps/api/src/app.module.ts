import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, MercuriusDriverConfig } from '@nestjs/mercurius';
import { GraphqlConfigService } from './config/graphql.config';
import { DatabaseModule } from './config/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/user.module';
import { AgentsModule } from './modules/agents/agents.module';
import { OpenAIModule } from './config/openai/openai.module';
import { RequisitionsModule } from './modules/requisitions/requisitions.module';
import { ScopeProposalsModule } from './modules/scope-proposals/scope-proposal.module';
import { EventsModule } from './modules/events/events.module';

import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRootAsync({
      useFactory: () => {
        const isProduction = process.env.NODE_ENV === 'production';
        return {
          pinoHttp: {
            level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
            transport: !isProduction
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
          },
        };
      },
    }),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
        },
      }),
    }),
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
    EventsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
