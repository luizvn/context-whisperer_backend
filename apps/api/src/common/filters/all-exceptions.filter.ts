import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { GqlArgumentsHost, GqlContextType } from '@nestjs/graphql';
import { GraphQLError, GraphQLResolveInfo } from 'graphql';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): unknown {
    const isGraphQL = host.getType<GqlContextType>() === 'graphql';

    // 1. Resolve status code, message and error type
    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorType = 'Internal Server Error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const resObj = response as Record<string, unknown>;
        message = (resObj.message as string) || exception.message;
        errorType = (resObj.error as string) || errorType;
        details = resObj.details;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      // Unhandled error: default 500 fallback, sanitize message to avoid leaking internals
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      errorType = 'Internal Server Error';
    }

    const timestamp = new Date().toISOString();

    // 2. Structured logging via Pino
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception [${status}]: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`Client exception [${status}]: ${message}`);
    }

    // 3. Handle GraphQL context (Mercurius)
    if (isGraphQL) {
      const gqlHost = GqlArgumentsHost.create(host);
      const info = gqlHost.getInfo<GraphQLResolveInfo | undefined>();

      return new GraphQLError(message, {
        path: info?.path ? [String(info.path.key)] : undefined,
        extensions: {
          code: this.getGraphQLCode(status),
          statusCode: status,
          error: errorType,
          timestamp,
          ...(details ? { details } : {}),
        },
      });
    }

    // 4. Handle HTTP / REST context (Fastify)
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const responseBody = {
      statusCode: status,
      error: errorType,
      message,
      timestamp,
      path: request?.url ?? '',
      ...(details ? { details } : {}),
    };

    return response.status(status).send(responseBody);
  }

  private getGraphQLCode(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
