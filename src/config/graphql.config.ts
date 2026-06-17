import { MercuriusDriverConfig } from '@nestjs/mercurius';
import { Injectable } from '@nestjs/common';
import { GqlOptionsFactory } from '@nestjs/graphql';
import { join } from 'path';
import { FastifyRequest } from 'fastify';

@Injectable()
export class GraphqlConfigService implements GqlOptionsFactory {
  createGqlOptions(): MercuriusDriverConfig {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      path: '/api/graphql',
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      graphiql: !isProduction,
      subscription: {
        context: (connection: any, request: FastifyRequest) => {
          return {
            request,
            connection,

            pubsub:
              request?.server?.graphql?.pubsub ||
              connection?._socket?.server?.graphql?.pubsub,
          };
        },
      },
      context: (request: FastifyRequest, reply: unknown) => ({
        request,
        reply,
      }),
      errorFormatter: (execution) => {
        return {
          statusCode: 200,
          response: {
            errors: execution.errors,
            data: execution.data,
          },
        };
      },
    };
  }
}
