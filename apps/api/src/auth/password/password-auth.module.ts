import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module.js';
import { JwtModule } from '../session/jwt.module.js';
import { PasswordAuthController } from './password-auth.controller.js';
import { PasswordAuthService } from './password-auth.service.js';

@Module({
  imports: [UsersModule, JwtModule],
  controllers: [PasswordAuthController],
  providers: [PasswordAuthService],
})
export class PasswordAuthModule {}

