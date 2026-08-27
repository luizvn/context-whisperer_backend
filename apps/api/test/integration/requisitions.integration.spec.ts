import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, MercuriusDriverConfig } from '@nestjs/mercurius';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { AgentsResolver } from '../../src/modules/agents/agents.resolver';
import { AgentsService } from '../../src/modules/agents/agents.service';
import { RequisitionsService } from '../../src/modules/requisitions/requisitions.service';
import { RequisitionRepository } from '../../src/modules/requisitions/requisition.repository';
import { ScopeProposalService } from '../../src/modules/scope-proposals/scope-proposal.service';
import { ScopeProposalRepository } from '../../src/modules/scope-proposals/scope-proposal.repository';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { GqlAuthGuard } from '../../src/modules/auth/guards/gql-auth.guard';
import { UsersService } from '../../src/modules/users/user.service';
import { UserResolver } from '../../src/modules/users/user.resolver';
import { Requisition, ScopeProposal, User } from '@context-whisperer/database';
import { FastifyRequest } from 'fastify';

describe('Requisitions & Agents GraphQL Integration Test (Fastify + Mercurius)', () => {
  let app: NestFastifyApplication;

  const mockUser: User = {
    id: 'user-integration-123',
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    password: 'hashed_password',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const inMemoryRequisitions: Map<string, Requisition> = new Map();
  const inMemoryProposals: Map<string, ScopeProposal> = new Map();

  const mockQueueAdd = jest.fn((jobName: string, data: unknown) => {
    return Promise.resolve({
      id: `bull-job-${Date.now()}`,
      name: jobName,
      data,
    });
  });

  const mockRequisitionRepository = {
    findById: jest.fn((id: string) =>
      Promise.resolve(inMemoryRequisitions.get(id) ?? null),
    ),
    create: jest.fn(
      (data: { userId: string; originalPrompt: string; status: string }) => {
        const id = `req-${Date.now()}`;
        const requisition: Requisition = {
          id,
          userId: data.userId,
          originalPrompt: data.originalPrompt,
          status: data.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryRequisitions.set(id, requisition);
        return Promise.resolve(requisition);
      },
    ),
    updateStatus: jest.fn((id: string, status: string) => {
      const existing = inMemoryRequisitions.get(id);
      if (!existing) return Promise.reject(new Error('NotFound'));
      const updated = { ...existing, status, updatedAt: new Date() };
      inMemoryRequisitions.set(id, updated);
      return Promise.resolve(updated);
    }),
  };

  const mockScopeProposalRepository = {
    findById: jest.fn((id: string) =>
      Promise.resolve(inMemoryProposals.get(id) ?? null),
    ),
    create: jest.fn(
      (data: {
        requisitionId: string;
        templateId: string;
        contentMd: string;
        status: string;
      }) => {
        const id = `prop-${Date.now()}`;
        const proposal: ScopeProposal = {
          id,
          requisitionId: data.requisitionId,
          templateId: data.templateId,
          contentMd: data.contentMd,
          status: data.status,
          userFeedback: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryProposals.set(id, proposal);
        return Promise.resolve(proposal);
      },
    ),
    updateStatus: jest.fn(
      (id: string, status: string, userFeedback?: string) => {
        const existing = inMemoryProposals.get(id);
        if (!existing) return Promise.reject(new Error('NotFound'));
        const updated = {
          ...existing,
          status,
          userFeedback: userFeedback ?? null,
          updatedAt: new Date(),
        };
        inMemoryProposals.set(id, updated);
        return Promise.resolve(updated);
      },
    ),
  };

  const mockUsersService = {
    findById: jest.fn((id: string) =>
      id === mockUser.id ? Promise.resolve(mockUser) : Promise.resolve(null),
    ),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_SECRET: 'test-secret-agents-1234' })],
        }),
        JwtModule.register({
          secret: 'test-secret-agents-1234',
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
        AgentsResolver,
        AgentsService,
        UserResolver,
        RequisitionsService,
        ScopeProposalService,
        JwtStrategy,
        GqlAuthGuard,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: getQueueToken('ai-generation'),
          useValue: { add: mockQueueAdd },
        },
        {
          provide: RequisitionRepository,
          useValue: mockRequisitionRepository,
        },
        {
          provide: ScopeProposalRepository,
          useValue: mockScopeProposalRepository,
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
    inMemoryRequisitions.clear();
    inMemoryProposals.clear();
    jest.clearAllMocks();
  });

  it('should successfully create a project via mutation and queue a BullMQ job', async () => {
    // Generate valid auth token for Sarah
    const jwtService = app.get(JwtService);
    const token = jwtService.sign({ sub: mockUser.id, email: mockUser.email });

    const createProjectMutation = `
      mutation {
        createProject(input: {
          name: "Autonomous Drone System",
          prompt: "Build an AI autopilot for drones",
          artifacts: [REQUIREMENTS, API_SPEC]
        }) {
          jobId
          status
          requisitionId
        }
      }
    `;

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: { query: createProjectMutation },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data?: {
        createProject: {
          jobId: string;
          status: string;
          requisitionId: string;
        };
      };
      errors?: unknown[];
    };

    expect(body.errors).toBeUndefined();
    expect(body.data?.createProject.status).toBe('QUEUED');
    expect(body.data?.createProject.jobId).toBeDefined();
    expect(body.data?.createProject.requisitionId).toBeDefined();

    // Verify Requisition was stored
    const reqId = body.data?.createProject.requisitionId ?? '';
    const storedReq = inMemoryRequisitions.get(reqId);
    expect(storedReq).toBeDefined();
    expect(storedReq?.userId).toBe(mockUser.id);
    expect(storedReq?.status).toBe('AWAITING_SCOPE');

    // Verify BullMQ job was added
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'generate-artifacts',
      expect.objectContaining({
        requisitionId: reqId,
        userId: mockUser.id,
      }),
    );
  });

  it('should reject unauthenticated project creation requests with Unauthorized error', async () => {
    const createProjectMutation = `
      mutation {
        createProject(input: {
          name: "Unauthenticated App",
          prompt: "Prompt",
          artifacts: [REQUIREMENTS]
        }) {
          jobId
        }
      }
    `;

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: createProjectMutation },
    });

    const body = JSON.parse(response.body) as {
      errors?: Array<{ message: string }>;
    };

    expect(body.errors).toBeDefined();
    expect(body.errors?.[0].message).toContain('Unauthorized');
  });
});
