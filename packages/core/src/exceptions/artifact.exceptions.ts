import { DomainException } from './domain.exception';

export class ArtifactNotFoundException extends DomainException {
  constructor(id: string) {
    super(
      `Artifact with identifier '${id}' not found`,
      'ARTIFACT_NOT_FOUND',
      404,
      { id },
    );
  }
}

export class UnsupportedArtifactTypeException extends DomainException {
  constructor(artifactType: string) {
    super(
      `Artifact type '${artifactType}' is not currently supported by the generation pipeline`,
      'UNSUPPORTED_ARTIFACT_TYPE',
      400,
      { artifactType },
    );
  }
}

export class ArtifactGenerationException extends DomainException {
  constructor(artifactType: string, reason?: string) {
    super(
      `Failed to generate artifact '${artifactType}'${reason ? `: ${reason}` : ''}`,
      'ARTIFACT_GENERATION_FAILED',
      500,
      { artifactType, reason },
    );
  }
}
