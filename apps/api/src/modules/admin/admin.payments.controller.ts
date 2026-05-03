import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { PlatformRoleGuard } from '../../auth/rbac/platform-role.guard.js';
import { RequirePlatformRole } from '../../auth/rbac/require-platform-role.decorator.js';
import type { FastifyRequest } from 'fastify';
import { OrdersRepository } from '../../payments/orders.repository.js';
import { CommissionsRepository } from '../../payments/commissions.repository.js';
import { AuditService } from '../../audit/audit.service.js';
import { OrderFulfillmentService } from '../../payments/order-fulfillment.service.js';
import { RefundRequestsRepository } from '../../payments/refund-requests.repository.js';

@ApiTags('Admin')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, PlatformRoleGuard)
@ApiBearerAuth()
export class AdminPaymentsController {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly commissionsRepository: CommissionsRepository,
    private readonly fulfillment: OrderFulfillmentService,
    private readonly auditService: AuditService,
    private readonly refundRequestsRepository: RefundRequestsRepository,
  ) {}

  @Post('orders/:orderId/mark-paid')
  @RequirePlatformRole('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark order as paid (subscription or legacy course enrollment) (admin+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async markPaid(
    @Param('orderId') orderId: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ ok: true; orderId: string; enrollment: ContractsV1.EnrollmentV1 | null }> {
    const order = await this.ordersRepository.findRawById(orderId);
    if (!order) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Order not found' });

    const done = await this.fulfillment.completeOrderPayment(orderId);
    if (done.kind === 'already_paid') {
      throw new BadRequestException({ code: ErrorCodes.CONFLICT, message: 'Order already paid' });
    }
    if (done.kind === 'invalid_state') {
      throw new BadRequestException({
        code: ErrorCodes.CONFLICT,
        message:
          done.status === 'missing_expert_id'
            ? 'Order is expert_subscription but expert_id is missing'
            : `Order cannot be marked paid (status=${done.status})`,
      });
    }
    if (done.kind === 'not_found') {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Order not found' });
    }
    const enrollment = done.enrollment;

    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.payments.order.mark_paid',
      entityType: 'order',
      entityId: orderId,
      meta: {
        orderId,
        userId: order.userId,
        orderKind: order.orderKind,
        courseId: order.courseId,
        expertId: order.expertId,
        referralCode: order.referralCode,
      },
      traceId: req.traceId ?? null,
    });

    return { ok: true, orderId, enrollment };
  }

  @Get('orders')
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'List orders (admin+)' })
  @ApiResponse({ status: 200, description: 'Orders list' })
  async listOrders(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('courseId') courseId?: string,
    @Query('limit') limitStr?: string,
  ): Promise<{ items: ContractsV1.OrderV1[] }> {
    const limit = limitStr ? Math.max(1, Math.min(200, parseInt(limitStr, 10))) : 50;
    const res = await this.ordersRepository.list({
      limit,
      status: status && status.trim() ? status.trim() : undefined,
      userId: userId && userId.trim() ? userId.trim() : undefined,
      courseId: courseId && courseId.trim() ? courseId.trim() : undefined,
    });
    return { items: res.items };
  }

  @Post('orders/:orderId/refund-requests')
  @RequirePlatformRole('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create stub refund request for order (no bank API)' })
  @ApiResponse({ status: 201, description: 'Created' })
  async createRefundRequest(
    @Param('orderId') orderId: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ item: ContractsV1.PaymentRefundRequestV1 }> {
    const order = await this.ordersRepository.findRawById(orderId);
    if (!order) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Order not found' });

    const raw = body && typeof body === 'object' && body !== null && 'note' in body ? (body as { note?: unknown }).note : undefined;
    const noteStr = typeof raw === 'string' ? raw.trim() : '';
    if (noteStr.length > 2000) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'note too long' });
    }
    const note = noteStr ? noteStr : null;
    const item = await this.refundRequestsRepository.create({
      orderId,
      createdByUserId: req.user?.userId ?? null,
      note,
    });

    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.payments.refund_request.create_stub',
      entityType: 'order',
      entityId: orderId,
      meta: { orderId, refundRequestId: item.id },
      traceId: req.traceId ?? null,
    });

    return { item };
  }

  @Get('refund-requests')
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'List stub refund requests for an order' })
  @ApiResponse({ status: 200, description: 'List' })
  async listRefundRequests(
    @Query('orderId') orderId: string | undefined,
  ): Promise<ContractsV1.ListPaymentRefundRequestsResponseV1> {
    const id = orderId?.trim() ?? '';
    if (!id) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'orderId query required' });
    }
    const items = await this.refundRequestsRepository.listByOrderId(id);
    return { items };
  }

  @Get('commissions')
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'List commissions (admin+)' })
  @ApiResponse({ status: 200, description: 'Commissions list' })
  async listCommissions(
    @Query('referralCode') referralCode?: string,
    @Query('limit') limitStr?: string,
  ): Promise<{ items: Array<{ id: string; orderId: string; referralCode: string; amountCents: number; createdAt: string }> }> {
    const limit = limitStr ? Math.max(1, Math.min(200, parseInt(limitStr, 10))) : 50;
    const res = await this.commissionsRepository.list({
      limit,
      referralCode: referralCode && referralCode.trim() ? referralCode.trim() : undefined,
    });
    return {
      items: res.items.map((c) => ({
        id: c.id,
        orderId: c.order_id,
        referralCode: c.referral_code,
        amountCents: c.amount_cents ?? 0,
        createdAt: c.created_at.toISOString(),
      })),
    };
  }
}

