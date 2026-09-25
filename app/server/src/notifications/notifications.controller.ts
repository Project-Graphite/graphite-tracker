import { Body, Controller, Get, HttpCode, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimit } from '../redis/rate-limit.guard';
import { UnsubscribeDto, UpdateNotificationPreferencesDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me/notification-preferences')
  @UseGuards(JwtAuthGuard)
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.preferences(user.id);
  }

  @Patch('me/notification-preferences')
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateNotificationPreferencesDto) {
    return this.notifications.update(user.id, input);
  }

  @Post('notifications/unsubscribe')
  @HttpCode(200)
  @RateLimit('unsubscribe', 30, 3_600)
  unsubscribe(@Query() query: UnsubscribeDto) {
    return this.notifications.unsubscribe(query.token);
  }
}
