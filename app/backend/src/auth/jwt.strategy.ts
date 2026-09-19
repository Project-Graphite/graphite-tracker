import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

interface AccessTokenPayload {
  sub: string;
  email: string;
  handle: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('AUTH_ACCESS_TOKEN_SECRET'),
    });
  }

  async validate(payload: AccessTokenPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, handle: true, isActive: true },
    });
    if (!user?.isActive) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, handle: user.handle };
  }
}
