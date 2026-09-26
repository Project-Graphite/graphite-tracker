import { Global, Module } from '@nestjs/common';
import { SourcesModule } from '../sources/sources.module';
import { SiteController } from './site.controller';
import { SiteSettingsService } from './site-settings.service';

@Global()
@Module({
  imports: [SourcesModule],
  controllers: [SiteController],
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteModule {}
