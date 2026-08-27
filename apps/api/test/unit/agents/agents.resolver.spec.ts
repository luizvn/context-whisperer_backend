import { Test, TestingModule } from '@nestjs/testing';
import { AgentsResolver } from '../../../src/modules/agents/agents.resolver';
import { AgentsService } from '../../../src/modules/agents/agents.service';
import {
  CreateProjectInput,
  ArtifactType,
  JobQueuedResponse,
} from '@context-whisperer/core';
import { UserModel } from '../../../src/modules/users/user.model';

describe('AgentsResolver', () => {
  let resolver: AgentsResolver;

  const mockExecuteWorkflow = jest.fn();

  const mockUser: UserModel = {
    id: 'user-123',
    name: 'Eva',
    email: 'eva@example.com',
    role: 'user',
    createdAt: new Date(),
  };

  const mockJobQueuedResponse: JobQueuedResponse = {
    jobId: 'job-789',
    status: 'QUEUED',
    requisitionId: 'req-456',
  };

  beforeEach(async () => {
    const mockAgentsService = {
      executeWorkflow: mockExecuteWorkflow,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsResolver,
        {
          provide: AgentsService,
          useValue: mockAgentsService,
        },
      ],
    }).compile();

    resolver = module.get<AgentsResolver>(AgentsResolver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('createProject', () => {
    it('should call agentsService.executeWorkflow and return JobQueuedResponse', async () => {
      const input: CreateProjectInput = {
        name: 'New Platform',
        prompt: 'Build a fintech portal',
        artifacts: [ArtifactType.REQUIREMENTS],
      };

      mockExecuteWorkflow.mockResolvedValue(mockJobQueuedResponse);

      const result = await resolver.createProject(input, mockUser);

      expect(mockExecuteWorkflow).toHaveBeenCalledWith(
        input,
        expect.any(String),
        mockUser,
      );
      expect(result).toEqual(mockJobQueuedResponse);
    });
  });
});
