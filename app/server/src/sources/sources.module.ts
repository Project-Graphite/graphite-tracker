import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AniListService } from './anilist/anilist.service';
import { ConnectorCacheService } from './connector-cache.service';
import { ConnectorHttpService } from './connector-http.service';
import { ConnectorRegistryService } from './connector-registry.service';
import { IgdbService } from './igdb/igdb.service';
import { MangaDexService } from './mangadex/mangadex.service';
import { MangaUpdatesService } from './mangaupdates/mangaupdates.service';
import { RawgService } from './rawg/rawg.service';
import { SourceSettingsController } from './source-settings.controller';
import { SourceSettingsService } from './source-settings.service';
import { TmdbService } from './tmdb/tmdb.service';

@Module({
  imports: [AuthModule],
  providers: [
    AniListService,
    ConnectorCacheService,
    ConnectorHttpService,
    ConnectorRegistryService,
    IgdbService,
    MangaDexService,
    MangaUpdatesService,
    RawgService,
    SourceSettingsService,
    TmdbService,
  ],
  controllers: [SourceSettingsController],
  exports: [ConnectorRegistryService],
})
export class SourcesModule {}
