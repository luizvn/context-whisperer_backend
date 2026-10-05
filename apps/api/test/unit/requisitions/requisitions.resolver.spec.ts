import { Test, TestingModule } from '@nestjs/testing';
import { RequisitionsResolver } from '../../../src/modules/requisitions/requisitions.resolver';
import { RequisitionsService } from '../../../src/modules/requisitions/requisitions.service';
import { UserModel } from '../../../src/modules/users/user.model';
import {
  RequisitionModel,
  RequisitionStatus,
} from '../../../src/modules/requisitions/requisition.model';

describe('RequisitionsResolver', () => {
  let resolver: RequisitionsResolver;
  const mockFindByUserId = jest.fn();
  const mockFindByIdWithDetails = jest.fn();

  const mockUser: UserModel = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    createdAt: new Date(),
  };

  const mockRequisition: RequisitionModel = {
    id: 'req-123',
    userId: 'user-123',
    name: 'Projeto de Teste',
    originalPrompt: 'Quero um app de delivery',
    status: RequisitionStatus.AWAITING_SCOPE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockRequisitionsService = {
      findByUserId: mockFindByUserId,
      findByIdWithDetails: mockFindByIdWithDetails,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequisitionsResolver,
        {
          provide: RequisitionsService,
          useValue: mockRequisitionsService,
        },
      ],
    }).compile();

    resolver = module.get<RequisitionsResolver>(RequisitionsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('getMyProjects', () => {
    it('should return user requisitions', async () => {
      mockFindByUserId.mockResolvedValue([mockRequisition]);

      const result = await resolver.getMyProjects(mockUser);

      expect(mockFindByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([mockRequisition]);
    });
  });

  describe('getProject', () => {
    it('should return requisition details by id', async () => {
      mockFindByIdWithDetails.mockResolvedValue(mockRequisition);

      const result = await resolver.getProject('req-123', mockUser);

      expect(mockFindByIdWithDetails).toHaveBeenCalledWith(
        'req-123',
        mockUser.id,
      );
      expect(result).toEqual(mockRequisition);
    });
  });
});
