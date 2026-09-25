import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from '../src/auth/auth.controller';

describe('AuthController', () => {
  it('renews and ends sessions only for requests from a trusted origin', async () => {
    const auth = {
      refresh: vi.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'next', user: {} }),
      logout: vi.fn(),
    };
    const controller = new AuthController(
      auth as never,
      new ConfigService({ AUTH_TRUSTED_ORIGINS: 'https://tracker.example' }),
    );
    const request = (origin?: string) =>
      ({ headers: origin ? { origin } : {}, cookies: { graphite_refresh: 'current' } }) as never;
    const response = { cookie: vi.fn(), clearCookie: vi.fn() };

    for (const origin of [undefined, 'https://attacker.example']) {
      await expect(controller.refresh(request(origin), response as never)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(controller.logout(request(origin), response as never)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    expect(auth.refresh).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();

    await controller.refresh(request('https://tracker.example'), response as never);
    expect(auth.refresh).toHaveBeenCalledWith('current');
    expect(response.cookie).toHaveBeenCalledWith(
      'graphite_refresh',
      'next',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth', sameSite: 'strict' }),
    );
  });
});
