import { Module } from '@nestjs/common';
import { TelegramAuthController } from './telegram-auth.controller.js';
import { TelegramAuthService } from './telegram-auth.service.js';
import { SiteBridgeController } from '../site-bridge/site-bridge.controller.js';
import { SiteBridgeService } from '../site-bridge/site-bridge.service.js';
import { JwtAuthGuard } from '../session/jwt-auth.guard.js';
import { UsersModule } from '../../users/users.module.js';
import { JwtModule } from '../session/jwt.module.js';
import { AuditModule } from '../../audit/audit.module.js';

@Module({
  imports: [UsersModule, JwtModule, AuditModule],
  controllers: [TelegramAuthController, SiteBridgeController],
  providers: [TelegramAuthService, SiteBridgeService, JwtAuthGuard],
})
export class TelegramAuthModule {}
