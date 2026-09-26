import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { SourcesModule } from '../sources/sources.module';
import { DigestService } from './digest.service';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsScheduler } from './notifications.scheduler';
import { NotificationsService } from './notifications.service';
import { ReleaseMonitorService } from './release-monitor.service';
import { UnsubscribeTokensService } from './unsubscribe-tokens.service';

@Module({
  imports: [AuthModule, CatalogModule, SourcesModule, JwtModule.register({})],
  controllers: [InboxController, NotificationsController],
  providers: [
    DigestService,
    InboxService,
    NotificationsScheduler,
    NotificationsService,
    ReleaseMonitorService,
    UnsubscribeTokensService,
  ],
})
export class NotificationsModule {}
