import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  SourcePreferenceDto,
  SourceSettingDto,
} from './dto/source-setting.dto';
import { SourceSettingsService } from './source-settings.service';
import { CatalogCategory } from './source.types';

@Controller('sources')
@UseGuards(JwtAuthGuard)
export class SourceSettingsController {
  constructor(private readonly settings: SourceSettingsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.list(user.id);
  }

  @Patch(':key')
  setEnabled(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() input: SourceSettingDto,
  ) {
    return this.settings.setEnabled(user.id, key, input.enabled);
  }

  @Put('preferences/global')
  setGlobal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: SourcePreferenceDto,
  ) {
    return this.settings.setGlobal(user.id, input.source);
  }

  @Delete('preferences/global')
  clearGlobal(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.clearGlobal(user.id);
  }

  @Put('preferences/category/:category')
  setCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('category') category: CatalogCategory,
    @Body() input: SourcePreferenceDto,
  ) {
    return this.settings.setCategory(user.id, category, input.source);
  }

  @Delete('preferences/category/:category')
  clearCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('category') category: CatalogCategory,
  ) {
    return this.settings.clearCategory(user.id, category);
  }
}
