import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeController } from './me.controller';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [MeController, ProfilesController],
  providers: [ProfilesService, UsersService],
})
export class UsersModule {}
