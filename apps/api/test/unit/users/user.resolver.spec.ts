import { Test, TestingModule } from '@nestjs/testing';
import { UserResolver } from '../../../src/modules/users/user.resolver';
import { UserModel } from '../../../src/modules/users/user.model';

describe('UserResolver', () => {
  let resolver: UserResolver;

  const mockUserModel: UserModel = {
    id: 'user-123',
    name: 'Bob',
    email: 'bob@example.com',
    role: 'user',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserResolver],
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('me', () => {
    it('should return the current user passed by decorator', () => {
      const result = resolver.me(mockUserModel);
      expect(result).toEqual(mockUserModel);
    });
  });
});
