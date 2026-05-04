import { Injectable, Logger } from '@nestjs/common';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import { buildTinkoffRequestToken } from './tinkoff-token.util.js';

export interface TinkoffInitInput {
  orderId: string;
  amountCents: number;
  description: string;
  receiptEmail: string | null;
  receiptPhone: string | null;
}

/**
 * T-Bank docs give test base as `https://rest-api-test.tinkoff.ru/v2`; we always POST `…/v2/Init`.
 * If env already ends with `/v2`, strip it to avoid `/v2/v2/Init` (404 HTML instead of JSON).
 */
function resolveTinkoffInitUrl(baseUrlFromEnv: string): string {
  let base = baseUrlFromEnv.trim().replace(/\/+$/, '');
  if (/\/v2$/i.test(base)) {
    base = base.replace(/\/v2$/i, '');
  }
  base = base.replace(/\/+$/, '');
  return `${base}/v2/Init`;
}

@Injectable()
export class TinkoffAcquiringService {
  private readonly log = new Logger(TinkoffAcquiringService.name);

  isConfigured(): boolean {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    return Boolean(env.TINKOFF_TERMINAL_KEY?.trim() && env.TINKOFF_PASSWORD?.trim());
  }

  /**
   * POST /v2/Init — returns PaymentURL and PaymentId.
   */
  async initPayment(input: TinkoffInitInput): Promise<{ paymentId: string; paymentUrl: string; status: string }> {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    const terminalKey = env.TINKOFF_TERMINAL_KEY?.trim() ?? '';
    const password = env.TINKOFF_PASSWORD?.trim() ?? '';
    if (!terminalKey || !password) {
      throw new Error('TINKOFF_TERMINAL_KEY and TINKOFF_PASSWORD are required');
    }
    if (input.amountCents <= 0) {
      throw new Error('Amount must be positive');
    }

    const description = input.description.slice(0, 140);

    const body: Record<string, unknown> = {
      TerminalKey: terminalKey,
      Amount: input.amountCents,
      OrderId: input.orderId,
      Description: description,
      PayType: 'O',
      Language: 'ru',
    };

    if (env.TINKOFF_NOTIFICATION_URL?.trim()) {
      body.NotificationURL = env.TINKOFF_NOTIFICATION_URL.trim();
    }
    if (env.TINKOFF_SUCCESS_URL?.trim()) {
      body.SuccessURL = env.TINKOFF_SUCCESS_URL.trim();
    }
    if (env.TINKOFF_FAIL_URL?.trim()) {
      body.FailURL = env.TINKOFF_FAIL_URL.trim();
    }

    const hasContact = Boolean(
      (input.receiptEmail && input.receiptEmail.trim()) || (input.receiptPhone && input.receiptPhone.trim()),
    );
    if (hasContact) {
      const receipt: Record<string, unknown> = {
        Taxation: env.TINKOFF_RECEIPT_TAXATION,
        Items: [
          {
            Name: description.slice(0, 128),
            Price: input.amountCents,
            Quantity: 1,
            Amount: input.amountCents,
            Tax: env.TINKOFF_RECEIPT_TAX,
            PaymentMethod: 'full_payment',
            PaymentObject: 'service',
          },
        ],
      };
      if (input.receiptEmail?.trim()) receipt.Email = input.receiptEmail.trim();
      if (input.receiptPhone?.trim()) receipt.Phone = input.receiptPhone.trim();
      body.Receipt = receipt;
    }

    const token = buildTinkoffRequestToken(body, password);
    const payload = { ...body, Token: token };

    const url = resolveTinkoffInitUrl(env.TINKOFF_API_BASE_URL);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      this.log.warn(`Tinkoff Init network error: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }

    const rawText = await res.text();
    const trimmed = rawText.trim();
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    const looksLikeJson =
      trimmed.startsWith('{') || trimmed.startsWith('[') || ct.includes('application/json');
    if (!looksLikeJson && trimmed.startsWith('<')) {
      throw new Error(
        `Tinkoff вернул HTML (HTTP ${res.status}), ожидался JSON. Частые причины: (1) в TINKOFF_API_BASE_URL был лишний суффикс /v2 — используйте https://rest-api-test.tinkoff.ru или https://rest-api-test.tinkoff.ru/v2; (2) внешний IP сервера API не в белом списке тестовой среды rest-api-test.tinkoff.ru (оформите в чате Т-Бизнес).`,
      );
    }
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(trimmed || '{}') as Record<string, unknown>;
    } catch {
      throw new Error(
        `Tinkoff: тело ответа не JSON (HTTP ${res.status}): ${trimmed.slice(0, 160).replace(/\s+/g, ' ')}`,
      );
    }
    const success = json.Success === true || json.Success === 'true';
    if (!success) {
      const msg = [json.Message, json.Details, json.ErrorCode].filter(Boolean).join(' — ') || 'Init failed';
      this.log.warn(`Tinkoff Init rejected: ${msg}`);
      throw new Error(msg);
    }

    const paymentId = json.PaymentId != null ? String(json.PaymentId) : '';
    const paymentUrl = typeof json.PaymentURL === 'string' ? json.PaymentURL : '';
    const status = typeof json.Status === 'string' ? json.Status : 'NEW';
    if (!paymentId || !paymentUrl) {
      throw new Error('Tinkoff Init: missing PaymentId or PaymentURL');
    }
    return { paymentId, paymentUrl, status };
  }
}
