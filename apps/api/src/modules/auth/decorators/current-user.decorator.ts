import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { FastifyRequest } from 'fastify';
import { UserModel } from '../../users/user.model';

export interface RequestWithUser extends FastifyRequest {
  user: UserModel;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);

    const graphqlContext = ctx.getContext<{ request: RequestWithUser }>();

    return graphqlContext.request.user;
  },
);
