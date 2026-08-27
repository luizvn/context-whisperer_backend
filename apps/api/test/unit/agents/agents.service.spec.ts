import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AgentsService } from '../../../src/modules/agents/agents.service';
import { RequisitionsService } from '../../../src/modules/requisitions/requisitions.service';
import { CreateProjectInput, ArtifactType } from '@context-whisperer/core';
import { UserModel } from '../../../src/modules/users/user.model';
import { RequisitionModel } from '../../../src/modules/requisitions/requisition.model';

describe('AgentsService', () => {
  let service: AgentsService;

  const mockQueueAdd = jest.fn();
  const mockCreateRequisition = jest.fn();

  const mockUser: UserModel = {
    id: 'user-123',
    name: 'Eva',
    email: 'eva@example.com',
    role: 'user',
    createdAt: new Date(),
  };

  const mockRequisition: RequisitionModel = {
    id: 'req-456',
    userId: 'user-123',
    originalPrompt: 'Build SaaS',
    status: 'AWAITING_SCOPE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockQueue = {
      add: mockQueueAdd,
    };

    const mockRequisitionService = {
      create: mockCreateRequisition,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        {
          provide: getQueueToken('ai-generation'),
          useValue: mockQueue,
        },
        {
          provide: RequisitionsService,
          useValue: mockRequisitionService,
        },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeWorkflow', () => {
    it('should create a requisition, enqueue a background job with BullMQ, and return JobQueuedResponse', async () => {
      const projectInput: CreateProjectInput = {
        name: 'My AI App',
        prompt: 'Build a Next.js fullstack application',
        artifacts: [ArtifactType.REQUIREMENTS, ArtifactType.UML_DIAGRAM],
      };

      mockCreateRequisition.mockResolvedValue(mockRequisition);
      mockQueueAdd.mockResolvedValue({ id: 'job-789' });

      const result = await service.executeWorkflow(
        projectInput,
        'thread-abc',
        mockUser,
      );

      expect(mockCreateRequisition).toHaveBeenCalledWith(
        'user-123',
        'Build a Next.js fullstack application',
      );
      expect(mockQueueAdd).toHaveBeenCalledWith('generate-artifacts', {
        projectRequest: projectInput,
        requisitionId: 'req-456',
        userId: 'user-123',
        threadId: 'thread-abc',
      });
      expect(result).toEqual({
        jobId: 'job-789',
        status: 'QUEUED',
        requisitionId: 'req-456',
      });
    });

    it('should fallback to empty string if job id is undefined', async () => {
      const projectInput: CreateProjectInput = {
        name: 'App',
        prompt: 'Prompt',
        artifacts: [],
      };

      mockCreateRequisition.mockResolvedValue(mockRequisition);
      mockQueueAdd.mockResolvedValue({ id: undefined });

      const result = await service.executeWorkflow(
        projectInput,
        'thread-1',
        mockUser,
      );

      expect(result.jobId).toBe('');
      expect(result.status).toBe('QUEUED');
      expect(result.requisitionId).toBe('req-456');
    });
  });
});
