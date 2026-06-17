import { UnauthorizedException } from '@nestjs/common';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { UsersService } from '../users/user.service';
import type { User } from '../users/user.service';

jest.mock('./auth.service', () => ({ AuthService: jest.fn() }));
jest.mock('../users/user.service', () => ({ UsersService: jest.fn() }));

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: jest.Mocked<Pick<AuthService, 'validateUser' | 'login'>>;
  let usersService: jest.Mocked<Pick<UsersService, 'createUser'>>;

  const user: Omit<User, 'password'> = {
    id: 'user-1',
    name: 'Grace Hopper',
    email: 'grace@example.com',
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    authService = {
      validateUser: jest.fn(),
      login: jest.fn(),
    };
    usersService = {
      createUser: jest.fn(),
    };

    resolver = new AuthResolver(
      authService as AuthService,
      usersService as UsersService,
    );
  });

  it('logs in a valid user', async () => {
    authService.validateUser.mockResolvedValue(user);
    authService.login.mockReturnValue({ accessToken: 'token', user });

    await expect(
      resolver.login({ email: user.email, password: 'secret123' }),
    ).resolves.toEqual({ accessToken: 'token', user });
    expect(authService.validateUser).toHaveBeenCalledWith(
      user.email,
      'secret123',
    );
  });

  it('rejects invalid credentials', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(
      resolver.login({ email: user.email, password: 'wrong123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('creates a user and returns a login response on signup', async () => {
    usersService.createUser.mockResolvedValue({ ...user, password: 'hashed' });
    authService.login.mockReturnValue({ accessToken: 'token', user });

    await expect(
      resolver.signup({
        name: user.name,
        email: user.email,
        password: 'secret123',
      }),
    ).resolves.toEqual({ accessToken: 'token', user });
    expect(usersService.createUser).toHaveBeenCalledWith({
      name: user.name,
      email: user.email,
      password: 'secret123',
    });
  });
});
