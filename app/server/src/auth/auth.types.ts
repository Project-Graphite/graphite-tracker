import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  isAdmin: boolean;
  showAdultContent: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
