import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLibraryEntryDto } from './dto/create-library-entry.dto';
import { ListLibraryDto } from './dto/list-library.dto';
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto';
import { LibraryService } from './library.service';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLibraryDto,
  ) {
    return this.library.list(user.id, query);
  }

  @Get('source/:source/:externalId')
  findBySourceId(
    @CurrentUser() user: AuthenticatedUser,
    @Param('source') source: string,
    @Param('externalId') externalId: string,
  ) {
    return this.library.findBySourceId(user.id, source, externalId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateLibraryEntryDto,
  ) {
    return this.library.create(user.id, input);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateLibraryEntryDto,
  ) {
    return this.library.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.library.remove(user.id, id);
  }
}
