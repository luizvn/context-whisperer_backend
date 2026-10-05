import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/user.service';
import { FastifyRequest } from 'fastify';

interface RequestWithUser extends FastifyRequest {
  user?: unknown;
}

@Injectable()
export class SseAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // 1. Extrai token estritamente do header Authorization: Bearer <token>
    const token = this.extractTokenFromHeader(request);

    // 2. Veto explícito a tokens JWT trafegando em query parameters por segurança
    if (request.query) {
      const query = request.query as { token?: string };
      if (query.token) {
        throw new UnauthorizedException(
          'O envio de token JWT via query parameter (?token=...) não é permitido por motivos de segurança. Utilize o cabeçalho Authorization: Bearer <token>.',
        );
      }
    }

    if (!token) {
      throw new UnauthorizedException(
        'Token de autenticação não fornecido no cabeçalho Authorization para SSE',
      );
    }

    try {
      const secret =
        this.configService.get<string>('JWT_SECRET') || 'default-secret';
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token, {
        secret,
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException(
          'Usuário associado ao token não encontrado',
        );
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException(
        'Token inválido ou expirado para conexão SSE',
      );
    }
  }

  private extractTokenFromHeader(request: FastifyRequest): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
