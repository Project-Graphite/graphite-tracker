import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, TokenPurpose } from '@prisma/client';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const scryptAsync = promisify(scrypt);
export const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const refreshReuseGraceMs = 30 * 1000;
const tokenLifetimesMs: Record<TokenPurpose, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  CHANGE_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 60 * 60 * 1000,
};

function alreadyRegistered(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    ? new ConflictException('Email or handle is already registered')
    : error;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(input: RegisterDto) {
    const passwordHash = await this.hashPassword(input.password);
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const user = await transaction.user.create({
            data: {
              email: input.email,
              handle: input.handle,
              displayName: input.displayName,
              passwordHash,
              privacy: { create: {} },
            },
            select: { id: true, email: true, handle: true, displayName: true },
          });
          await this.sendVerification(transaction, user, TokenPurpose.VERIFY_EMAIL, user.email);
          return { user };
        },
        { timeout: 30_000 },
      );
    } catch (error) {
      throw alreadyRegistered(error);
    }
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.verifiedAt && user.isActive) {
      await this.sendVerification(this.prisma, user, TokenPurpose.VERIFY_EMAIL, user.email);
    }
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: this.digest(token) },
    });
    if (
      !record ||
      record.purpose === TokenPurpose.RESET_PASSWORD ||
      record.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Verification token is invalid or expired');
    }
    try {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: record.userId },
          data: { verifiedAt: new Date(), ...(record.email ? { email: record.email } : {}) },
        }),
        this.prisma.verificationToken.deleteMany({
          where: { userId: record.userId, purpose: record.purpose },
        }),
      ]);
    } catch (error) {
      throw alreadyRegistered(error);
    }
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

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.isActive) {
      return;
    }
    const token = await this.createToken(this.prisma, user.id, TokenPurpose.RESET_PASSWORD);
    await this.mail.send({
      to: user.email,
      subject: 'Reset your Graphite Tracker password',
      text: [
        `Hi ${user.displayName},`,
        '',
        'Someone asked to reset the password of your Graphite Tracker account. Choose a new one with this link within the next hour:',
        '',
        this.mail.link(`/reset-password?token=${token}`),
        '',
        'If that was not you, ignore this email and your password stays the same.',
      ].join('\n'),
    });
  }

  async resetPassword(token: string, password: string) {
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: this.digest(token) },
      include: { user: { select: { verifiedAt: true } } },
    });
    if (
      !record ||
      record.purpose !== TokenPurpose.RESET_PASSWORD ||
      record.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Reset link is invalid or expired');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: await this.hashPassword(password),
          verifiedAt: record.user.verifiedAt ?? now,
        },
      }),
      this.prisma.verificationToken.deleteMany({
        where: { userId: record.userId, purpose: TokenPurpose.RESET_PASSWORD },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userWithPassword(userId, currentPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await this.hashPassword(newPassword) },
      }),
      this.prisma.verificationToken.deleteMany({
        where: { userId, purpose: TokenPurpose.RESET_PASSWORD },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return this.issueSession(user);
  }

  async requestEmailChange(userId: string, email: string, password: string) {
    const user = await this.userWithPassword(userId, password);
    if (email === user.email) {
      throw new BadRequestException('This is already your email address');
    }
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('Email or handle is already registered');
    }
    await this.sendVerification(this.prisma, user, TokenPurpose.CHANGE_EMAIL, email);
  }

  async deleteAccount(userId: string, password: string) {
    await this.userWithPassword(userId, password);
    await this.prisma.user.delete({ where: { id: userId } });
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

  private async userWithPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.verifyPassword(password, user.passwordHash))) {
      throw new ForbiddenException('Current password is incorrect');
    }
    return user;
  }

  private async sendVerification(
    client: Prisma.TransactionClient,
    user: { id: string; displayName: string },
    purpose: typeof TokenPurpose.VERIFY_EMAIL | typeof TokenPurpose.CHANGE_EMAIL,
    to: string,
  ) {
    const changing = purpose === TokenPurpose.CHANGE_EMAIL;
    const token = await this.createToken(client, user.id, purpose, changing ? to : null);
    await this.mail.send({
      to,
      subject: changing
        ? 'Confirm your new Graphite Tracker email'
        : 'Verify your Graphite Tracker email',
      text: [
        `Hi ${user.displayName},`,
        '',
        changing
          ? 'Confirm this address to use it for your Graphite Tracker account:'
          : 'Confirm this address to finish creating your Graphite Tracker account:',
        '',
        this.mail.link(`/verify?token=${token}`),
        '',
        'The link works for 24 hours. If you did not ask for this, ignore this email.',
      ].join('\n'),
    });
  }

  private async createToken(
    client: Prisma.TransactionClient,
    userId: string,
    purpose: TokenPurpose,
    email: string | null = null,
  ) {
    const token = randomBytes(32).toString('hex');
    await client.verificationToken.deleteMany({ where: { userId, purpose } });
    await client.verificationToken.create({
      data: {
        userId,
        purpose,
        email,
        tokenHash: this.digest(token),
        expiresAt: new Date(Date.now() + tokenLifetimesMs[purpose]),
      },
    });
    return token;
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
