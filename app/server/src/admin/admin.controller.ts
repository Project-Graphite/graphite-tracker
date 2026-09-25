import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import {
  ListReportsDto,
  ListReviewsDto,
  ListUsersDto,
  ResolveReportDto,
  SetReviewHiddenDto,
  SetUserActiveDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('reports')
  reports(@Query() query: ListReportsDto) {
    return this.admin.reports(query.status, query.page);
  }

  @Patch('reports/:id')
  @HttpCode(204)
  async resolveReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetReviewHiddenDto,
  ) {
    await this.admin.setReviewHidden(user.id, id, input.hidden);
  }

  @Get('users')
  users(@Query() query: ListUsersDto) {
    return this.admin.users(query.query, query.page);
  }

  @Patch('users/:id')
  @HttpCode(204)
  async setUserActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetUserActiveDto,
  ) {
    await this.admin.setUserActive(user.id, id, input.active);
  }
}
