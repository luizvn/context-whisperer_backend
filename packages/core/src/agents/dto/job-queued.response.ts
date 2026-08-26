import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class JobQueuedResponse {
  @Field()
  jobId: string;

  @Field()
  status: string;

  @Field()
  requisitionId: string;
}
