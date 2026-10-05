import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ScopeProposalModel } from '../scope-proposals/scope-proposal.model';
import { ArtifactModel } from '../artifacts/artifact.model';
import { ArtifactEvaluationModel } from '../artifacts/artifact-evaluation.model';

export enum RequisitionStatus {
  AWAITING_SCOPE = 'AWAITING_SCOPE',
  GENERATING = 'GENERATING',
  GENERATING_ARTIFACTS = 'GENERATING_ARTIFACTS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

registerEnumType(RequisitionStatus, {
  name: 'RequisitionStatus',
});

@ObjectType()
export class RequisitionModel {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field(() => String, {
    description: 'Nome do projeto atribuído pelo usuário',
  })
  name!: string;

  @Field()
  originalPrompt!: string;

  @Field(() => RequisitionStatus)
  status!: RequisitionStatus;

  @Field({ nullable: true })
  threadId?: string;

  @Field(() => [ScopeProposalModel], { nullable: true })
  scopeProposals?: ScopeProposalModel[];

  @Field(() => [ArtifactModel], { nullable: true })
  artifacts?: ArtifactModel[];

  @Field(() => [ArtifactEvaluationModel], { nullable: true })
  evaluations?: ArtifactEvaluationModel[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

export { RequisitionModel as Requisition };
