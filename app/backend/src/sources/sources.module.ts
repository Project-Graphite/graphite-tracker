import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConnectorCacheService } from './connector-cache.service';
import { ConnectorRegistryService } from './connector-registry.service';
import { IgdbService } from './igdb/igdb.service';
import { MangaDexService } from './mangadex/mangadex.service';
import { RawgService } from './rawg/rawg.service';
import { SourceSettingsController } from './source-settings.controller';
import { SourceSettingsService } from './source-settings.service';
import { TmdbService } from './tmdb/tmdb.service';

@Module({
  imports: [AuthModule],
  providers: [
    ConnectorCacheService,
    ConnectorRegistryService,
    IgdbService,
    MangaDexService,
    RawgService,
    SourceSettingsService,
    TmdbService,
  ],
  controllers: [SourceSettingsController],
  exports: [ConnectorRegistryService],
})
export class SourcesModule {}
