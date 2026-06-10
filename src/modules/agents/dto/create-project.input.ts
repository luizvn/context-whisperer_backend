import { Field, InputType } from '@nestjs/graphql';
import { ArtifactType } from '../../artifacts/artifact-type.enum';

@InputType()
export class CreateProjectInput {
  @Field()
  name!: string;

  @Field()
  prompt!: string;

  @Field(() => [ArtifactType])
  artifacts!: ArtifactType[];
}
