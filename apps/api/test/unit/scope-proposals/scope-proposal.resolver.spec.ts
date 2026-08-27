import { ScopeProposalResolver } from '../../../src/modules/scope-proposals/scope-proposal.resolver';
import { ScopeProposalService } from '../../../src/modules/scope-proposals/scope-proposal.service';
import { EventsService } from '../../../src/modules/events/events.service';
import { UserModel } from '../../../src/modules/users/user.model';
import {
  ScopeProposalModel,
  ScopeProposalStatus,
} from '../../../src/modules/scope-proposals/scope-proposal.model';
import { SseEventType } from '@context-whisperer/core';

describe('ScopeProposalResolver (Human-in-the-Loop Mutations & Queries)', () => {
  let resolver: ScopeProposalResolver;
  const mockFindById = jest.fn();
  const mockApprove = jest.fn();
  const mockReject = jest.fn();
  const mockPublishUserEvent = jest.fn();

  const mockUser: UserModel = {
    id: 'user-resolver-123',
    name: 'Morpheus',
    email: 'morpheus@matrix.org',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProposal: ScopeProposalModel = {
    id: 'prop-123',
    requisitionId: 'req-456',
    templateId: 'default',
    contentMd: '# Proposta de Escopo',
    status: ScopeProposalStatus.PENDING,
    userFeedback: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockFindById.mockResolvedValue(mockProposal);
    mockApprove.mockResolvedValue({
      ...mockProposal,
      status: ScopeProposalStatus.APPROVED,
    });
    mockReject.mockResolvedValue({
      ...mockProposal,
      status: ScopeProposalStatus.REJECTED,
      userFeedback: 'Needs microservices architecture',
    });

    const service = {
      findById: mockFindById,
      approve: mockApprove,
      reject: mockReject,
    } as unknown as ScopeProposalService;

    mockPublishUserEvent.mockResolvedValue(undefined);
    const eventsService = {
      publishUserEvent: mockPublishUserEvent,
    } as unknown as EventsService;

    resolver = new ScopeProposalResolver(service, eventsService);
  });

  it('should return proposal by id on getScopeProposal query', async () => {
    const result = await resolver.getScopeProposal('prop-123');

    expect(mockFindById).toHaveBeenCalledWith('prop-123');
    expect(result).toEqual(mockProposal);
  });

  it('should approve proposal and emit SCOPE_APPROVED SSE event', async () => {
    const result = await resolver.approveScopeProposal('prop-123', mockUser);

    expect(mockApprove).toHaveBeenCalledWith('prop-123');
    expect(mockPublishUserEvent).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({
        type: SseEventType.SCOPE_APPROVED,
        userId: mockUser.id,
        requisitionId: mockProposal.requisitionId,
      }),
    );
    expect(result.status).toBe(ScopeProposalStatus.APPROVED);
  });

  it('should reject proposal with feedback and emit SCOPE_REJECTED SSE event', async () => {
    const feedback = 'Needs microservices architecture';
    const result = await resolver.rejectScopeProposal(
      'prop-123',
      feedback,
      mockUser,
    );

    expect(mockReject).toHaveBeenCalledWith('prop-123', feedback);
    expect(mockPublishUserEvent).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({
        type: SseEventType.SCOPE_REJECTED,
        userId: mockUser.id,
        requisitionId: mockProposal.requisitionId,
      }),
    );
    expect(result.status).toBe(ScopeProposalStatus.REJECTED);
  });
});
