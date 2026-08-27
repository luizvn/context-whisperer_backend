import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../../src/modules/auth/guards/gql-auth.guard';
import { FastifyRequest } from 'fastify';

describe('GqlAuthGuard', () => {
  let guard: GqlAuthGuard;

  beforeEach(() => {
    guard = new GqlAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('getRequest', () => {
    it('should extract Fastify request from GqlExecutionContext', () => {
      const mockFastifyRequest = {
        headers: { authorization: 'Bearer some_token' },
      } as unknown as FastifyRequest;

      const mockGetContext = jest
        .fn()
        .mockReturnValue({ request: mockFastifyRequest });
      const mockGqlContext = {
        getContext: mockGetContext,
      };

      const createSpy = jest
        .spyOn(GqlExecutionContext, 'create')
        .mockReturnValue(mockGqlContext as unknown as GqlExecutionContext);

      const mockExecutionContext = {} as ExecutionContext;

      const result = guard.getRequest(mockExecutionContext);

      expect(createSpy).toHaveBeenCalledWith(mockExecutionContext);
      expect(mockGetContext).toHaveBeenCalled();
      expect(result).toBe(mockFastifyRequest);
    });
  });
});
