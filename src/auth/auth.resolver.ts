import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthPayload } from './models/auth.payload';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { UserModel } from '../modules/users/user.model';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { AuthService } from './auth.service';
import { UsersService } from '../modules/users/user.service';

@Resolver(() => UserModel)
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Mutation(() => AuthPayload)
  async register(@Args('input') input: RegisterInput) {
    const user = await this.usersService.createUser({
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role,
    });

    return this.authService.login(user);
  }

  @Mutation(() => AuthPayload)
  async login(@Args('input') input: LoginInput) {
    const user = await this.authService.validateUser(input.email, input.password);
    if (!user) {
      throw new Error('Credenciais inválidas');
    }

    return this.authService.login(user);
  }

  @Query(() => UserModel)
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: UserModel) {
    return user;
  }

  @Query(() => String)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminProtected() {
    return 'Acesso autorizado para administradores';
  }
}
