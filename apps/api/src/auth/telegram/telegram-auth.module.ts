import { Module } from '@nestjs/common';
import { TelegramAuthController } from './telegram-auth.controller.js';
import { TelegramAuthService } from './telegram-auth.service.js';
import { UsersModule } from '../../users/users.module.js';
import { JwtModule } from '../session/jwt.module.js';
import { AuditModule } from '../../audit/audit.module.js';

@Module({
  imports: [UsersModule, JwtModule, AuditModule],
  controllers: [TelegramAuthController],
  providers: [TelegramAuthService],
})
export class TelegramAuthModule {}
