import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiEnvSchema, ContractsV1, ErrorCodes, validateOrThrow } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyRequest } from 'fastify';
import { OrdersRepository } from './orders.repository.js';
import { TinkoffAcquiringService } from './tinkoff-acquiring.service.js';
import { ExpertsRepository } from '../experts/experts.repository.js';
import { ExpertSubscriptionsRepository } from '../subscriptions/expert-subscriptions.repository.js';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  private readonly log = new Logger(PaymentsController.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly tinkoff: TinkoffAcquiringService,
    private readonly expertsRepository: ExpertsRepository,
    private readonly expertSubscriptionsRepository: ExpertSubscriptionsRepository,
  ) {}

  @Post('checkout/expert-subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create checkout for expert platform subscription (Tinkoff)' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async createExpertSubscriptionCheckout(
    @Body() body: ContractsV1.CreateExpertSubscriptionCheckoutRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.CreateExpertSubscriptionCheckoutResponseV1> {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    if (env.PAYMENTS_ENABLED !== true) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Payments are disabled' });
    }
    const parsed = ContractsV1.CreateExpertSubscriptionCheckoutRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }

    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });

    const expert = await this.expertsRepository.findByCreatedByUserId(userId);
    if (!expert) {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: 'Only the expert workspace owner can purchase a subscription',
      });
    }

    await this.expertSubscriptionsRepository.ensureDefault(expert.id);
    const sub = await this.expertSubscriptionsRepository.findByExpertId(expert.id);
    if (!sub) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Subscription row missing' });
    }

    const amountCents = sub.priceCents ?? 0;
    if (amountCents <= 0) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Expert subscription price is not configured (price_cents is 0)',
      });
    }

    const referralCode =
      typeof parsed.data.referralCode === 'string' && parsed.data.referralCode.trim()
        ? parsed.data.referralCode.trim()
        : null;

    const existing = await this.ordersRepository.findLatestCreatedExpertSubscriptionByUser({ userId });
    if (existing?.payUrl) {
      return { order: existing, payUrl: existing.payUrl };
    }

    if (existing) {
      return this.tryInitTinkoffAndPersist({
        userId,
        order: existing,
        description: 'Подписка EDIFY для эксперта',
        receiptEmail: parsed.data.email ?? existing.receiptEmail ?? null,
        receiptPhone: parsed.data.phone ?? existing.receiptPhone ?? null,
      });
    }

    const order = await this.ordersRepository.createExpertSubscriptionOrder({
      userId,
      expertId: expert.id,
      amountCents,
      currency: 'RUB',
      referralCode,
      receiptEmail: parsed.data.email ?? null,
      receiptPhone: parsed.data.phone ?? null,
    });

    return this.tryInitTinkoffAndPersist({
      userId,
      order,
      description: 'Подписка EDIFY для эксперта',
      receiptEmail: parsed.data.email ?? null,
      receiptPhone: parsed.data.phone ?? null,
    });
  }

  private async tryInitTinkoffAndPersist(params: {
    userId: string;
    order: ContractsV1.OrderV1;
    description: string;
    receiptEmail: string | null;
    receiptPhone: string | null;
  }): Promise<ContractsV1.CreateExpertSubscriptionCheckoutResponseV1> {
    if (!this.tinkoff.isConfigured() || (params.order.amountCents ?? 0) <= 0) {
      return { order: params.order, payUrl: params.order.payUrl ?? null };
    }
    try {
      const init = await this.tinkoff.initPayment({
        orderId: params.order.id,
        amountCents: params.order.amountCents,
        description: params.description,
        receiptEmail: params.receiptEmail,
        receiptPhone: params.receiptPhone,
      });
      await this.ordersRepository.updateProviderFields(params.order.id, {
        provider: 'tinkoff',
        providerPaymentId: init.paymentId,
        providerStatus: init.status,
        payUrl: init.paymentUrl,
      });
      const updated =
        (await this.ordersRepository.findByIdForUser({ orderId: params.order.id, userId: params.userId })) ??
        params.order;
      return { order: updated, payUrl: init.paymentUrl };
    } catch (e) {
      this.log.warn(
        `Tinkoff Init failed for order ${params.order.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { order: params.order, payUrl: params.order.payUrl ?? null };
    }
  }

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my order by id' })
  @ApiResponse({ status: 200, description: 'Order' })
  async getMyOrder(
    @Param('orderId') orderId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<{ order: ContractsV1.OrderV1 }> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const order = await this.ordersRepository.findByIdForUser({ orderId, userId });
    if (!order) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Order not found' });
    return { order };
  }

  @Get('me/orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my orders (subscription payments)' })
  @ApiResponse({ status: 200, description: 'Orders list' })
  async listMyOrders(
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.MeOrdersResponseV1> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const items = await this.ordersRepository.listByUser({ userId, limit: 100 });
    return { items };
  }
}
