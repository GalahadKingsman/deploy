import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  isPasswordResetMailConfigured(): boolean {
    try {
      const env = validateOrThrow(ApiEnvSchema, process.env);
      return Boolean(
        env.PUBLIC_WEB_ORIGIN?.trim() &&
          env.SMTP_HOST?.trim() &&
          env.SMTP_PORT &&
          env.SMTP_USER?.trim() &&
          env.SMTP_PASS !== undefined &&
          env.SMTP_PASS !== '' &&
          env.MAIL_FROM?.trim(),
      );
    } catch {
      return false;
    }
  }

  async sendPasswordResetEmail(params: { to: string; resetUrl: string; expiresAtIso: string }): Promise<void> {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    if (!this.isPasswordResetMailConfigured()) {
      throw new Error('Mailer: SMTP / PUBLIC_WEB_ORIGIN / MAIL_FROM not configured');
    }
    const port = Number(env.SMTP_PORT);
    const secure =
      env.SMTP_SECURE !== undefined && env.SMTP_SECURE !== null
        ? Boolean(env.SMTP_SECURE)
        : port === 465;
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST!,
      port,
      secure,
      // Mailtrap и др.: TLS обязателен; на 2525/587 — STARTTLS до AUTH.
      ...(secure ? {} : { requireTLS: true }),
      auth: {
        user: env.SMTP_USER!,
        pass: env.SMTP_PASS!,
      },
      // Иначе при недоступном SMTP запрос висит до таймаута nginx (504) и браузер показывает «CORS».
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 25_000,
    });

    const expiresRu = new Date(params.expiresAtIso).toLocaleString('ru-RU', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    const subject = 'Восстановление пароля EDIFY';
    const text =
      `Здравствуйте.\n\n` +
      `Вы (или кто-то другой) запросили восстановление пароля на платформе EDIFY.\n` +
      `Ссылка одноразовая и действует до: ${expiresRu}.\n\n` +
      `Если это были не вы, просто проигнорируйте это письмо — пароль не изменится.\n\n` +
      `Восстановить пароль:\n${params.resetUrl}\n`;

    const buttonHtml = `<a href="${escapeHtml(params.resetUrl)}" style="display:inline-block;padding:12px 20px;background:#0AA8C8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-family:system-ui,sans-serif;">Восстановить пароль</a>`;
    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.55;color:#0C1220;">
<p>Здравствуйте.</p>
<p>Вы (или кто-то другой) запросили <strong>восстановление пароля</strong> на платформе EDIFY.</p>
<p>Ссылка <strong>одноразовая</strong> и действует до: <strong>${escapeHtml(expiresRu)}</strong>.</p>
<p>Если это были не вы, проигнорируйте письмо — пароль не изменится.</p>
<p style="margin:24px 0">${buttonHtml}</p>
<p style="font-size:13px;color:#4A5268">Если кнопка не открывается, скопируйте ссылку в браузер:</p>
<p style="font-size:12px;word-break:break-all;color:#4A5268">${escapeHtml(params.resetUrl)}</p>
</body></html>`;

    await transporter.sendMail({
      from: env.MAIL_FROM!,
      to: params.to,
      subject,
      text,
      html,
    });
    this.logger.log(`Password reset email sent to ${params.to}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
