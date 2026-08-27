import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RequisitionsService } from '../../../src/modules/requisitions/requisitions.service';
import { RequisitionRepository } from '../../../src/modules/requisitions/requisition.repository';
import { RequisitionStatus } from '../../../src/modules/requisitions/requisition.model';
import { Requisition } from '@context-whisperer/database';

describe('RequisitionsService', () => {
  let service: RequisitionsService;

  const mockFindById = jest.fn();
  const mockCreate = jest.fn();
  const mockUpdateStatus = jest.fn();

  const mockRequisition: Requisition = {
    id: 'req-123',
    userId: 'user-123',
    originalPrompt: 'Build an ecommerce platform',
    status: RequisitionStatus.AWAITING_SCOPE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      findById: mockFindById,
      create: mockCreate,
      updateStatus: mockUpdateStatus,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequisitionsService,
        {
          provide: RequisitionRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<RequisitionsService>(RequisitionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return requisition when found', async () => {
      mockFindById.mockResolvedValue(mockRequisition);

      const result = await service.findById('req-123');

      expect(mockFindById).toHaveBeenCalledWith('req-123');
      expect(result).toEqual(mockRequisition);
    });

    it('should throw NotFoundException when requisition does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockFindById).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('create', () => {
    it('should create requisition with AWAITING_SCOPE status', async () => {
      mockCreate.mockResolvedValue(mockRequisition);

      const result = await service.create(
        'user-123',
        'Build an ecommerce platform',
      );

      expect(mockCreate).toHaveBeenCalledWith({
        userId: 'user-123',
        originalPrompt: 'Build an ecommerce platform',
        status: RequisitionStatus.AWAITING_SCOPE,
      });
      expect(result).toEqual(mockRequisition);
    });
  });

  describe('updateStatus', () => {
    it('should update status and return updated requisition', async () => {
      const updated = {
        ...mockRequisition,
        status: RequisitionStatus.GENERATING,
      };
      mockUpdateStatus.mockResolvedValue(updated);

      const result = await service.updateStatus(
        'req-123',
        RequisitionStatus.GENERATING,
      );

      expect(mockUpdateStatus).toHaveBeenCalledWith(
        'req-123',
        RequisitionStatus.GENERATING,
      );
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if update fails', async () => {
      mockUpdateStatus.mockRejectedValue(new Error('Record not found'));

      await expect(
        service.updateStatus('non-existent', RequisitionStatus.COMPLETED),
      ).rejects.toThrow(NotFoundException);

      expect(mockUpdateStatus).toHaveBeenCalledWith(
        'non-existent',
        RequisitionStatus.COMPLETED,
      );
    });
  });
});
