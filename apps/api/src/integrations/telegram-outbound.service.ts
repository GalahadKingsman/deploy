import { Injectable, Logger } from '@nestjs/common';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';

/**
 * Best-effort Telegram Bot API sendMessage (for student notifications).
 */
@Injectable()
export class TelegramOutboundService {
  private readonly log = new Logger(TelegramOutboundService.name);

  async sendMessageToUser(telegramUserId: string, text: string): Promise<void> {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    const token = env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = telegramUserId?.trim();
    if (!token || !chatId || !text.trim()) return;

    const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.log.warn(`Telegram sendMessage failed: HTTP ${res.status} ${body.slice(0, 200)}`);
      }
    } catch (e) {
      this.log.warn(`Telegram sendMessage error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
