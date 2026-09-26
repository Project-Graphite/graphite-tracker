import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLibraryEntryDto } from './dto/create-library-entry.dto';
import { ListLibraryDto, LookupLibraryDto } from './dto/list-library.dto';
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto';
import { LibraryService } from './library.service';
import { UuidPipe } from '../validation/uuid.pipe';

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

  @Get('lookup')
  lookup(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LookupLibraryDto,
  ) {
    return this.library.lookup(user.id, query.refs);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateLibraryEntryDto,
  ) {
    return this.library.create(user.id, input, user.showAdultContent);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
    @Body() input: UpdateLibraryEntryDto,
  ) {
    return this.library.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
  ) {
    await this.library.remove(user.id, id);
  }

  @Delete(':id/imported-sources/:referenceId')
  @HttpCode(204)
  async removeImportedSource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
    @Param('referenceId', UuidPipe) referenceId: string,
  ) {
    await this.library.removeImportedSource(user.id, id, referenceId);
  }
}
