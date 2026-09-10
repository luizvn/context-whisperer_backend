import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

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

  @Field()
  originalPrompt!: string;

  @Field(() => RequisitionStatus)
  status!: RequisitionStatus;

  @Field({ nullable: true })
  threadId?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

export { RequisitionModel as Requisition };
