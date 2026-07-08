export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OWNER = 'OWNER',
  DIRECTOR = 'DIRECTOR',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  SITE_ENGINEER = 'SITE_ENGINEER',
  ARCHITECT = 'ARCHITECT',
  QUANTITY_SURVEYOR = 'QUANTITY_SURVEYOR',
  ACCOUNTS = 'ACCOUNTS',
  HR = 'HR',
  SALES = 'SALES',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  STORE_MANAGER = 'STORE_MANAGER',
  RECEPTION = 'RECEPTION',
  CUSTOMER = 'CUSTOMER',
}

export type Permission =
  | 'dashboard:read'
  | 'projects:read' | 'projects:write' | 'projects:delete'
  | 'land:read' | 'land:write' | 'land:delete' | 'land:feasibility'
  | 'properties:read' | 'properties:write' | 'properties:delete'
  | 'crm:read' | 'crm:write' | 'crm:delete'
  | 'sales:read' | 'sales:write' | 'sales:delete'
  | 'accounting:read' | 'accounting:write' | 'accounting:delete'
  | 'expenses:read' | 'expenses:write' | 'expenses:delete'
  | 'procurement:read' | 'procurement:write'
  | 'inventory:read' | 'inventory:write'
  | 'hr:read' | 'hr:write'
  | 'machinery:read' | 'machinery:write'
  | 'inspection:read' | 'inspection:write'
  | 'reports:read' | 'reports:export'
  | 'notifications:read'
  | 'digital-twin:read'
  | 'users:read' | 'users:write'
  | 'settings:read' | 'settings:write';

const ALL: Permission[] = [
  'dashboard:read', 'projects:read', 'projects:write', 'projects:delete',
  'land:read', 'land:write', 'land:delete', 'land:feasibility',
  'properties:read', 'properties:write', 'properties:delete',
  'crm:read', 'crm:write', 'crm:delete',
  'sales:read', 'sales:write', 'sales:delete',
  'accounting:read', 'accounting:write', 'accounting:delete',
  'expenses:read', 'expenses:write', 'expenses:delete',
  'procurement:read', 'procurement:write',
  'inventory:read', 'inventory:write',
  'hr:read', 'hr:write', 'machinery:read', 'machinery:write',
  'inspection:read', 'inspection:write',
  'reports:read', 'reports:export', 'notifications:read',
  'digital-twin:read', 'users:read', 'users:write', 'settings:read', 'settings:write',
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: ALL,
  [UserRole.OWNER]: ALL,
  [UserRole.DIRECTOR]: ALL.filter((p) => !p.startsWith('users:')),
  [UserRole.PROJECT_MANAGER]: [
    'dashboard:read', 'projects:read', 'projects:write',
    'land:read', 'land:feasibility', 'properties:read',
    'expenses:read', 'expenses:write', 'inspection:read', 'inspection:write',
    'machinery:read', 'reports:read', 'notifications:read', 'digital-twin:read',
  ],
  [UserRole.SITE_ENGINEER]: [
    'dashboard:read', 'projects:read', 'inspection:read', 'inspection:write',
    'machinery:read', 'inventory:read', 'notifications:read', 'digital-twin:read',
  ],
  [UserRole.ARCHITECT]: [
    'dashboard:read', 'projects:read', 'land:read', 'properties:read', 'properties:write',
    'digital-twin:read', 'reports:read', 'notifications:read',
  ],
  [UserRole.QUANTITY_SURVEYOR]: [
    'dashboard:read', 'projects:read', 'land:read', 'land:feasibility',
    'procurement:read', 'inventory:read', 'reports:read', 'notifications:read',
  ],
  [UserRole.ACCOUNTS]: [
    'dashboard:read', 'accounting:read', 'accounting:write',
    'expenses:read', 'expenses:write', 'sales:read', 'procurement:read',
    'reports:read', 'reports:export', 'notifications:read',
  ],
  [UserRole.HR]: [
    'dashboard:read', 'hr:read', 'hr:write', 'reports:read', 'notifications:read',
  ],
  [UserRole.SALES]: [
    'dashboard:read', 'crm:read', 'crm:write', 'sales:read', 'sales:write',
    'properties:read', 'reports:read', 'notifications:read', 'digital-twin:read',
  ],
  [UserRole.INVENTORY_MANAGER]: [
    'dashboard:read', 'inventory:read', 'inventory:write',
    'procurement:read', 'procurement:write', 'reports:read', 'notifications:read',
  ],
  [UserRole.STORE_MANAGER]: [
    'dashboard:read', 'inventory:read', 'inventory:write', 'procurement:read', 'notifications:read',
  ],
  [UserRole.RECEPTION]: [
    'dashboard:read', 'crm:read', 'crm:write', 'properties:read', 'notifications:read',
  ],
  [UserRole.CUSTOMER]: [
    'dashboard:read', 'properties:read', 'sales:read', 'notifications:read', 'digital-twin:read',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export const APP_NAME = 'RSS ERP';
export const APP_TAGLINE = 'Rehan Shahid & Sons Builders & Developers';

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
