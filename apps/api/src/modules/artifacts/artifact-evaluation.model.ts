import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description: 'Auditoria e avaliação causal registrada pelo Agente Juiz',
})
export class ArtifactEvaluationModel {
  @Field(() => ID)
  id!: string;

  @Field()
  artifactId!: string;

  @Field()
  requisitionId!: string;

  @Field(() => Int)
  iteration!: number;

  @Field()
  status!: string;

  @Field(() => Float)
  score!: number;

  @Field()
  summary!: string;

  @Field(() => [String])
  rootCauses!: string[];

  @Field({ nullable: true })
  counterfactualFeedback?: string;

  @Field()
  createdAt!: Date;
}
