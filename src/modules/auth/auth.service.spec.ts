import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService, User } from '../users/user.service';

jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn() }), { virtual: true });
jest.mock(
  'bcrypt',
  () => ({
    compare: jest.fn(),
    hash: jest.fn(),
  }),
  { virtual: true },
);

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;

  const user: User = {
    id: 'user-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'hashed-password',
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    usersService = {
      findByEmail: jest.fn(),
    };
    jwtService = {
      sign: jest.fn(),
    };

    service = new AuthService(
      usersService as UsersService,
      jwtService as JwtService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates credentials and removes the password from the returned user', async () => {
    usersService.findByEmail.mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    await expect(
      service.validateUser(user.email, 'plain-password'),
    ).resolves.toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'plain-password',
      user.password,
    );
  });

  it('returns null when the user is not found', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    const compareSpy = jest.spyOn(bcrypt, 'compare');

    await expect(
      service.validateUser('missing@example.com', 'password'),
    ).resolves.toBeNull();
    expect(compareSpy).not.toHaveBeenCalled();
  });

  it('returns null when the password does not match', async () => {
    usersService.findByEmail.mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(
      service.validateUser(user.email, 'wrong-password'),
    ).resolves.toBeNull();
  });

  it('signs the JWT payload and returns the authenticated user', () => {
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
    jwtService.sign.mockReturnValue('jwt-token');

    expect(service.login(safeUser)).toEqual({
      accessToken: 'jwt-token',
      user: safeUser,
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      email: safeUser.email,
      sub: safeUser.id,
    });
  });
});
