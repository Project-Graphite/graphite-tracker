import { Module } from '@nestjs/common';
import { TmdbService } from './tmdb/tmdb.service';

@Module({
  providers: [TmdbService],
  exports: [TmdbService],
})
export class SourcesModule {}
