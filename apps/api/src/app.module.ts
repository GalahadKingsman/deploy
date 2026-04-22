import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { TelegramAuthModule } from './auth/telegram/telegram-auth.module.js';
import { PasswordAuthModule } from './auth/password/password-auth.module.js';
import { MeModule } from './modules/me/me.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { ExpertModule } from './modules/expert/expert.module.js';
import { StudentModule } from './student/student.module.js';
import { BotModule } from './modules/bot/bot.module.js';
import { PublicModule } from './public/public.module.js';
import { FilesModule } from './files/files.module.js';
import { PaymentsModule } from './payments/payments.module.js';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    TelegramAuthModule,
    PasswordAuthModule,
    MeModule,
    AdminModule,
    ExpertModule,
    StudentModule,
    BotModule,
    PublicModule,
    FilesModule,
    PaymentsModule,
  ],
})
export class AppModule {}
