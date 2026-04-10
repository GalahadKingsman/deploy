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

    const baseUrl = env.TINKOFF_API_BASE_URL.replace(/\/$/, '');
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

    const url = `${baseUrl}/v2/Init`;
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

    const json = (await res.json()) as Record<string, unknown>;
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
