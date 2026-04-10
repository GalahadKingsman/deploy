import { Module } from '@nestjs/common';
import { AccessDataModule } from '../access/access-data.module.js';
import { PublicCatalogController } from './public_catalog.controller.js';

@Module({
  imports: [AccessDataModule],
  controllers: [PublicCatalogController],
})
export class PublicModule {}

