import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(
    error: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (error) {
      throw error;
    }
    if (!user && context.switchToHttp().getRequest<Request>().headers.authorization) {
      throw new UnauthorizedException();
    }
    return (user || undefined) as TUser;
  }
}
