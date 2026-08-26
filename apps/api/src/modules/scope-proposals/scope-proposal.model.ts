import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum ScopeProposalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

registerEnumType(ScopeProposalStatus, {
  name: 'ScopeProposalStatus',
});

@ObjectType()
export class ScopeProposalModel {
  @Field(() => ID)
  id!: string;

  @Field()
  requisitionId!: string;

  @Field()
  contentMd!: string;

  @Field(() => ScopeProposalStatus)
  status!: ScopeProposalStatus;

  @Field({ nullable: true })
  userFeedback?: string;

  @Field()
  createdAt!: Date;
}

export { ScopeProposalModel as ScopeProposal };
