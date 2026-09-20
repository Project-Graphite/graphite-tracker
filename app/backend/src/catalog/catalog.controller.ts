import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ConnectorRegistryService } from '../sources/connector-registry.service';
import { CatalogCategory } from '../sources/source.types';
import { TmdbService } from '../sources/tmdb/tmdb.service';
import { BrowseCatalogDto } from './dto/browse-catalog.dto';
import { RecognizeSourceDto } from './dto/recognize-source.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly tmdb: TmdbService,
    private readonly connectors: ConnectorRegistryService,
  ) {}

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

  @Get('movies/:externalId')
  movieDetails(@Param('externalId', ParseIntPipe) externalId: number) {
    return this.tmdb.movieDetails(String(externalId));
  }

  @Get('sources')
  sources(@Query('category') category?: string) {
    return this.connectors.list(category ? this.category(category) : undefined);
  }

  @Get('recognize')
  recognize(@Query() query: RecognizeSourceDto) {
    return this.connectors.recognize(query.url);
  }

  @Get(':category/search')
  searchCategory(
    @Param('category') category: string,
    @Query() query: SearchCatalogDto,
  ) {
    const { source, query: term, page, ...filters } = query;
    return this.connectors.search(
      this.category(category),
      term,
      page,
      filters,
      source,
    );
  }

  @Get(':category/recent')
  recentCategory(
    @Param('category') category: string,
    @Query() query: BrowseCatalogDto,
  ) {
    return this.browseCategory(category, 'recent', query);
  }

  @Get(':category/popular')
  popularCategory(
    @Param('category') category: string,
    @Query() query: BrowseCatalogDto,
  ) {
    return this.browseCategory(category, 'popular', query);
  }

  @Get(':category/:externalId')
  details(
    @Param('category') category: string,
    @Param('externalId') externalId: string,
    @Query('source') source?: string,
  ) {
    return this.connectors.details(this.category(category), externalId, source);
  }

  private browseCategory(
    category: string,
    section: 'recent' | 'popular',
    query: BrowseCatalogDto,
  ) {
    const { source, page, ...filters } = query;
    return this.connectors.browse(
      this.category(category),
      section,
      page,
      filters,
      source,
    );
  }

  private category(value: string): CatalogCategory {
    if (!['movie', 'tv', 'anime', 'manga', 'manhwa', 'game'].includes(value)) {
      throw new BadRequestException('Unsupported media category');
    }
    return value as CatalogCategory;
  }
}
