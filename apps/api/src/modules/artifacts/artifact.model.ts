import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Artefato técnico gerado pelo fluxo de IA' })
export class ArtifactModel {
  @Field(() => ID)
  id!: string;

  @Field()
  requisitionId!: string;

  @Field()
  artifactType!: string;

  @Field()
  fileName!: string;

  @Field({ nullable: true })
  generatedContent?: string;

  @Field()
  status!: string;

  @Field(() => Int)
  iterationCount!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
