import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService, User } from './user.service';
import { usersTable } from './user.schema';

jest.mock(
  'bcrypt',
  () => ({
    compare: jest.fn(),
    hash: jest.fn(),
  }),
  { virtual: true },
);

type SelectChain = {
  from: jest.Mock;
  where: jest.Mock;
};

type InsertChain = {
  values: jest.Mock;
  returning: jest.Mock;
};

const createSelectChain = (rows: User[]): SelectChain => {
  const chain: SelectChain = {
    from: jest.fn(),
    where: jest.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  return chain;
};

const createInsertChain = (rows: User[]): InsertChain => {
  const chain: InsertChain = {
    values: jest.fn(),
    returning: jest.fn().mockResolvedValue(rows),
  };
  chain.values.mockReturnValue(chain);
  return chain;
};

describe('UsersService', () => {
  let db: {
    select: jest.Mock;
    insert: jest.Mock;
  };
  let service: UsersService;

  const user: User = {
    id: 'user-1',
    name: 'Katherine Johnson',
    email: 'katherine@example.com',
    password: 'hashed-password',
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    db = {
      select: jest.fn(),
      insert: jest.fn(),
    };
    service = new UsersService(db as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('finds a user by email', async () => {
    const selectChain = createSelectChain([user]);
    db.select.mockReturnValue(selectChain);

    await expect(service.findByEmail(user.email)).resolves.toBe(user);
    expect(selectChain.from).toHaveBeenCalledWith(usersTable);
  });

  it('returns null when no user exists for the email', async () => {
    db.select.mockReturnValue(createSelectChain([]));

    await expect(
      service.findByEmail('missing@example.com'),
    ).resolves.toBeNull();
  });

  it('finds a user by id', async () => {
    db.select.mockReturnValue(createSelectChain([user]));

    await expect(service.findById(user.id)).resolves.toBe(user);
  });

  it('creates a user with a hashed password and default role', async () => {
    jest.spyOn(service, 'findByEmail').mockResolvedValue(null);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hash' as never);
    const insertChain = createInsertChain([user]);
    db.insert.mockReturnValue(insertChain);

    await expect(
      service.createUser({
        name: user.name,
        email: user.email,
        password: 'secret123',
      }),
    ).resolves.toBe(user);

    expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 12);
    expect(db.insert).toHaveBeenCalledWith(usersTable);
    expect(insertChain.values).toHaveBeenCalledWith({
      name: user.name,
      email: user.email,
      password: 'new-hash',
      role: 'user',
    });
  });

  it('throws a conflict when the email is already registered', async () => {
    jest.spyOn(service, 'findByEmail').mockResolvedValue(user);
    const hashSpy = jest.spyOn(bcrypt, 'hash');

    await expect(
      service.createUser({
        name: user.name,
        email: user.email,
        password: 'secret123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(hashSpy).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
});
