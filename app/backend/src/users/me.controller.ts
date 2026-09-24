import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdatePrivacyDto, UpdateProfileDto } from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.me(user.id);
  }

  @Patch()
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateProfileDto) {
    return this.users.updateProfile(user.id, input);
  }

  @Patch('privacy')
  updatePrivacy(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdatePrivacyDto) {
    return this.users.updatePrivacy(user.id, input);
  }
}
