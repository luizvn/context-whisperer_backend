import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphqlConfigService } from './config/graphql.config';
import { DatabaseModule } from './config/database.module';
import { UserResolver } from './modules/users/user.resolver';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useClass: GraphqlConfigService,
    }),
    DatabaseModule,
  ],
  controllers: [],
  providers: [UserResolver],
})
export class AppModule {}
