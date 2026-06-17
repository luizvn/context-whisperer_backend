import { NotFoundException } from '@nestjs/common';
import { ScopeProposalStatus } from './scope-proposal.model';
import { scopeProposalsTable } from './scope-proposal.schema';
import { ScopeProposalService } from './scope-proposal.service';

type SelectChain = {
  from: jest.Mock;
  where: jest.Mock;
};

type WriteChain = {
  values?: jest.Mock;
  set?: jest.Mock;
  where: jest.Mock;
  returning: jest.Mock;
};

const createSelectChain = (rows: unknown[]): SelectChain => {
  const chain: SelectChain = {
    from: jest.fn(),
    where: jest.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  return chain;
};

const createInsertChain = (rows: unknown[]): WriteChain => {
  const chain: WriteChain = {
    values: jest.fn(),
    where: jest.fn(),
    returning: jest.fn().mockResolvedValue(rows),
  };
  chain.values!.mockReturnValue(chain);
  return chain;
};

const createUpdateChain = (rows: unknown[]): WriteChain => {
  const chain: WriteChain = {
    set: jest.fn(),
    where: jest.fn(),
    returning: jest.fn().mockResolvedValue(rows),
  };
  chain.set!.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
};

describe('ScopeProposalService', () => {
  let db: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
  };
  let service: ScopeProposalService;

  const proposal = {
    id: 'proposal-1',
    requisitionId: 'req-1',
    contentMd: '# Scope',
    status: ScopeProposalStatus.PENDING,
    userFeedback: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    db = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    service = new ScopeProposalService(db as never);
  });

  it('finds a scope proposal by id', async () => {
    const selectChain = createSelectChain([proposal]);
    db.select.mockReturnValue(selectChain);

    await expect(service.findById(proposal.id)).resolves.toBe(proposal);
    expect(selectChain.from).toHaveBeenCalledWith(scopeProposalsTable);
  });

  it('throws when a scope proposal is not found', async () => {
    db.select.mockReturnValue(createSelectChain([]));

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a pending scope proposal', async () => {
    const insertChain = createInsertChain([proposal]);
    db.insert.mockReturnValue(insertChain);

    await expect(service.create('req-1', '# Scope')).resolves.toBe(proposal);
    expect(db.insert).toHaveBeenCalledWith(scopeProposalsTable);
    expect(insertChain.values).toHaveBeenCalledWith({
      requisitionId: 'req-1',
      contentMd: '# Scope',
      status: ScopeProposalStatus.PENDING,
    });
  });

  it('approves a scope proposal', async () => {
    const approved = { ...proposal, status: ScopeProposalStatus.APPROVED };
    const updateChain = createUpdateChain([approved]);
    db.update.mockReturnValue(updateChain);

    await expect(service.approve(proposal.id)).resolves.toBe(approved);
    expect(updateChain.set).toHaveBeenCalledWith({
      status: ScopeProposalStatus.APPROVED,
    });
  });

  it('rejects a scope proposal with feedback', async () => {
    const rejected = {
      ...proposal,
      status: ScopeProposalStatus.REJECTED,
      userFeedback: 'Too broad',
    };
    const updateChain = createUpdateChain([rejected]);
    db.update.mockReturnValue(updateChain);

    await expect(service.reject(proposal.id, 'Too broad')).resolves.toBe(
      rejected,
    );
    expect(updateChain.set).toHaveBeenCalledWith({
      status: ScopeProposalStatus.REJECTED,
      userFeedback: 'Too broad',
    });
  });

  it('builds markdown from a proposed scope response', () => {
    const markdown = service.buildMarkdownFromResponse({
      projectGoal: 'Launch a planning assistant',
      mustHave: ['Login', 'Project creation'],
      shouldHave: ['Progress updates'],
      couldHave: ['Template gallery'],
      wontHave: ['Billing'],
      businessConstraints: ['MVP in 30 days'],
    });

    expect(markdown).toContain('# Proposta de Escopo');
    expect(markdown).toContain('Launch a planning assistant');
    expect(markdown).toContain('- Login');
    expect(markdown).toContain('- Project creation');
    expect(markdown).toContain('- Progress updates');
    expect(markdown).toContain('- Template gallery');
    expect(markdown).toContain('- Billing');
    expect(markdown).toContain('- MVP in 30 days');
  });

  it('omits business constraints when none are provided', () => {
    const markdown = service.buildMarkdownFromResponse({
      projectGoal: 'Launch a planning assistant',
      mustHave: [],
      shouldHave: [],
      couldHave: [],
      wontHave: [],
      businessConstraints: [],
    });

    expect(markdown).not.toContain('MVP in 30 days');
  });
});
