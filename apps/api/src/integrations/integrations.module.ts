import { Module } from '@nestjs/common';
import { TelegramOutboundService } from './telegram-outbound.service.js';

@Module({
  providers: [TelegramOutboundService],
  exports: [TelegramOutboundService],
})
export class IntegrationsModule {}
