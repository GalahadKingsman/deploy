import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module.js';
import { AssignmentsModule } from '../../assignments/assignments.module.js';
import { SubmissionsModule } from '../../submissions/submissions.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { AccessDataModule } from '../../access/access-data.module.js';
import { BotSubmissionsController } from './bot-submissions.controller.js';
import { BotContactController } from './bot-contact.controller.js';
import { BotSupportController } from './bot-support.controller.js';
import { BotTokenGuard } from './bot-token.guard.js';
import { BotInternalGuard } from './bot-internal.guard.js';
import { SupportRoutingRepository } from './support-routing.repository.js';

@Module({
  imports: [UsersModule, AssignmentsModule, SubmissionsModule, StorageModule, AccessDataModule],
  controllers: [BotSubmissionsController, BotContactController, BotSupportController],
  providers: [BotTokenGuard, BotInternalGuard, SupportRoutingRepository],
})
export class BotModule {}

