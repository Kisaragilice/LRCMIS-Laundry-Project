import type { RoleName } from '../config/constants';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        roles: RoleName[];
      };
    }
  }
}

export {};
