import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { UsersService } from '../users/user.service';
import { AuthResponse } from './dto/auth.response';
import { LoginInput } from './dto/login.input';
import { SignupInput } from './dto/signup.input';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Mutation(() => AuthResponse)
  async login(
    @Args('loginInput') loginInput: LoginInput,
  ): Promise<AuthResponse> {
    const user = await this.authService.authenticate(
      loginInput.email,
      loginInput.password,
    );
    return this.authService.login(user);
  }

  @Mutation(() => AuthResponse)
  async signup(
    @Args('signupInput') signupInput: SignupInput,
  ): Promise<AuthResponse> {
    const user = await this.usersService.createUser(signupInput);
    return this.authService.login(user);
  }
}
