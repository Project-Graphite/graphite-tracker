import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePrivacyDto, UpdateProfileDto } from './dto/users.dto';

const sourceKey = { select: { source: { select: { key: true } } } } as const;
const titleOnly = { select: { category: true, canonicalTitle: true } } as const;

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
      timeZone: user.timeZone,
      isAdmin: user.isAdmin,
      showAdultContent: user.showAdultContent,
      blurAdultContent: user.blurAdultContent,
      privacy,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName,
        bio: input.bio,
        timeZone: input.timeZone,
        showAdultContent: input.showAdultContent,
        blurAdultContent: input.blurAdultContent,
      },
    });
    return this.me(userId);
  }

  async updatePrivacy(userId: string, input: UpdatePrivacyDto) {
    await this.prisma.profilePrivacy.update({ where: { userId }, data: input });
    return this.me(userId);
  }

  async export(userId: string) {
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        handle: true,
        displayName: true,
        bio: true,
        timeZone: true,
        verifiedAt: true,
        createdAt: true,
        privacy: { omit: { id: true, userId: true } },
        notificationPreference: { omit: { userId: true } },
        globalSourcePreference: sourceKey,
        categorySourcePreferences: { select: { category: true, ...sourceKey.select } },
        sourceSettings: { select: { enabled: true, ...sourceKey.select } },
        libraryEntries: {
          orderBy: { createdAt: 'asc' },
          omit: { id: true, userId: true, catalogItemId: true, preferredSourceId: true },
          include: {
            catalogItem: {
              select: {
                ...titleOnly.select,
                releaseDate: true,
                sourceEntries: {
                  select: { externalId: true, canonicalUrl: true, ...sourceKey.select },
                },
              },
            },
            preferredSource: { select: { key: true } },
            statusEvents: {
              orderBy: { createdAt: 'asc' },
              select: { oldState: true, newState: true, createdAt: true },
            },
            importedSources: { select: { sourceName: true, sourceUrl: true, createdAt: true } },
          },
        },
        reviews: {
          orderBy: { createdAt: 'asc' },
          omit: { id: true, userId: true, catalogItemId: true },
          include: { catalogItem: titleOnly },
        },
        reportsFiled: {
          orderBy: { createdAt: 'asc' },
          select: {
            reason: true,
            resolution: true,
            createdAt: true,
            review: { select: { catalogItem: titleOnly } },
          },
        },
        activity: {
          orderBy: { createdAt: 'asc' },
          select: { kind: true, state: true, createdAt: true, catalogItem: titleOnly },
        },
      },
    });
    return { exportedAt: new Date(), account };
  }
}
