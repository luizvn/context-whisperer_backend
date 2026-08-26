import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserModel } from './user.model';

@Resolver(() => UserModel)
export class UserResolver {
  @Query(() => UserModel)
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: UserModel): UserModel {
    return user;
  }
}
