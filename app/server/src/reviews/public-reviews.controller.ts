import { Controller, Get, Query } from '@nestjs/common';
import { ListReviewsDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query() query: ListReviewsDto) {
    return this.reviews.forSource(query.source, query.externalId, query.page);
  }
}
