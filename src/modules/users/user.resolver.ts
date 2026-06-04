import { Resolver, Query } from '@nestjs/graphql';

@Resolver()
export class UserResolver {
  @Query(() => String)
  getUsers() {
    return 'Hello World!';
  }
}
