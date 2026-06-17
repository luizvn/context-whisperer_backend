import { NotFoundException } from '@nestjs/common';
import { RequisitionStatus } from './requisition.model';
import { requisitionsTable } from './requisition.schema';
import { RequisitionsService } from './requisitions.service';

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

describe('RequisitionsService', () => {
  let db: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
  };
  let service: RequisitionsService;

  const requisition = {
    id: 'req-1',
    userId: 'user-1',
    originalPrompt: 'Build a project',
    status: RequisitionStatus.AWAITING_SCOPE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    db = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    service = new RequisitionsService(db as never);
  });

  it('finds a requisition by id', async () => {
    const selectChain = createSelectChain([requisition]);
    db.select.mockReturnValue(selectChain);

    await expect(service.findById(requisition.id)).resolves.toBe(requisition);
    expect(selectChain.from).toHaveBeenCalledWith(requisitionsTable);
  });

  it('throws when a requisition is not found', async () => {
    db.select.mockReturnValue(createSelectChain([]));

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a requisition awaiting scope', async () => {
    const insertChain = createInsertChain([requisition]);
    db.insert.mockReturnValue(insertChain);

    await expect(service.create('user-1', 'Build a project')).resolves.toBe(
      requisition,
    );
    expect(db.insert).toHaveBeenCalledWith(requisitionsTable);
    expect(insertChain.values).toHaveBeenCalledWith({
      userId: 'user-1',
      originalPrompt: 'Build a project',
      status: RequisitionStatus.AWAITING_SCOPE,
    });
  });

  it('updates a requisition status', async () => {
    const updated = { ...requisition, status: RequisitionStatus.COMPLETED };
    const updateChain = createUpdateChain([updated]);
    db.update.mockReturnValue(updateChain);

    await expect(
      service.updateStatus(requisition.id, RequisitionStatus.COMPLETED),
    ).resolves.toBe(updated);
    expect(db.update).toHaveBeenCalledWith(requisitionsTable);
    expect(updateChain.set).toHaveBeenCalledWith({
      status: RequisitionStatus.COMPLETED,
      updatedAt: expect.any(Date),
    });
  });

  it('throws when the status update does not affect a requisition', async () => {
    db.update.mockReturnValue(createUpdateChain([]));

    await expect(
      service.updateStatus('missing', RequisitionStatus.FAILED),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
