import { RequisitionRepository } from '../../../src/modules/users/../requisitions/requisition.repository';
import { Requisition } from '@context-whisperer/database';

const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    requisition: {
      findUnique: (...args: unknown[]): Promise<unknown> =>
        Promise.resolve(mockFindUnique(...args)),
      create: (...args: unknown[]): Promise<unknown> =>
        Promise.resolve(mockCreate(...args)),
      update: (...args: unknown[]): Promise<unknown> =>
        Promise.resolve(mockUpdate(...args)),
    },
  },
}));

describe('RequisitionRepository', () => {
  let repository: RequisitionRepository;

  const mockRequisition: Requisition = {
    id: 'req-123',
    userId: 'user-123',
    originalPrompt: 'Create a microservice system',
    status: 'AWAITING_SCOPE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new RequisitionRepository();
  });

  describe('findById', () => {
    it('should return a requisition when found by id', async () => {
      mockFindUnique.mockResolvedValue(mockRequisition);

      const result = await repository.findById('req-123');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'req-123' },
      });
      expect(result).toEqual(mockRequisition);
    });

    it('should return null when requisition is not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
      });
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should call prisma.requisition.create and return created requisition', async () => {
      const data = {
        userId: 'user-123',
        originalPrompt: 'Create a microservice system',
        status: 'AWAITING_SCOPE',
      };

      mockCreate.mockResolvedValue(mockRequisition);

      const result = await repository.create(data);

      expect(mockCreate).toHaveBeenCalledWith({ data });
      expect(result).toEqual(mockRequisition);
    });
  });

  describe('updateStatus', () => {
    it('should call prisma.requisition.update and return updated requisition', async () => {
      const updated = { ...mockRequisition, status: 'GENERATING' };
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.updateStatus('req-123', 'GENERATING');

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'req-123' },
        data: { status: 'GENERATING' },
      });
      expect(result).toEqual(updated);
    });
  });
});
