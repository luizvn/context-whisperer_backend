import { Field, ObjectType } from '@nestjs/graphql';
import { UserModel } from '../../users/user.model';

@ObjectType()
export class AuthResponse {
  @Field()
  accessToken!: string;

  @Field(() => UserModel)
  user!: UserModel;
}
