import { Module } from '@nestjs/common';
import { SourcesModule } from '../sources/sources.module';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [SourcesModule],
  controllers: [CatalogController],
})
export class CatalogModule {}
