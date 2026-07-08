import type { Request, Response, NextFunction } from 'express';
import { type JwtPayload } from '../lib/auth';
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
export declare function authorize(...permissions: import('@rss/shared').Permission[]): (req: Request, res: Response, next: NextFunction) => void;
