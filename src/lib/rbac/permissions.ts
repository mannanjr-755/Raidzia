import type { UserRole } from '@prisma/client';

export type Permission =
  | 'accounts:read'
  | 'accounts:write'
  | 'accounts:delete'
  | 'customers:read'
  | 'customers:write'
  | 'customers:delete'
  | 'vendors:read'
  | 'vendors:write'
  | 'vendors:delete'
  | 'invoices:read'
  | 'invoices:write'
  | 'invoices:delete'
  | 'expenses:read'
  | 'expenses:write'
  | 'expenses:delete'
  | 'transactions:read'
  | 'transactions:write'
  | 'transactions:delete'
  | 'reports:read'
  | 'reports:export'
  | 'notifications:read'
  | 'users:read'
  | 'users:write'
  | 'dashboard:read';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'accounts:read', 'accounts:write', 'accounts:delete',
    'customers:read', 'customers:write', 'customers:delete',
    'vendors:read', 'vendors:write', 'vendors:delete',
    'invoices:read', 'invoices:write', 'invoices:delete',
    'expenses:read', 'expenses:write', 'expenses:delete',
    'transactions:read', 'transactions:write', 'transactions:delete',
    'reports:read', 'reports:export',
    'notifications:read', 'users:read', 'users:write',
    'dashboard:read',
  ],
  ADMIN: [
    'accounts:read', 'accounts:write', 'accounts:delete',
    'customers:read', 'customers:write', 'customers:delete',
    'vendors:read', 'vendors:write', 'vendors:delete',
    'invoices:read', 'invoices:write', 'invoices:delete',
    'expenses:read', 'expenses:write', 'expenses:delete',
    'transactions:read', 'transactions:write', 'transactions:delete',
    'reports:read', 'reports:export',
    'notifications:read', 'users:read',
    'dashboard:read',
  ],
  ACCOUNTANT: [
    'accounts:read', 'accounts:write',
    'customers:read', 'customers:write',
    'vendors:read', 'vendors:write',
    'invoices:read', 'invoices:write',
    'expenses:read', 'expenses:write',
    'transactions:read', 'transactions:write',
    'reports:read', 'reports:export',
    'notifications:read',
    'dashboard:read',
  ],
  MANAGER: [
    'accounts:read', 'customers:read', 'vendors:read',
    'invoices:read', 'invoices:write',
    'expenses:read', 'expenses:write',
    'transactions:read',
    'reports:read', 'reports:export',
    'notifications:read',
    'dashboard:read',
  ],
  AUDITOR: [
    'accounts:read', 'customers:read', 'vendors:read',
    'invoices:read', 'expenses:read', 'transactions:read',
    'reports:read', 'reports:export',
    'notifications:read',
    'dashboard:read',
  ],
  VIEWER: [
    'accounts:read', 'customers:read', 'vendors:read',
    'invoices:read', 'expenses:read', 'transactions:read',
    'reports:read', 'notifications:read',
    'dashboard:read',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error('Forbidden: insufficient permissions');
  }
}
