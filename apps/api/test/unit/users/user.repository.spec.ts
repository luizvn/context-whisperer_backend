import { UserRepository } from '../../../src/modules/users/user.repository';
import { User } from '@context-whisperer/database';

const mockFindUnique = jest.fn();
const mockCreate = jest.fn();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]): Promise<unknown> =>
        Promise.resolve(mockFindUnique(...args)),
      create: (...args: unknown[]): Promise<unknown> =>
        Promise.resolve(mockCreate(...args)),
    },
  },
}));

describe('UserRepository', () => {
  let repository: UserRepository;

  const mockUser: User = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashed_password',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new UserRepository();
  });

  describe('findById', () => {
    it('should return a user when found by id', async () => {
      mockFindUnique.mockResolvedValue(mockUser);

      const result = await repository.findById('user-123');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user is not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
      });
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return a user when found by email', async () => {
      mockFindUnique.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('john@example.com');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when email does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('unknown@example.com');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: 'unknown@example.com' },
      });
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should call prisma.user.create with correct data and return created user', async () => {
      const createData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashed_password',
        role: 'user',
      };

      mockCreate.mockResolvedValue(mockUser);

      const result = await repository.create(createData);

      expect(mockCreate).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result).toEqual(mockUser);
    });
  });
});
