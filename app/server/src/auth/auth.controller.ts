import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { RateLimit } from '../redis/rate-limit.guard';
import { AuthService, refreshLifetimeMs } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const refreshCookie = 'graphite_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @RateLimit('register', 5, 3_600)
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }

  @Post('verify-email')
  @RateLimit('verify-email', 20, 3_600)
  verifyEmail(@Body() input: VerifyEmailDto) {
    return this.auth.verifyEmail(input.token);
  }

  @Post('login')
  @RateLimit('login', 10, 900)
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.login(input);
    this.setRefreshCookie(response, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Post('refresh')
  @RateLimit('refresh', 60, 900)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const token = request.cookies[refreshCookie] as string | undefined;
    if (!token) {
      throw new UnauthorizedException();
    }
    const session = await this.auth.refresh(token);
    this.setRefreshCookie(response, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    await this.auth.logout(request.cookies[refreshCookie] as string | undefined);
    response.clearCookie(refreshCookie, { path: '/api/v1/auth' });
    return { loggedOut: true };
  }

  private setRefreshCookie(response: Response, token: string) {
    response.cookie(refreshCookie, token, {
      httpOnly: true,
      maxAge: refreshLifetimeMs,
      path: '/api/v1/auth',
      sameSite: 'strict',
      secure: this.config.get('NODE_ENV') === 'production',
    });
  }

  private assertTrustedOrigin(request: Request) {
    const trusted = new Set(
      this.config.get<string>('AUTH_TRUSTED_ORIGINS')?.split(',') ?? [],
    );
    if (!request.headers.origin || !trusted.has(request.headers.origin)) {
      throw new UnauthorizedException('Request origin is not trusted');
    }
  }
}
