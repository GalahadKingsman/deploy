import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminExpertsController } from './admin.experts.controller.js';
import { AdminSubscriptionsController } from './admin.subscriptions.controller.js';
import { AdminAuditController } from './admin-audit.controller.js';
import { AdminPaymentsController } from './admin.payments.controller.js';
import { AdminUsersController } from './admin.users.controller.js';
import { UsersModule } from '../../users/users.module.js';
import { ExpertsModule } from '../../experts/experts.module.js';
import { SubscriptionsModule } from '../../subscriptions/subscriptions.module.js';
import { JwtModule } from '../../auth/session/jwt.module.js';
import { AuditModule } from '../../audit/audit.module.js';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { PlatformRoleGuard } from '../../auth/rbac/platform-role.guard.js';
import { PaymentsModule } from '../../payments/payments.module.js';
import { AccessDataModule } from '../../access/access-data.module.js';

@Module({
  imports: [
    JwtModule,
    UsersModule,
    ExpertsModule,
    SubscriptionsModule,
    AuditModule,
    PaymentsModule,
    AccessDataModule,
  ],
  controllers: [
    AdminController,
    AdminExpertsController,
    AdminSubscriptionsController,
    AdminAuditController,
    AdminPaymentsController,
    AdminUsersController,
  ],
  providers: [JwtAuthGuard, PlatformRoleGuard],
})
export class AdminModule {}
