import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ProfileLibraryDto, ProfilePageDto } from './dto/users.dto';
import { ProfilesService } from './profiles.service';

@Controller('users/:handle')
@UseGuards(OptionalJwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  profile(@Param('handle') handle: string, @CurrentUser() viewer?: AuthenticatedUser) {
    return this.profiles.profile(handle, viewer);
  }

  @Get('activity')
  activity(
    @Param('handle') handle: string,
    @Query() query: ProfilePageDto,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.profiles.activity(handle, query.page, viewer);
  }

  @Get('library')
  library(
    @Param('handle') handle: string,
    @Query() query: ProfileLibraryDto,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.profiles.library(handle, query, viewer);
  }

  @Get('ratings')
  ratings(
    @Param('handle') handle: string,
    @Query() query: ProfilePageDto,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.profiles.ratings(handle, query.page, viewer);
  }

  @Get('reviews')
  reviews(
    @Param('handle') handle: string,
    @Query() query: ProfilePageDto,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.profiles.reviews(handle, query.page, viewer);
  }
}
