import { SseAuthGuard } from '../../../src/modules/events/guards/sse-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../../src/modules/users/user.service';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { User } from '@context-whisperer/database';

describe('SseAuthGuard', () => {
  let guard: SseAuthGuard;
  const mockVerifyAsync = jest.fn();
  const mockFindById = jest.fn();

  const mockUser: User = {
    id: 'user-guard-123',
    name: 'Trinity',
    email: 'trinity@matrix.org',
    password: 'hash',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAsync.mockResolvedValue({
      sub: 'user-guard-123',
      email: 'trinity@matrix.org',
    });

    const jwtService = {
      verifyAsync: mockVerifyAsync,
    } as unknown as JwtService;

    const configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;

    mockFindById.mockResolvedValue(mockUser);
    const usersService = {
      findById: mockFindById,
    } as unknown as UsersService;

    guard = new SseAuthGuard(jwtService, configService, usersService);
  });

  const createMockContext = (
    headers: Record<string, string> = {},
    query: Record<string, string> = {},
  ) => {
    const request: {
      headers: Record<string, string>;
      query: Record<string, string>;
      user?: unknown;
    } = {
      headers,
      query,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should authenticate successfully with Authorization Bearer header', async () => {
    const context = createMockContext({
      authorization: 'Bearer valid-jwt-token',
    });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockVerifyAsync).toHaveBeenCalledWith('valid-jwt-token', {
      secret: 'test-secret',
    });
    expect(mockFindById).toHaveBeenCalledWith('user-guard-123');
  });

  it('should authenticate successfully with query parameter ?token=...', async () => {
    const context = createMockContext({}, { token: 'valid-query-token' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockVerifyAsync).toHaveBeenCalledWith('valid-query-token', {
      secret: 'test-secret',
    });
  });

  it('should throw UnauthorizedException when no token is present', async () => {
    const context = createMockContext({}, {});
    const promise = guard.canActivate(context);
    await expect(promise).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token verification fails', async () => {
    mockVerifyAsync.mockRejectedValue(new Error('Invalid token'));
    const context = createMockContext({
      authorization: 'Bearer invalid-token',
    });

    const promise = guard.canActivate(context);
    await expect(promise).rejects.toThrow(UnauthorizedException);
  });
});
