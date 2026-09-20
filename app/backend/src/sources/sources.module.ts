import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConnectorCacheService } from './connector-cache.service';
import { ConnectorRegistryService } from './connector-registry.service';
import { IgdbService } from './igdb/igdb.service';
import { MangaDexService } from './mangadex/mangadex.service';
import { SourceSettingsController } from './source-settings.controller';
import { SourceSettingsService } from './source-settings.service';
import { TmdbService } from './tmdb/tmdb.service';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [
    ConnectorCacheService,
    ConnectorRegistryService,
    IgdbService,
    MangaDexService,
    SourceSettingsService,
    TmdbService,
  ],
  controllers: [SourceSettingsController],
  exports: [ConnectorRegistryService, TmdbService],
})
export class SourcesModule {}
