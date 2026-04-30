import { Module } from '@nestjs/common';
import { MailerService } from '../../common/mail/mailer.service.js';
import { UsersModule } from '../../users/users.module.js';
import { JwtModule } from '../session/jwt.module.js';
import { PasswordAuthController } from './password-auth.controller.js';
import { PasswordAuthService } from './password-auth.service.js';
import { PasswordResetRequestThrottle } from './password-reset-request-throttle.js';
import { PasswordResetController } from './password-reset.controller.js';
import { PasswordResetService } from './password-reset.service.js';

@Module({
  imports: [UsersModule, JwtModule],
  controllers: [PasswordAuthController, PasswordResetController],
  providers: [PasswordAuthService, PasswordResetService, MailerService, PasswordResetRequestThrottle],
})
export class PasswordAuthModule {}

