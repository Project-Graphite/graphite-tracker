import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { LibraryModule } from '../library/library.module';
import { SourcesModule } from '../sources/sources.module';
import { ImportMatcherService } from './import-matcher.service';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [AuthModule, CatalogModule, LibraryModule, SourcesModule],
  controllers: [ImportsController],
  providers: [ImportMatcherService, ImportsService],
})
export class ImportsModule {}
