import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthModule } from './health/health.module';
import { ImportsModule } from './imports/imports.module';
import { LibraryModule } from './library/library.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SourcesModule } from './sources/sources.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    MailModule,
    AuthModule,
    SourcesModule,
    CatalogModule,
    LibraryModule,
    ImportsModule,
    ReviewsModule,
    UsersModule,
    NotificationsModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
