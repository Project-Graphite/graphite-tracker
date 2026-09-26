import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UuidPipe } from '../validation/uuid.pipe';
import { InboxPageDto, InboxSummaryDto, MarkReadDto } from './dto/inbox.dto';
import { InboxService } from './inbox.service';

@Controller('me/inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: InboxPageDto) {
    return this.inbox.list(user.id, query.page);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Query() query: InboxSummaryDto) {
    return this.inbox.summary(user.id, query.since);
  }

  @Post('read')
  @HttpCode(204)
  async readAll(@CurrentUser() user: AuthenticatedUser) {
    await this.inbox.readAll(user.id);
  }

  @Patch(':id')
  @HttpCode(204)
  async setRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
    @Body() input: MarkReadDto,
  ) {
    await this.inbox.setRead(user.id, id, input.read);
  }
}
