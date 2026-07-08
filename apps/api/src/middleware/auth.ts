import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type JwtPayload } from '../lib/auth';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized', error: 'Unauthorized' });
    return;
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token', error: 'Invalid or expired token' });
  }
}

export function authorize(...permissions: import('@rss/shared').Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized', error: 'Unauthorized' });
      return;
    }
    const { hasPermission } = require('@rss/shared');
    const allowed = permissions.some((p) => hasPermission(req.user!.role, p));
    if (!allowed) {
      res.status(403).json({ success: false, message: 'Forbidden', error: 'Forbidden' });
      return;
    }
    next();
  };
}
