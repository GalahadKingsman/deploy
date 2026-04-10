import { Body, Controller, HttpCode, Logger, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import type { FastifyReply } from 'fastify';
import { verifyTinkoffNotification } from './tinkoff-token.util.js';
import { OrdersRepository } from './orders.repository.js';
import { OrderFulfillmentService } from './order-fulfillment.service.js';

function parseKopecks(body: Record<string, unknown>): number | null {
  const a = body.Amount;
  if (typeof a === 'number' && Number.isFinite(a)) return Math.trunc(a);
  if (typeof a === 'string' && a.trim()) {
    const n = parseInt(a.trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Public endpoint: Tinkoff POSTs payment notifications here.
 * Must respond HTTP 200 with body `OK` on success.
 */
@ApiExcludeController()
@Controller('payments')
export class TinkoffWebhookController {
  private readonly log = new Logger(TinkoffWebhookController.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly fulfillment: OrderFulfillmentService,
  ) {}

  @Post('tinkoff/notification')
  @HttpCode(200)
  async handleNotification(@Body() body: Record<string, unknown>, @Res() reply: FastifyReply): Promise<void> {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    const password = env.TINKOFF_PASSWORD?.trim() ?? '';

    const sendOk = () => {
      reply.type('text/plain; charset=utf-8').send('OK');
    };

    if (!password) {
      this.log.warn('Tinkoff notification: TINKOFF_PASSWORD not set, ignoring payload');
      sendOk();
      return;
    }

    const receivedToken = typeof body.Token === 'string' ? body.Token : '';
    if (!receivedToken || !verifyTinkoffNotification(body, password, receivedToken)) {
      this.log.warn('Tinkoff notification: invalid Token');
      reply.code(401).type('text/plain; charset=utf-8').send('INVALID');
      return;
    }

    const terminalKeyEnv = env.TINKOFF_TERMINAL_KEY?.trim() ?? '';
    const terminalKeyBody = typeof body.TerminalKey === 'string' ? body.TerminalKey.trim() : '';
    if (terminalKeyEnv && terminalKeyBody && terminalKeyBody !== terminalKeyEnv) {
      this.log.warn('Tinkoff notification: TerminalKey mismatch');
      reply.code(401).type('text/plain; charset=utf-8').send('INVALID');
      return;
    }

    const orderId = typeof body.OrderId === 'string' ? body.OrderId : '';
    const paymentId = body.PaymentId != null ? String(body.PaymentId).trim() : '';
    const status = typeof body.Status === 'string' ? body.Status : '';
    const success = body.Success === true || body.Success === 'true';

    if (!orderId) {
      this.log.warn('Tinkoff notification: missing OrderId');
      sendOk();
      return;
    }

    const order = await this.ordersRepository.findRawById(orderId);
    if (!order) {
      this.log.warn(`Tinkoff notification: unknown OrderId=${orderId}`);
      sendOk();
      return;
    }

    const amount = parseKopecks(body);
    if (amount == null) {
      this.log.warn(`Tinkoff notification: missing/invalid Amount for ${orderId}`);
      reply.code(401).type('text/plain; charset=utf-8').send('INVALID');
      return;
    }
    if (amount !== order.amountCents) {
      this.log.warn(
        `Tinkoff notification: Amount mismatch for ${orderId} (got ${amount}, expected ${order.amountCents})`,
      );
      reply.code(401).type('text/plain; charset=utf-8').send('INVALID');
      return;
    }

    if (order.providerPaymentId) {
      if (!paymentId || order.providerPaymentId !== paymentId) {
        this.log.warn(`Tinkoff notification: PaymentId missing or mismatch for ${orderId}`);
        reply.code(401).type('text/plain; charset=utf-8').send('INVALID');
        return;
      }
    } else if (!paymentId) {
      this.log.warn(`Tinkoff notification: PaymentId required for ${orderId} (no stored provider payment id)`);
      reply.code(401).type('text/plain; charset=utf-8').send('INVALID');
      return;
    }

    try {
      await this.ordersRepository.updateProviderFields(orderId, {
        provider: 'tinkoff',
        providerStatus: status || null,
        ...(paymentId ? { providerPaymentId: paymentId } : {}),
      });
    } catch (e) {
      this.log.error(
        `Tinkoff notification: failed to update provider fields for ${orderId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      reply.code(500).type('text/plain; charset=utf-8').send('ERROR');
      return;
    }

    const terminalFailStatuses = new Set(['REJECTED', 'DEADLINE_EXPIRED']);
    const cancelledStatuses = new Set(['REVERSED', 'CANCELED', 'CANCELLED']);
    const refundedStatuses = new Set(['REFUNDED']);

    try {
      if (success && status === 'CONFIRMED') {
        const r = await this.fulfillment.completeOrderPayment(orderId);
        if (r.kind === 'not_found') {
          this.log.warn(`Tinkoff notification: CONFIRMED for unknown OrderId=${orderId}`);
        } else if (r.kind === 'invalid_state') {
          this.log.warn(`Tinkoff notification: CONFIRMED but order state is ${r.status} for ${orderId}`);
        }
      } else if (refundedStatuses.has(status)) {
        const fromPaid = await this.ordersRepository.setOrderStatusIf(orderId, 'refunded', ['paid']);
        const fromCreated = fromPaid ? false : await this.ordersRepository.setOrderStatusIf(orderId, 'refunded', ['created']);
        if (!fromPaid && !fromCreated) {
          await this.ordersRepository.setOrderStatusIf(orderId, 'refunded', ['refunded']);
        }
      } else if (cancelledStatuses.has(status)) {
        const updated = await this.ordersRepository.setOrderStatusIf(orderId, 'cancelled', ['created']);
        if (!updated) {
          await this.ordersRepository.setOrderStatusIf(orderId, 'cancelled', ['cancelled']);
        }
      } else if (terminalFailStatuses.has(status) || (!success && status && terminalFailStatuses.has(status))) {
        const updated = await this.ordersRepository.setOrderStatusIf(orderId, 'failed', ['created']);
        if (!updated) {
          await this.ordersRepository.setOrderStatusIf(orderId, 'failed', ['failed']);
        }
      } else if (!success && status === 'REJECTED') {
        await this.ordersRepository.setOrderStatusIf(orderId, 'failed', ['created']);
      }
    } catch (e) {
      this.log.error(
        `Tinkoff notification: state/fulfill handler failed for ${orderId}: ${e instanceof Error ? e.message : String(e)}`,
      );
      reply.code(500).type('text/plain; charset=utf-8').send('ERROR');
      return;
    }

    sendOk();
  }
}
