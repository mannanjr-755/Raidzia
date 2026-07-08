import type { RequestHandler, Response } from 'express';
export declare function asyncHandler(handler: RequestHandler): RequestHandler;
export declare function sendPrismaError(res: Response, error: unknown, fallback?: string): Response;
export declare function validationError(res: Response, message: string): Response;
export declare function normalizeCode(value: string): string;
export declare function ensureUniqueCode(res: Response, findExisting: () => Promise<{
    id: string;
    deletedAt?: Date | null;
} | null>, currentId?: string): Promise<boolean>;
export declare function generateProjectCode(): Promise<string>;
export declare function generateLandId(): Promise<string>;
export declare function generateInventorySku(): Promise<string>;
export declare function generateEmployeeCode(): Promise<string>;
export declare function releaseCodeValue(value: string): string;
