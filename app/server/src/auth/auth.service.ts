import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const scryptAsync = promisify(scrypt);
export const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const refreshReuseGraceMs = 30 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterDto) {
    const verificationToken = randomBytes(32).toString('hex');
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          handle: input.handle,
          displayName: input.displayName,
          passwordHash: await this.hashPassword(input.password),
          privacy: { create: {} },
          verificationTokens: {
            create: {
              tokenHash: this.digest(verificationToken),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          },
        },
        select: { id: true, email: true, handle: true, displayName: true },
      });
      return {
        user,
        verificationToken:
          this.config.get('AUTH_EXPOSE_VERIFICATION_TOKEN') === 'true'
            ? verificationToken
            : undefined,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email or handle is already registered');
      }
      throw error;
    }
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: this.digest(token) },
    });
    if (!record || record.expiresAt <= new Date()) {
      throw new UnauthorizedException('Verification token is invalid or expired');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { verifiedAt: new Date() },
      }),
      this.prisma.verificationToken.deleteMany({
        where: { userId: record.userId },
      }),
    ]);
    return { verified: true };
  }

  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user || !(await this.verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    if (!user.verifiedAt) {
      throw new UnauthorizedException('Verify your email before signing in');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }
    return this.issueSession(user);
  }

  async refresh(rawToken: string) {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.digest(rawToken) },
      include: { user: true },
    });
    if (!session) {
      throw new UnauthorizedException('Refresh session is invalid');
    }
    const now = new Date();
    const rotated =
      !session.revokedAt &&
      session.expiresAt > now &&
      (
        await this.prisma.refreshSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now },
        })
      ).count === 1;
    if (!rotated) {
      if (
        session.revokedAt &&
        now.getTime() - session.revokedAt.getTime() > refreshReuseGraceMs
      ) {
        await this.prisma.refreshSession.updateMany({
          where: { userId: session.userId, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      throw new UnauthorizedException('Refresh session is invalid');
    }
    if (!session.user.isActive || !session.user.verifiedAt) {
      throw new UnauthorizedException('Refresh session is invalid');
    }
    return this.issueSession(session.user);
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) {
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash: this.digest(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async issueSession(user: {
    id: string;
    email: string;
    handle: string;
    displayName: string;
    isAdmin: boolean;
  }) {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.digest(refreshToken),
        expiresAt: new Date(Date.now() + refreshLifetimeMs),
      },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.config.getOrThrow<string>('AUTH_ACCESS_TOKEN_SECRET'),
        expiresIn: 15 * 60,
      },
    );
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        displayName: user.displayName,
        isAdmin: user.isAdmin,
      },
    };
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16);
    const key = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt.toString('hex')}:${key.toString('hex')}`;
  }

  private async verifyPassword(password: string, encoded: string) {
    const [saltHex, keyHex] = encoded.split(':');
    if (!saltHex || !keyHex) {
      return false;
    }
    const expected = Buffer.from(keyHex, 'hex');
    const actual = (await scryptAsync(
      password,
      Buffer.from(saltHex, 'hex'),
      expected.length,
    )) as Buffer;
    return timingSafeEqual(expected, actual);
  }

  private digest(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
