import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PublicReviewsController } from './public-reviews.controller';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [AuthModule],
  controllers: [PublicReviewsController, ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
