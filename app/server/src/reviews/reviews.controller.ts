import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimit } from '../redis/rate-limit.guard';
import { ReportReviewDto, SaveReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('items/:itemId/review')
  own(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.reviews.own(user.id, itemId);
  }

  @Put('items/:itemId/review')
  @RateLimit('reviews', 30, 3_600)
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() input: SaveReviewDto,
  ) {
    return this.reviews.save(user.id, itemId, input);
  }

  @Delete('items/:itemId/review')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.reviews.remove(user.id, itemId);
  }

  @Post('reviews/:id/reports')
  @RateLimit('reports', 20, 3_600)
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReportReviewDto,
  ) {
    return this.reviews.report(user.id, id, input.reason);
  }
}
