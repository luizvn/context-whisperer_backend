import { Field, ObjectType } from '@nestjs/graphql';
import { UserModel } from '../../modules/users/user.model';

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken!: string;

  @Field(() => UserModel)
  user!: UserModel;
}
