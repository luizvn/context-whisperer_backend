import { ApolloDriverConfig } from '@nestjs/apollo';
import { Injectable } from '@nestjs/common';
import { GqlOptionsFactory } from '@nestjs/graphql';
import { join } from 'path';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

@Injectable()
export class GraphqlConfigService implements GqlOptionsFactory {
  createGqlOptions(): ApolloDriverConfig {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      path: '/api/graphql',
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: false,
      introspection: !isProduction,
      plugins: [
        ApolloServerPluginLandingPageLocalDefault({
          embed: true,
        }),
      ],

      context: (request: unknown, reply: unknown) => ({ request, reply }),

      formatError: (error) => {
        const originalError = error.extensions?.originalError as
          | { message?: string; statusCode?: number }
          | undefined;
        return {
          message: originalError?.message ?? error.message,
          code: error.extensions?.code ?? 'INTERNAL_SERVER_ERROR',
          statusCode: originalError?.statusCode ?? 500,
        };
      },
    };
  }
}
