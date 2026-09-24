import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePrivacyDto, UpdateProfileDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const [user, privacy] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.profilePrivacy.findUniqueOrThrow({
        where: { userId },
        omit: { id: true, userId: true },
      }),
    ]);
    return {
      id: user.id,
      email: user.email,
      handle: user.handle,
      displayName: user.displayName,
      bio: user.bio,
      isAdmin: user.isAdmin,
      privacy,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: input.displayName, bio: input.bio },
    });
    return this.me(userId);
  }

  async updatePrivacy(userId: string, input: UpdatePrivacyDto) {
    await this.prisma.profilePrivacy.update({ where: { userId }, data: input });
    return this.me(userId);
  }
}
