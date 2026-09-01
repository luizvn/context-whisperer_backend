import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, MercuriusDriverConfig } from '@nestjs/mercurius';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AuthResolver } from '../../src/modules/auth/auth.resolver';
import { AuthService } from '../../src/modules/auth/auth.service';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { GqlAuthGuard } from '../../src/modules/auth/guards/gql-auth.guard';
import { UserResolver } from '../../src/modules/users/user.resolver';
import { UsersService } from '../../src/modules/users/user.service';
import { UserRepository } from '../../src/modules/users/user.repository';
import { User } from '@context-whisperer/database';
import { FastifyRequest } from 'fastify';

describe('Auth & Users GraphQL Integration Test (Fastify + Mercurius)', () => {
  let app: NestFastifyApplication;
  const inMemoryUsers: Map<string, User> = new Map();

  const mockUserRepository = {
    findByEmail: jest.fn((email: string) => {
      for (const user of inMemoryUsers.values()) {
        if (user.email === email) return Promise.resolve(user);
      }
      return Promise.resolve(null);
    }),
    findById: jest.fn((id: string) => {
      return Promise.resolve(inMemoryUsers.get(id) ?? null);
    }),
    create: jest.fn(
      (data: {
        name: string;
        email: string;
        password: string;
        role: string;
      }) => {
        const id = `user-${Date.now()}`;
        const newUser: User = {
          id,
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryUsers.set(id, newUser);
        return Promise.resolve(newUser);
      },
    ),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_SECRET: 'test-secret-key-1234' })],
        }),
        JwtModule.register({
          secret: 'test-secret-key-1234',
          signOptions: { expiresIn: '1h' },
        }),
        GraphQLModule.forRoot<MercuriusDriverConfig>({
          driver: MercuriusDriver,
          autoSchemaFile: true,
          graphiql: false,
          cache: false,
          jit: 0,
          context: (request: FastifyRequest) => ({ request }),
        }),
      ],
      providers: [
        AuthResolver,
        AuthService,
        JwtStrategy,
        GqlAuthGuard,
        UserResolver,
        UsersService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    inMemoryUsers.clear();
  });

  it('should successfully signup a new user and return a JWT access token', async () => {
    const signupMutation = `
      mutation {
        signup(signupInput: {
          name: "Alice Doe",
          email: "alice@example.com",
          password: "password123"
        }) {
          accessToken
          user {
            id
            name
            email
            role
          }
        }
      }
    `;

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: signupMutation },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data?: {
        signup: {
          accessToken: string;
          user: { id: string; name: string; email: string; role: string };
        };
      };
      errors?: unknown[];
    };

    expect(body.errors).toBeUndefined();
    expect(body.data?.signup.accessToken).toBeDefined();
    expect(body.data?.signup.user.name).toBe('Alice Doe');
    expect(body.data?.signup.user.email).toBe('alice@example.com');
  });

  it('should login an existing user and authenticate with query "me"', async () => {
    // 1. Signup user first
    const signupMutation = `
      mutation {
        signup(signupInput: {
          name: "Bob Builder",
          email: "bob@example.com",
          password: "securepassword"
        }) {
          accessToken
        }
      }
    `;

    await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: signupMutation },
    });

    // 2. Login
    const loginMutation = `
      mutation {
        login(loginInput: {
          email: "bob@example.com",
          password: "securepassword"
        }) {
          accessToken
          user {
            id
            email
            name
          }
        }
      }
    `;

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: loginMutation },
    });

    const loginBody = JSON.parse(loginResponse.body) as {
      data?: {
        login: {
          accessToken: string;
          user: { id: string; name: string; email: string };
        };
      };
    };

    expect(loginBody.data?.login.accessToken).toBeDefined();
    const token = loginBody.data?.login.accessToken;

    // 3. Query me using Authorization Bearer token
    const meQuery = `
      query {
        me {
          id
          name
          email
        }
      }
    `;

    const meResponse = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: { query: meQuery },
    });

    expect(meResponse.statusCode).toBe(200);
    const meBody = JSON.parse(meResponse.body) as {
      data?: {
        me: { id: string; name: string; email: string };
      };
      errors?: unknown[];
    };

    expect(meBody.errors).toBeUndefined();
    expect(meBody.data?.me.email).toBe('bob@example.com');
    expect(meBody.data?.me.name).toBe('Bob Builder');
  });

  it('should return error when logging in with invalid credentials', async () => {
    const loginMutation = `
      mutation {
        login(loginInput: {
          email: "nonexistent@example.com",
          password: "wrongpassword"
        }) {
          accessToken
        }
      }
    `;

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: loginMutation },
    });

    const body = JSON.parse(response.body) as {
      errors?: Array<{ message: string }>;
    };

    expect(body.errors).toBeDefined();
    expect(body.errors?.[0].message).toContain('Invalid email or password');
  });
});
