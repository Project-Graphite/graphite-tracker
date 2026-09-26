import { Controller, Get } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service';

@Controller('site')
export class SiteController {
  constructor(private readonly site: SiteSettingsService) {}

  @Get()
  settings() {
    return this.site.get();
  }
}
