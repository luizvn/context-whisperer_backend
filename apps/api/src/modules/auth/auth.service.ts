import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/user.service';
import { UserModel } from '../users/user.model';
import { AuthResponse } from './dto/auth.response';
import * as bcrypt from 'bcrypt';

import { InvalidCredentialsException } from '../../common/exceptions';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async authenticate(email: string, pass: string): Promise<UserModel> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(pass, user.password))) {
      throw new InvalidCredentialsException();
    }
    const { password: _password, ...result } = user;
    return result;
  }

  async validateUser(email: string, pass: string): Promise<UserModel | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password: _password, ...result } = user;
      return result;
    }
    return null;
  }

  login(user: UserModel): AuthResponse {
    const payload = { email: user.email, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }
}
