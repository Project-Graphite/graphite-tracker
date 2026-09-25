import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MediaCategory } from '@prisma/client';
import { createHmac } from 'node:crypto';

export type UnsubscribeScope =
  | { scope: 'all' }
  | { scope: 'category'; category: MediaCategory }
  | { scope: 'title'; entryId: string };

@Injectable()
export class UnsubscribeTokensService {
  private readonly secret: string;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.secret = createHmac('sha256', config.getOrThrow<string>('AUTH_ACCESS_TOKEN_SECRET'))
      .update('notification-unsubscribe')
      .digest('base64url');
  }

  sign(userId: string, scope: UnsubscribeScope) {
    return this.jwt.sign({ sub: userId, ...scope }, { secret: this.secret, expiresIn: '180d' });
  }

  verify(token: string) {
    try {
      return this.jwt.verify<UnsubscribeScope & { sub: string }>(token, { secret: this.secret });
    } catch {
      throw new BadRequestException('This unsubscribe link is invalid or has expired');
    }
  }
}
