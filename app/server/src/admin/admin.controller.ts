import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimit } from '../redis/rate-limit.guard';
import { SiteSettingsService } from '../site/site-settings.service';
import { AdminGuard, SystemManagerGuard } from './admin.guard';
import { AdminService } from './admin.service';
import {
  AdminPageDto,
  ListReportsDto,
  ListReviewsDto,
  ListUsersDto,
  ResolveReportDto,
  SetReviewHiddenDto,
  SetUserActiveDto,
  SetUserRoleDto,
  UpdateSiteSettingsDto,
} from './dto/admin.dto';
import { UuidPipe } from '../validation/uuid.pipe';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly auth: AuthService,
    private readonly site: SiteSettingsService,
  ) {}

  @Get('reports')
  reports(@Query() query: ListReportsDto) {
    return this.admin.reports(query.status, query.page);
  }

  @Patch('reports/:id')
  @HttpCode(204)
  async resolveReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
    @Body() input: ResolveReportDto,
  ) {
    await this.admin.resolveReport(user.id, id, input.resolution);
  }

  @Get('reviews')
  reviews(@Query() query: ListReviewsDto) {
    return this.admin.reviews(query.status, query.page);
  }

  @Patch('reviews/:id')
  @HttpCode(204)
  async setReviewHidden(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
    @Body() input: SetReviewHiddenDto,
  ) {
    await this.admin.setReviewHidden(user.id, id, input.hidden);
  }

  @Get('notifications')
  failedNotifications(@Query() query: AdminPageDto) {
    return this.admin.failedNotifications(query.page);
  }

  @Get('users')
  users(@Query() query: ListUsersDto) {
    return this.admin.users(query.query, query.page);
  }

  @Patch('users/:id')
  @HttpCode(204)
  async setUserActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
    @Body() input: SetUserActiveDto,
  ) {
    await this.admin.setUserActive(user.id, id, input.active);
  }

  @Patch('users/:id/role')
  @HttpCode(204)
  @UseGuards(SystemManagerGuard)
  @RateLimit('change-role', 10, 3_600)
  async setUserRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
    @Body() input: SetUserRoleDto,
  ) {
    await this.auth.confirmPassword(user.id, input.password);
    await this.admin.setUserRole(user.id, id, input.role);
  }

  @Patch('site')
  @UseGuards(SystemManagerGuard)
  @RateLimit('site-settings', 10, 3_600)
  async updateSite(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateSiteSettingsDto) {
    await this.auth.confirmPassword(user.id, input.password);
    return this.site.update({ adultContentEnabled: input.adultContentEnabled });
  }
}
