import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DigestService } from './digest.service';
import { InboxService } from './inbox.service';
import { ReleaseMonitorService } from './release-monitor.service';

const runIntervalMs = 15 * 60 * 1000;

@Injectable()
export class NotificationsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly monitor: ReleaseMonitorService,
    private readonly digests: DigestService,
    private readonly inbox: InboxService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), runIntervalMs);
    this.timer.unref();
    void this.run();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.monitor.refreshDue();
      await this.digests.sendDue();
      await this.digests.removeOld();
      await this.inbox.removeOld();
    } catch (error) {
      this.logger.error('Notification run failed; retrying on the next run', error);
    } finally {
      this.running = false;
    }
  }
}
