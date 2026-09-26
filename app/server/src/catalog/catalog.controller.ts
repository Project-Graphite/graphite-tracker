import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RateLimit } from '../redis/rate-limit.guard';
import { ConnectorRegistryService } from '../sources/connector-registry.service';
import { CatalogCategory, catalogCategories } from '../sources/source.types';
import { BrowseCatalogDto } from './dto/browse-catalog.dto';
import { RecognizeSourceDto } from './dto/recognize-source.dto';
import { SearchCatalogDto } from './dto/search-catalog.dto';

function showsAdultContent(viewer?: AuthenticatedUser) {
  return viewer?.showAdultContent === true;
}

@Controller('catalog')
@UseGuards(OptionalJwtAuthGuard)
export class CatalogController {
  constructor(private readonly connectors: ConnectorRegistryService) {}

  @Get('sources')
  sources(@Query('category') category?: string) {
    return this.connectors
      .list(category ? this.category(category) : undefined)
      .map(({ key, displayName, enabled }) => ({ key, displayName, enabled }));
  }

  @Get('recognize')
  @RateLimit('catalog', 120, 60)
  recognize(@Query() query: RecognizeSourceDto) {
    return this.connectors.recognize(query.url);
  }

  @Get(':category/search')
  @RateLimit('catalog', 120, 60)
  searchCategory(
    @Param('category') category: string,
    @Query() query: SearchCatalogDto,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    const { source, query: term, page, ...filters } = query;
    return this.connectors.search(
      this.category(category),
      term,
      page,
      { ...filters, adult: showsAdultContent(viewer) },
      source,
    );
  }

  @Get(':category/recent')
  @RateLimit('catalog', 120, 60)
  recentCategory(
    @Param('category') category: string,
    @Query() query: BrowseCatalogDto,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.browseCategory(category, 'recent', query, viewer);
  }

  @Get(':category/popular')
  @RateLimit('catalog', 120, 60)
  popularCategory(
    @Param('category') category: string,
    @Query() query: BrowseCatalogDto,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.browseCategory(category, 'popular', query, viewer);
  }

  @Get(':category/genres')
  genres(@Param('category') category: string, @Query('source') source?: string) {
    return this.connectors.genres(this.category(category), source);
  }

  @Get(':category/:externalId')
  @RateLimit('catalog', 120, 60)
  details(
    @Param('category') category: string,
    @Param('externalId') externalId: string,
    @Query('source') source?: string,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.connectors.details(
      this.category(category),
      externalId,
      source,
      showsAdultContent(viewer),
    );
  }

  private browseCategory(
    category: string,
    section: 'recent' | 'popular',
    query: BrowseCatalogDto,
    viewer?: AuthenticatedUser,
  ) {
    const { source, page, ...filters } = query;
    return this.connectors.browse(
      this.category(category),
      section,
      page,
      { ...filters, adult: showsAdultContent(viewer) },
      source,
    );
  }

  private category(value: string): CatalogCategory {
    if (!(catalogCategories as readonly string[]).includes(value)) {
      throw new BadRequestException('Unsupported media category');
    }
    return value as CatalogCategory;
  }
}
