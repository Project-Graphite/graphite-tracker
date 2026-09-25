import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProfileLibraryDto, ProfilePageDto } from './dto/users.dto';
import { ProfilesService } from './profiles.service';

@Controller('users/:handle')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  profile(@Param('handle') handle: string) {
    return this.profiles.profile(handle);
  }

  @Get('activity')
  activity(@Param('handle') handle: string, @Query() query: ProfilePageDto) {
    return this.profiles.activity(handle, query.page);
  }

  @Get('library')
  library(@Param('handle') handle: string, @Query() query: ProfileLibraryDto) {
    return this.profiles.library(handle, query);
  }

  @Get('ratings')
  ratings(@Param('handle') handle: string, @Query() query: ProfilePageDto) {
    return this.profiles.ratings(handle, query.page);
  }

  @Get('reviews')
  reviews(@Param('handle') handle: string, @Query() query: ProfilePageDto) {
    return this.profiles.reviews(handle, query.page);
  }
}
