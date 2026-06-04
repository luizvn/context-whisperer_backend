import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext().req || gqlContext.getContext().request;

    const authorization =
      request?.headers?.authorization || request?.headers?.Authorization;
    if (!authorization || typeof authorization !== 'string') {
      throw new UnauthorizedException('Token de autorização ausente');
    }

    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Cabeçalho Authorization inválido');
    }

    const user = await this.authService.validateToken(token);
    request.user = user;
    gqlContext.getContext().user = user;
    return true;
  }
}
