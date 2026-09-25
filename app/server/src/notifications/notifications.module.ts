import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { SourcesModule } from '../sources/sources.module';
import { DigestService } from './digest.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsScheduler } from './notifications.scheduler';
import { NotificationsService } from './notifications.service';
import { ReleaseMonitorService } from './release-monitor.service';
import { UnsubscribeTokensService } from './unsubscribe-tokens.service';

@Module({
  imports: [AuthModule, SourcesModule, JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    DigestService,
    NotificationsScheduler,
    NotificationsService,
    ReleaseMonitorService,
    UnsubscribeTokensService,
  ],
})
export class NotificationsModule {}
