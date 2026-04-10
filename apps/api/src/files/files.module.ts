import { Module } from '@nestjs/common';
import { FilesController } from './files.controller.js';
import { StorageModule } from '../storage/storage.module.js';
import { JwtModule } from '../auth/session/jwt.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';

@Module({
  imports: [StorageModule, JwtModule, UsersModule, AuditModule],
  controllers: [FilesController],
  providers: [JwtAuthGuard],
})
export class FilesModule {}

