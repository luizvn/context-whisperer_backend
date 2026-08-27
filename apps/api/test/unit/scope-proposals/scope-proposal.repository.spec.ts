import { ScopeProposalRepository } from '../../../src/modules/scope-proposals/scope-proposal.repository';
import { ScopeProposal } from '@context-whisperer/database';

const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@context-whisperer/database', () => ({
  prisma: {
    scopeProposal: {
      findUnique: (...args: unknown[]): Promise<unknown> =>
        Promise.resolve(mockFindUnique(...args)),
      create: (...args: unknown[]): Promise<unknown> =>
        Promise.resolve(mockCreate(...args)),
      update: (...args: unknown[]): Promise<unknown> =>
        Promise.resolve(mockUpdate(...args)),
    },
  },
}));

describe('ScopeProposalRepository', () => {
  let repository: ScopeProposalRepository;

  const mockProposal: ScopeProposal = {
    id: 'proposal-123',
    requisitionId: 'req-123',
    templateId: 'tpl-123',
    contentMd: '# Proposta de Escopo',
    status: 'PENDING',
    userFeedback: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ScopeProposalRepository();
  });

  describe('findById', () => {
    it('should return proposal when found by id', async () => {
      mockFindUnique.mockResolvedValue(mockProposal);

      const result = await repository.findById('proposal-123');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'proposal-123' },
      });
      expect(result).toEqual(mockProposal);
    });

    it('should return null when proposal is not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
      });
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should call prisma.scopeProposal.create and return created proposal', async () => {
      const data = {
        requisitionId: 'req-123',
        templateId: 'tpl-123',
        contentMd: '# Proposta de Escopo',
        status: 'PENDING',
      };

      mockCreate.mockResolvedValue(mockProposal);

      const result = await repository.create(data);

      expect(mockCreate).toHaveBeenCalledWith({ data });
      expect(result).toEqual(mockProposal);
    });
  });

  describe('updateStatus', () => {
    it('should update status and optional feedback and return updated proposal', async () => {
      const updated = {
        ...mockProposal,
        status: 'REJECTED',
        userFeedback: 'Need to add mobile support',
      };
      mockUpdate.mockResolvedValue(updated);

      const result = await repository.updateStatus(
        'proposal-123',
        'REJECTED',
        'Need to add mobile support',
      );

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'proposal-123' },
        data: {
          status: 'REJECTED',
          userFeedback: 'Need to add mobile support',
        },
      });
      expect(result).toEqual(updated);
    });
  });
});
