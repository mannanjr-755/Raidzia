export declare enum UserRole {
    SUPER_ADMIN = "SUPER_ADMIN",
    OWNER = "OWNER",
    DIRECTOR = "DIRECTOR",
    PROJECT_MANAGER = "PROJECT_MANAGER",
    SITE_ENGINEER = "SITE_ENGINEER",
    ARCHITECT = "ARCHITECT",
    QUANTITY_SURVEYOR = "QUANTITY_SURVEYOR",
    ACCOUNTS = "ACCOUNTS",
    HR = "HR",
    SALES = "SALES",
    INVENTORY_MANAGER = "INVENTORY_MANAGER",
    STORE_MANAGER = "STORE_MANAGER",
    RECEPTION = "RECEPTION",
    CUSTOMER = "CUSTOMER"
}
export type Permission = 'dashboard:read' | 'projects:read' | 'projects:write' | 'projects:delete' | 'land:read' | 'land:write' | 'land:delete' | 'land:feasibility' | 'properties:read' | 'properties:write' | 'properties:delete' | 'crm:read' | 'crm:write' | 'crm:delete' | 'sales:read' | 'sales:write' | 'sales:delete' | 'accounting:read' | 'accounting:write' | 'accounting:delete' | 'expenses:read' | 'expenses:write' | 'expenses:delete' | 'procurement:read' | 'procurement:write' | 'inventory:read' | 'inventory:write' | 'hr:read' | 'hr:write' | 'machinery:read' | 'machinery:write' | 'inspection:read' | 'inspection:write' | 'reports:read' | 'reports:export' | 'notifications:read' | 'digital-twin:read' | 'users:read' | 'users:write' | 'settings:read' | 'settings:write';
export declare const ROLE_PERMISSIONS: Record<UserRole, Permission[]>;
export declare function hasPermission(role: UserRole, permission: Permission): boolean;
export declare const APP_NAME = "RSS ERP";
export declare const APP_TAGLINE = "Rehan Shahid & Sons Builders & Developers";
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
