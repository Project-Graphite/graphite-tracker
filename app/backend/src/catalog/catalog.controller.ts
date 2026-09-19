import { Controller, Get, Query } from '@nestjs/common';
import { TmdbService } from '../sources/tmdb/tmdb.service';
import { BrowseCatalogDto } from './dto/browse-catalog.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly tmdb: TmdbService) {}

  @Get('search')
  search(@Query() query: SearchCatalogDto) {
    return this.tmdb.searchMovies(query.query, query.page);
  }

  @Get('movies/recent')
  recentMovies(@Query() query: BrowseCatalogDto) {
    return this.tmdb.recentMovies(query.page);
  }

  @Get('movies/popular')
  popularMovies(@Query() query: BrowseCatalogDto) {
    return this.tmdb.popularMovies(query.page);
  }
}
