import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum RequisitionStatus {
  AWAITING_SCOPE = 'AWAITING_SCOPE',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

registerEnumType(RequisitionStatus, {
  name: 'RequisitionStatus',
});

@ObjectType()
export class Requisition {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  originalPrompt!: string;

  @Field(() => RequisitionStatus)
  status!: RequisitionStatus;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
