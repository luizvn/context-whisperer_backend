import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '../../../src/modules/auth/strategies/jwt.strategy';
import { UsersService } from '../../../src/modules/users/user.service';
import { User } from '@context-whisperer/database';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockFindById = jest.fn();

  const mockUser: User = {
    id: 'user-123',
    name: 'David',
    email: 'david@example.com',
    password: 'hashed_password',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findById: mockFindById,
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when payload sub matches an existing user', async () => {
      mockFindById.mockResolvedValue(mockUser);

      const result = await strategy.validate({ sub: 'user-123' });

      expect(mockFindById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(strategy.validate({ sub: 'non-existent' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockFindById).toHaveBeenCalledWith('non-existent');
    });
  });
});
