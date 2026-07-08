import type { RequestHandler, Response } from 'express';
export declare function asyncHandler(handler: RequestHandler): RequestHandler;
export declare function sendPrismaError(res: Response, error: unknown, fallback?: string): Response;
export declare function validationError(res: Response, message: string): Response;
