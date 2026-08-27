import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ScopeProposalService } from '../../../src/modules/scope-proposals/scope-proposal.service';
import { ScopeProposalRepository } from '../../../src/modules/scope-proposals/scope-proposal.repository';
import { ScopeProposalStatus } from '../../../src/modules/scope-proposals/scope-proposal.model';
import { ScopeProposal } from '@context-whisperer/database';
import { ProposedScopeResponse } from '@context-whisperer/core';

describe('ScopeProposalService', () => {
  let service: ScopeProposalService;

  const mockFindById = jest.fn();
  const mockCreate = jest.fn();
  const mockUpdateStatus = jest.fn();

  const mockProposal: ScopeProposal = {
    id: 'proposal-123',
    requisitionId: 'req-123',
    templateId: 'tpl-123',
    contentMd: '# Proposta de Escopo',
    status: ScopeProposalStatus.PENDING,
    userFeedback: null,
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
        ScopeProposalService,
        {
          provide: ScopeProposalRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ScopeProposalService>(ScopeProposalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return proposal when found by id', async () => {
      mockFindById.mockResolvedValue(mockProposal);

      const result = await service.findById('proposal-123');

      expect(mockFindById).toHaveBeenCalledWith('proposal-123');
      expect(result).toEqual(mockProposal);
    });

    it('should throw NotFoundException when proposal is not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockFindById).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('create', () => {
    it('should create proposal with PENDING status', async () => {
      mockCreate.mockResolvedValue(mockProposal);

      const result = await service.create(
        'req-123',
        'tpl-123',
        '# Proposta de Escopo',
      );

      expect(mockCreate).toHaveBeenCalledWith({
        requisitionId: 'req-123',
        templateId: 'tpl-123',
        contentMd: '# Proposta de Escopo',
        status: ScopeProposalStatus.PENDING,
      });
      expect(result).toEqual(mockProposal);
    });
  });

  describe('approve', () => {
    it('should update status to APPROVED', async () => {
      const approved = {
        ...mockProposal,
        status: ScopeProposalStatus.APPROVED,
      };
      mockUpdateStatus.mockResolvedValue(approved);

      const result = await service.approve('proposal-123');

      expect(mockUpdateStatus).toHaveBeenCalledWith(
        'proposal-123',
        ScopeProposalStatus.APPROVED,
      );
      expect(result).toEqual(approved);
    });
  });

  describe('reject', () => {
    it('should update status to REJECTED with feedback', async () => {
      const rejected = {
        ...mockProposal,
        status: ScopeProposalStatus.REJECTED,
        userFeedback: 'Add payment integration',
      };
      mockUpdateStatus.mockResolvedValue(rejected);

      const result = await service.reject(
        'proposal-123',
        'Add payment integration',
      );

      expect(mockUpdateStatus).toHaveBeenCalledWith(
        'proposal-123',
        ScopeProposalStatus.REJECTED,
        'Add payment integration',
      );
      expect(result).toEqual(rejected);
    });
  });

  describe('buildMarkdownFromResponse', () => {
    it('should generate properly formatted markdown from structured LLM response', () => {
      const llmResponse: ProposedScopeResponse = {
        projectGoal: 'Build an AI chat backend',
        mustHave: ['Authentication', 'Message streaming'],
        shouldHave: ['Persistence in MongoDB'],
        couldHave: ['Voice support'],
        wontHave: ['Mobile app in v1'],
        businessConstraints: ['Max 500ms latency'],
      };

      const md = service.buildMarkdownFromResponse(llmResponse);

      expect(md).toContain('# Proposta de Escopo');
      expect(md).toContain(
        '## 🎯 Objetivo do Projeto\nBuild an AI chat backend',
      );
      expect(md).toContain(
        '## ✅ Must Have (Indispensável)\n- Authentication\n- Message streaming\n',
      );
      expect(md).toContain(
        '## 🚀 Should Have (Importante)\n- Persistence in MongoDB\n',
      );
      expect(md).toContain('## ✨ Could Have (Desejável)\n- Voice support\n');
      expect(md).toContain(
        "## 🚫 Won't Have (Fora de Escopo)\n- Mobile app in v1\n",
      );
      expect(md).toContain(
        '## ⚠️ Restrições de Negócio\n- Max 500ms latency\n',
      );
    });

    it('should omit business constraints section if array is empty', () => {
      const llmResponse: ProposedScopeResponse = {
        projectGoal: 'Simple tool',
        mustHave: ['CLI interface'],
        shouldHave: [],
        couldHave: [],
        wontHave: [],
        businessConstraints: [],
      };

      const md = service.buildMarkdownFromResponse(llmResponse);

      expect(md).toContain('# Proposta de Escopo');
      expect(md).toContain('## 🎯 Objetivo do Projeto\nSimple tool');
      expect(md).not.toContain('## ⚠️ Restrições de Negócio');
    });
  });
});
