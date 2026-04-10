import { Module } from '@nestjs/common';
import { ExpertsModule } from '../../experts/experts.module.js';
import { AuditModule } from '../../audit/audit.module.js';
import { ExpertRoleGuard } from './expert-role.guard.js';

@Module({
  imports: [ExpertsModule, AuditModule],
  providers: [ExpertRoleGuard],
  exports: [ExpertRoleGuard],
})
export class ExpertRbacModule {}
