import { Field, InputType } from '@nestjs/graphql';
import { ArtifactType } from './artifact-type.enum';
import { IsArray, IsEnum, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateProjectInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @Field(() => [ArtifactType])
  @IsArray()
  @IsEnum(ArtifactType, { each: true })
  artifacts!: ArtifactType[];
}
