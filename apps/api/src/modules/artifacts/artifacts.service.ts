import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import JSZip from 'jszip';
import { ArtifactType } from '@context-whisperer/core';
import { Artifact } from '@context-whisperer/database';
import { RequisitionRepository } from '../requisitions/requisition.repository';
import { ArtifactRepository } from './artifact.repository';
import { ArtifactsZipModel } from './dto/artifacts-zip.model';
import { EntityNotFoundException } from '../../common/exceptions';

export function extractMasterPrompt(recommendedPromptContent: string): string {
  const fourFencesMatch = recommendedPromptContent.match(
    /````(?:markdown)?\r?\n([\s\S]*?)\r?\n````/,
  );
  if (fourFencesMatch && fourFencesMatch[1]?.trim()) {
    return fourFencesMatch[1].trim();
  }

  const threeFencesMatch = recommendedPromptContent.match(
    /```(?:markdown)?\r?\n([\s\S]*?)\r?\n```/,
  );
  if (threeFencesMatch && threeFencesMatch[1]?.trim()) {
    return threeFencesMatch[1].trim();
  }

  return recommendedPromptContent.trim();
}

export function slugifyProjectName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

@Injectable()
export class ArtifactsService {
  constructor(
    private readonly requisitionRepository: RequisitionRepository,
    private readonly artifactRepository: ArtifactRepository,
  ) {}

  async generateZip(
    requisitionId: string,
    userId: string,
    userRole?: string,
  ): Promise<ArtifactsZipModel> {
    const requisition =
      await this.requisitionRepository.findById(requisitionId);

    if (!requisition) {
      throw new EntityNotFoundException('Requisition', requisitionId);
    }

    if (requisition.userId !== userId && userRole !== 'admin') {
      throw new ForbiddenException(
        'Você não tem permissão para acessar os artefatos desta requisição.',
      );
    }

    const completedArtifacts =
      await this.artifactRepository.findCompletedByRequisitionId(requisitionId);

    if (completedArtifacts.length === 0) {
      throw new BadRequestException(
        'Os artefatos desta requisição ainda não foram concluídos. Aguarde a conclusão da geração.',
      );
    }

    const scopeProposal =
      await this.artifactRepository.findScopeProposalByRequisitionId(
        requisitionId,
      );

    const zip = new JSZip();
    const includedFiles: string[] = [];

    // 1. docs/scope.md (proveniente da ScopeProposal)
    if (scopeProposal && scopeProposal.contentMd) {
      zip.file('docs/scope.md', scopeProposal.contentMd);
      includedFiles.push('docs/scope.md');
    }

    let recommendedPromptArtifact: Artifact | undefined;

    // 2. Empacota DINAMICAMENTE todos os artefatos concluídos na pasta docs/
    for (const artifact of completedArtifacts) {
      if (artifact.generatedContent) {
        const fileName =
          artifact.fileName || `${artifact.artifactType.toLowerCase()}.md`;
        const relativePath = `docs/${fileName}`;
        zip.file(relativePath, artifact.generatedContent);
        includedFiles.push(relativePath);

        if (
          artifact.artifactType === (ArtifactType.RECOMMENDED_PROMPT as string)
        ) {
          recommendedPromptArtifact = artifact;
        }
      }
    }

    // 3. Se houver RECOMMENDED_PROMPT, extrai PROMPT.md e README.md para a raiz do ZIP
    if (
      recommendedPromptArtifact &&
      recommendedPromptArtifact.generatedContent
    ) {
      const cleanPrompt = extractMasterPrompt(
        recommendedPromptArtifact.generatedContent,
      );
      zip.file('PROMPT.md', cleanPrompt);
      includedFiles.push('PROMPT.md');

      zip.file('README.md', recommendedPromptArtifact.generatedContent);
      includedFiles.push('README.md');
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    const slug = slugifyProjectName(requisition.name);
    const fileName = `artifacts-${slug || requisitionId.slice(-6)}.zip`;

    return {
      fileName,
      contentType: 'application/zip',
      sizeBytes: zipBuffer.length,
      base64: zipBuffer.toString('base64'),
      includedFiles,
    };
  }
}
