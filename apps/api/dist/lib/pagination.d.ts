import type { Request } from 'express';
export declare function getPagination(req: Request, defaultLimit?: number): {
    page: number;
    limit: number;
    search: string;
    skip: number;
};
export declare function paginated<T>(items: T[], total: number, page: number, limit: number): {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};
