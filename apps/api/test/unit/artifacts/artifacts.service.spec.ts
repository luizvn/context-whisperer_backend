import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import JSZip from 'jszip';
import {
  ArtifactsService,
  extractMasterPrompt,
  slugifyProjectName,
} from '../../../src/modules/artifacts/artifacts.service';
import { ArtifactRepository } from '../../../src/modules/artifacts/artifact.repository';
import { RequisitionRepository } from '../../../src/modules/requisitions/requisition.repository';
import { ArtifactType } from '@context-whisperer/core';
import { Artifact, ScopeProposal } from '@context-whisperer/database';

describe('ArtifactsService', () => {
  let service: ArtifactsService;

  const mockFindById = jest.fn();
  const mockFindCompletedByRequisitionId = jest.fn();
  const mockFindScopeProposalByRequisitionId = jest.fn();

  const mockRequisition = {
    id: 'req-zip-123',
    userId: 'user-owner-1',
    name: 'Telemedicina Express',
    originalPrompt: 'Construir uma plataforma de telemedicina',
    status: 'COMPLETED',
    threadId: 'thread-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockScopeProposal: ScopeProposal = {
    id: 'scope-prop-1',
    requisitionId: 'req-zip-123',
    templateId: 'tmpl-scope',
    contentMd: '# Proposta de Escopo\n\n## 🎯 Objetivo\nTelemedicina ágil.',
    status: 'APPROVED',
    userFeedback: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRecommendedPromptContent =
    '# 🚀 Blueprint MVP\n\n' +
    '## 📌 Visão Geral\n' +
    'Telemedicina para consultas online.\n\n' +
    '## 🛠️ Stack Tecnológica\n' +
    'Next.js, Fastify, PostgreSQL com Prisma.\n\n' +
    '## 📋 Prompt Mestre para Copiar e Colar\n' +
    '````markdown\n' +
    'Você é um Engenheiro de Software Sênior executando o Loop Engineering.\n' +
    'Analise @docs/requirements.md e @docs/scope.md para construir o software.\n' +
    '````\n\n' +
    '## 📖 Instruções de Uso\n' +
    'Copie o prompt acima no Cursor.';

  const mockCompletedArtifacts: Artifact[] = [
    {
      id: 'art-req-1',
      requisitionId: 'req-zip-123',
      templateId: 'tmpl-req',
      artifactType: ArtifactType.REQUIREMENTS,
      fileName: 'requirements.md',
      generatedContent: '# Requisitos Técnicos\n\n### RF-01 - Login',
      status: 'COMPLETED',
      iterationCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'art-prompt-1',
      requisitionId: 'req-zip-123',
      templateId: 'tmpl-rec-prompt',
      artifactType: ArtifactType.RECOMMENDED_PROMPT,
      fileName: 'recommended_mvp_prompt.md',
      generatedContent: mockRecommendedPromptContent,
      status: 'COMPLETED',
      iterationCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'art-arch-1',
      requisitionId: 'req-zip-123',
      templateId: 'tmpl-arch',
      artifactType: 'ARCHITECTURE_DOC',
      fileName: 'architecture.md',
      generatedContent: '# Arquitetura do Sistema\n\nDiagrama C4...',
      status: 'COMPLETED',
      iterationCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtifactsService,
        {
          provide: RequisitionRepository,
          useValue: {
            findById: mockFindById,
          },
        },
        {
          provide: ArtifactRepository,
          useValue: {
            findCompletedByRequisitionId: mockFindCompletedByRequisitionId,
            findScopeProposalByRequisitionId:
              mockFindScopeProposalByRequisitionId,
          },
        },
      ],
    }).compile();

    service = module.get<ArtifactsService>(ArtifactsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractMasterPrompt', () => {
    it('should extract content enclosed by 4 backticks', () => {
      const content =
        'Antes\n````markdown\nPrompt Mestre 4 Crases\n````\nDepois';
      expect(extractMasterPrompt(content)).toBe('Prompt Mestre 4 Crases');
    });

    it('should extract content enclosed by 3 backticks', () => {
      const content = `Antes\n\`\`\`markdown\nPrompt Mestre 3 Crases\n\`\`\`\nDepois`;
      expect(extractMasterPrompt(content)).toBe('Prompt Mestre 3 Crases');
    });

    it('should fallback to full content if no code fence is matched', () => {
      const content = 'Apenas texto corrido sem crases';
      expect(extractMasterPrompt(content)).toBe(
        'Apenas texto corrido sem crases',
      );
    });
  });

  describe('slugifyProjectName', () => {
    it('should normalize, lower case, remove accents and replace spaces/symbols with hyphens', () => {
      expect(slugifyProjectName('Telemedicina Express')).toBe(
        'telemedicina-express',
      );
      expect(slugifyProjectName('Gestão & Finanças 2.0')).toBe(
        'gestao-financas-2-0',
      );
    });

    it('should truncate slugs longer than 50 characters', () => {
      const longName = 'A'.repeat(80);
      expect(slugifyProjectName(longName)).toHaveLength(50);
    });

    it('should return empty string if input contains only symbols or is empty', () => {
      expect(slugifyProjectName('!@#$%^&*()')).toBe('');
      expect(slugifyProjectName('')).toBe('');
    });
  });

  describe('generateZip', () => {
    it('should throw NotFoundException when requisition does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        service.generateZip('non-existent-id', 'user-owner-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockFindById).toHaveBeenCalledWith('non-existent-id');
    });

    it('should throw ForbiddenException when user is neither the owner nor admin', async () => {
      mockFindById.mockResolvedValue(mockRequisition);

      await expect(
        service.generateZip('req-zip-123', 'intruder-user-id', 'user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow access if user is admin even if not the owner', async () => {
      mockFindById.mockResolvedValue(mockRequisition);
      mockFindCompletedByRequisitionId.mockResolvedValue(
        mockCompletedArtifacts,
      );
      mockFindScopeProposalByRequisitionId.mockResolvedValue(mockScopeProposal);

      const result = await service.generateZip(
        'req-zip-123',
        'admin-user-id',
        'admin',
      );

      expect(result).toBeDefined();
      expect(result.fileName).toBe('artifacts-telemedicina-express.zip');
    });

    it('should fallback to requisition id suffix if requisition has no valid name slug', async () => {
      mockFindById.mockResolvedValue({
        ...mockRequisition,
        name: '!!! ???',
      });
      mockFindCompletedByRequisitionId.mockResolvedValue(
        mockCompletedArtifacts,
      );
      mockFindScopeProposalByRequisitionId.mockResolvedValue(mockScopeProposal);

      const result = await service.generateZip('req-zip-123', 'user-owner-1');

      expect(result.fileName).toBe(
        `artifacts-${mockRequisition.id.slice(-6)}.zip`,
      );
    });

    it('should throw BadRequestException when no completed artifacts exist', async () => {
      mockFindById.mockResolvedValue(mockRequisition);
      mockFindCompletedByRequisitionId.mockResolvedValue([]);

      await expect(
        service.generateZip('req-zip-123', 'user-owner-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate a dynamic ZIP containing all completed artifacts in docs/ and PROMPT.md and README.md at root', async () => {
      mockFindById.mockResolvedValue(mockRequisition);
      mockFindCompletedByRequisitionId.mockResolvedValue(
        mockCompletedArtifacts,
      );
      mockFindScopeProposalByRequisitionId.mockResolvedValue(mockScopeProposal);

      const result = await service.generateZip('req-zip-123', 'user-owner-1');

      expect(result.contentType).toBe('application/zip');
      expect(result.fileName).toBe('artifacts-telemedicina-express.zip');
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(typeof result.base64).toBe('string');

      // Inspeciona os caminhos incluídos
      expect(result.includedFiles).toContain('docs/scope.md');
      expect(result.includedFiles).toContain('docs/requirements.md');
      expect(result.includedFiles).toContain('docs/recommended_mvp_prompt.md');
      expect(result.includedFiles).toContain('docs/architecture.md');
      expect(result.includedFiles).toContain('PROMPT.md');
      expect(result.includedFiles).toContain('README.md');

      // Descompacta em memória e verifica a integridade real dos arquivos
      const zipBuffer = Buffer.from(result.base64, 'base64');
      const unzipped = await JSZip.loadAsync(zipBuffer);

      const unzippedScope = await unzipped
        .file('docs/scope.md')
        ?.async('string');
      expect(unzippedScope).toBe(mockScopeProposal.contentMd);

      const unzippedReq = await unzipped
        .file('docs/requirements.md')
        ?.async('string');
      expect(unzippedReq).toBe(mockCompletedArtifacts[0].generatedContent);

      const unzippedArch = await unzipped
        .file('docs/architecture.md')
        ?.async('string');
      expect(unzippedArch).toBe(mockCompletedArtifacts[2].generatedContent);

      const unzippedPrompt = await unzipped.file('PROMPT.md')?.async('string');
      expect(unzippedPrompt).toContain('Loop Engineering');
      expect(unzippedPrompt).toContain('@docs/requirements.md');

      const unzippedReadme = await unzipped.file('README.md')?.async('string');
      expect(unzippedReadme).toBe(mockRecommendedPromptContent);
    });
  });
});
