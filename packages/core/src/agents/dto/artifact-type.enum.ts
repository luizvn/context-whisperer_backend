import { registerEnumType } from '@nestjs/graphql';

export enum ArtifactType {
  REQUIREMENTS = 'REQUIREMENTS',
  ARCHITECTURE_DOC = 'ARCHITECTURE_DOC',
  UML_DIAGRAM = 'UML_DIAGRAM',
  USER_STORIES = 'USER_STORIES',
  DOMAIN_MODEL = 'DOMAIN_MODEL',
  API_SPEC = 'API_SPEC',
}

registerEnumType(ArtifactType, {
  name: 'ArtifactType',
  description: 'Os tipos de artefatos que o sistema pode gerar',
});
