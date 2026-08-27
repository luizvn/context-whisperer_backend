import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../../src/modules/users/user.service';
import { UserRepository } from '../../../src/modules/users/user.repository';
import { User } from '@context-whisperer/database';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;

  const mockFindById = jest.fn();
  const mockFindByEmail = jest.fn();
  const mockCreate = jest.fn();

  const mockUser: User = {
    id: 'user-123',
    name: 'Alice',
    email: 'alice@example.com',
    password: 'hashed_password',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findById: mockFindById,
      findByEmail: mockFindByEmail,
      create: mockCreate,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return a user if found by repository', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);

      const result = await service.findByEmail('alice@example.com');

      expect(mockFindByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should return null if not found', async () => {
      mockFindByEmail.mockResolvedValue(null);

      const result = await service.findByEmail('notfound@example.com');

      expect(mockFindByEmail).toHaveBeenCalledWith('notfound@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user if found by repository', async () => {
      mockFindById.mockResolvedValue(mockUser);

      const result = await service.findById('user-123');

      expect(mockFindById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should return null if not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(mockFindById).toHaveBeenCalledWith('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    const signupData = {
      name: 'Alice',
      email: 'alice@example.com',
      password: 'plain_password',
      role: 'user',
    };

    it('should throw ConflictException if email is already registered', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);

      await expect(service.createUser(signupData)).rejects.toThrow(
        ConflictException,
      );
      expect(mockFindByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should hash password and create user with default role if role not specified', async () => {
      mockFindByEmail.mockResolvedValue(null);
      const mockBcryptHash = jest
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue('hashed_secret' as never);
      mockCreate.mockResolvedValue(mockUser);

      const result = await service.createUser({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'plain_password',
      });

      expect(mockFindByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(mockBcryptHash).toHaveBeenCalledWith('plain_password', 12);
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'hashed_secret',
        role: 'user',
      });
      expect(result).toEqual(mockUser);
    });
  });
});
