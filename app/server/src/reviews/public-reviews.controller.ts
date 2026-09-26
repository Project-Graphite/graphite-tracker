import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ListReviewsDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
@UseGuards(OptionalJwtAuthGuard)
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query() query: ListReviewsDto, @CurrentUser() viewer?: AuthenticatedUser) {
    return this.reviews.forSource(query.source, query.externalId, query.page, viewer);
  }
}
