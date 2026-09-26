import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SourcesModule } from '../sources/sources.module';
import { CatalogItemsService } from './catalog-items.service';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [AuthModule, SourcesModule],
  controllers: [CatalogController],
  providers: [CatalogItemsService],
  exports: [CatalogItemsService],
})
export class CatalogModule {}
