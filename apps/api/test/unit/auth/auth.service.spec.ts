import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { UsersService } from '../../../src/modules/users/user.service';
import { UserModel } from '../../../src/modules/users/user.model';
import { User } from '@context-whisperer/database';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockFindByEmail = jest.fn();
  const mockCreateUser = jest.fn();
  const mockFindById = jest.fn();
  const mockJwtSign = jest.fn();

  const mockDbUser: User = {
    id: 'user-123',
    name: 'Charlie',
    email: 'charlie@example.com',
    password: 'hashed_password',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserModel: UserModel & { updatedAt: Date } = {
    id: 'user-123',
    name: 'Charlie',
    email: 'charlie@example.com',
    role: 'user',
    createdAt: mockDbUser.createdAt,
    updatedAt: mockDbUser.updatedAt,
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: mockFindByEmail,
      createUser: mockCreateUser,
      findById: mockFindById,
    };

    const mockJwtService = {
      sign: mockJwtSign,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password when email and password match', async () => {
      mockFindByEmail.mockResolvedValue(mockDbUser);
      const mockBcryptCompare = jest
        .spyOn(bcrypt, 'compare')
        .mockResolvedValue(true as never);

      const result = await service.validateUser(
        'charlie@example.com',
        'correct_pass',
      );

      expect(mockFindByEmail).toHaveBeenCalledWith('charlie@example.com');
      expect(mockBcryptCompare).toHaveBeenCalledWith(
        'correct_pass',
        'hashed_password',
      );
      expect(result).toEqual(mockUserModel);
      expect(result).not.toHaveProperty('password');
    });

    it('should return null if user is not found', async () => {
      mockFindByEmail.mockResolvedValue(null);
      const mockBcryptCompare = jest.spyOn(bcrypt, 'compare');

      const result = await service.validateUser(
        'unknown@example.com',
        'any_pass',
      );

      expect(mockFindByEmail).toHaveBeenCalledWith('unknown@example.com');
      expect(mockBcryptCompare).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null if password does not match', async () => {
      mockFindByEmail.mockResolvedValue(mockDbUser);
      const mockBcryptCompare = jest
        .spyOn(bcrypt, 'compare')
        .mockResolvedValue(false as never);

      const result = await service.validateUser(
        'charlie@example.com',
        'wrong_pass',
      );

      expect(mockFindByEmail).toHaveBeenCalledWith('charlie@example.com');
      expect(mockBcryptCompare).toHaveBeenCalledWith(
        'wrong_pass',
        'hashed_password',
      );
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should generate an accessToken and return AuthResponse', () => {
      mockJwtSign.mockReturnValue('jwt_token_xyz');

      const result = service.login(mockUserModel);

      expect(mockJwtSign).toHaveBeenCalledWith({
        email: mockUserModel.email,
        sub: mockUserModel.id,
      });
      expect(result).toEqual({
        accessToken: 'jwt_token_xyz',
        user: mockUserModel,
      });
    });
  });
});
