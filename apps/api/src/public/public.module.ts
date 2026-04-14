import { Module } from '@nestjs/common';
import { AccessDataModule } from '../access/access-data.module.js';
import { PublicCatalogController } from './public_catalog.controller.js';
import { PublicCourseCoversController } from './public_course_covers.controller.js';

@Module({
  imports: [AccessDataModule],
  controllers: [PublicCatalogController, PublicCourseCoversController],
})
export class PublicModule {}

