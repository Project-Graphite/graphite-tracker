import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLibraryEntryDto } from './dto/create-library-entry.dto';
import { UpdateLibraryEntryDto } from './dto/update-library-entry.dto';
import { LibraryService } from './library.service';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.library.list(user.id);
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
    @Param('id') id: string,
    @Body() input: UpdateLibraryEntryDto,
  ) {
    return this.library.update(user.id, id, input.state);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.library.remove(user.id, id);
  }
}
