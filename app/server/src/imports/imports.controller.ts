import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimit } from '../redis/rate-limit.guard';
import { maxBackupBytes } from './backup-parser';
import { ApplyImportDto, DecideCandidateDto, ListCandidatesDto } from './dto/import.dto';
import { ImportsService } from './imports.service';
import { UuidPipe } from '../validation/uuid.pipe';

@Controller('imports')
@UseGuards(JwtAuthGuard)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.imports.list(user.id);
  }

  @Post()
  @RateLimit('imports', 10, 3_600)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: maxBackupBytes, files: 1 } }),
  )
  create(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Choose a backup file');
    }
    return this.imports.create(user.id, file.buffer);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id', UuidPipe) id: string) {
    return this.imports.detail(user.id, id);
  }

  @Get(':id/candidates')
  candidates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
    @Query() query: ListCandidatesDto,
  ) {
    return this.imports.candidates(user.id, id, query.match, query.page);
  }

  @Patch(':id/candidates/:candidateId')
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
    @Param('candidateId', UuidPipe) candidateId: string,
    @Body() input: DecideCandidateDto,
  ) {
    return this.imports.decide(user.id, id, candidateId, input.decision, input.choice);
  }

  @Post(':id/accept-suggestions')
  @HttpCode(200)
  acceptSuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
  ) {
    return this.imports.acceptSuggestions(user.id, id);
  }

  @Post(':id/apply')
  @HttpCode(200)
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', UuidPipe) id: string,
    @Body() input: ApplyImportDto,
  ) {
    return this.imports.apply(user.id, id, input.conflictPolicy);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', UuidPipe) id: string) {
    await this.imports.remove(user.id, id);
  }
}
