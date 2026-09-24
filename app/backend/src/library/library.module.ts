import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { SourcesModule } from '../sources/sources.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({
  imports: [AuthModule, CatalogModule, SourcesModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
