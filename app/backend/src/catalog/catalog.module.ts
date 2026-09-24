import { Module } from '@nestjs/common';
import { SourcesModule } from '../sources/sources.module';
import { CatalogItemsService } from './catalog-items.service';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [SourcesModule],
  controllers: [CatalogController],
  providers: [CatalogItemsService],
  exports: [CatalogItemsService],
})
export class CatalogModule {}
