import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '../modules/users/user.service';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(user: { id: string; email: string; role: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: '1h',
    });

    return {
      accessToken: token,
      user,
    };
  }

  async validateToken(token: string) {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as {
        sub: string;
        email: string;
        role: string;
      };
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Token inválido');
      }
      return user;
    } catch (error) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  get jwtSecret(): string {
    return process.env.JWT_SECRET || 'change_me_secure';
  }
}
