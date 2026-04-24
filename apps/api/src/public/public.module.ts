import { Module } from '@nestjs/common';
import { AccessDataModule } from '../access/access-data.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { PublicCatalogController } from './public_catalog.controller.js';
import { PublicCourseCoversController } from './public_course_covers.controller.js';
import { PublicAvatarsController } from './public_avatars.controller.js';
import { PublicLessonMediaController } from './public_lesson_media.controller.js';

@Module({
  imports: [AccessDataModule, StorageModule],
  controllers: [
    PublicCatalogController,
    PublicCourseCoversController,
    PublicAvatarsController,
    PublicLessonMediaController,
  ],
})
export class PublicModule {}

