import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description:
    'Payload contendo os metadados e o binário em Base64 do pacote ZIP de artefatos',
})
export class ArtifactsZipModel {
  @Field(() => String, {
    description:
      'Nome sugerido do arquivo ZIP (ex: artifacts-projeto-telemedicina.zip)',
  })
  fileName!: string;

  @Field(() => String, {
    description: 'Tipo MIME do arquivo (application/zip)',
  })
  contentType!: string;

  @Field(() => Int, {
    description: 'Tamanho total do arquivo ZIP gerado em bytes',
  })
  sizeBytes!: number;

  @Field(() => String, {
    description: 'Conteúdo binário do arquivo compactado codificado em Base64',
  })
  base64!: string;

  @Field(() => [String], {
    description:
      'Lista completa de caminhos dos arquivos incluídos dentro do ZIP',
  })
  includedFiles!: string[];
}
