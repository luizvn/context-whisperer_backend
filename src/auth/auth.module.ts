import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { UsersModule } from '../modules/users/user.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [UsersModule],
  providers: [AuthService, AuthResolver, JwtAuthGuard, RolesGuard],
  exports: [AuthService],
})
export class AuthModule {}
