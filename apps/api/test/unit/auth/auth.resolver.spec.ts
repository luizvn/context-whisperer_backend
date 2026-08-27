import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from '../../../src/modules/auth/auth.resolver';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { UsersService } from '../../../src/modules/users/user.service';
import { UserModel } from '../../../src/modules/users/user.model';
import { AuthResponse } from '../../../src/modules/auth/dto/auth.response';
import { User } from '@context-whisperer/database';

describe('AuthResolver', () => {
  let resolver: AuthResolver;

  const mockValidateUser = jest.fn();
  const mockLogin = jest.fn();
  const mockCreateUser = jest.fn();

  const mockUserModel: UserModel = {
    id: 'user-123',
    name: 'Charlie',
    email: 'charlie@example.com',
    role: 'user',
    createdAt: new Date(),
  };

  const mockDbUser: User = {
    id: 'user-123',
    name: 'Charlie',
    email: 'charlie@example.com',
    password: 'hashed_password',
    role: 'user',
    createdAt: mockUserModel.createdAt,
    updatedAt: new Date(),
  };

  const mockAuthResponse: AuthResponse = {
    accessToken: 'jwt_token_123',
    user: mockUserModel,
  };

  beforeEach(async () => {
    const mockAuthService = {
      validateUser: mockValidateUser,
      login: mockLogin,
    };

    const mockUsersService = {
      createUser: mockCreateUser,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('login', () => {
    it('should validate user credentials and return AuthResponse', async () => {
      mockValidateUser.mockResolvedValue(mockUserModel);
      mockLogin.mockReturnValue(mockAuthResponse);

      const result = await resolver.login({
        email: 'charlie@example.com',
        password: 'password123',
      });

      expect(mockValidateUser).toHaveBeenCalledWith(
        'charlie@example.com',
        'password123',
      );
      expect(mockLogin).toHaveBeenCalledWith(mockUserModel);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      mockValidateUser.mockResolvedValue(null);

      await expect(
        resolver.login({
          email: 'charlie@example.com',
          password: 'wrong_password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockValidateUser).toHaveBeenCalledWith(
        'charlie@example.com',
        'wrong_password',
      );
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('signup', () => {
    it('should create user and return AuthResponse from login', async () => {
      mockCreateUser.mockResolvedValue(mockDbUser);
      mockLogin.mockReturnValue(mockAuthResponse);

      const result = await resolver.signup({
        name: 'Charlie',
        email: 'charlie@example.com',
        password: 'password123',
      });

      expect(mockCreateUser).toHaveBeenCalledWith({
        name: 'Charlie',
        email: 'charlie@example.com',
        password: 'password123',
      });
      expect(mockLogin).toHaveBeenCalledWith(mockDbUser);
      expect(result).toEqual(mockAuthResponse);
    });
  });
});
