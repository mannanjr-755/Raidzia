export const APP_NAME = 'LedgerPro';
export const APP_TAGLINE = 'Accounting Management Software';
export const APP_DESCRIPTION = 'Professional financial management for modern businesses';

export const ROUTES = {
  login: '/login',
  forgotPassword: '/forgot-password',
  changePassword: '/change-password',
  dashboard: '/dashboard',
  accounts: '/dashboard/accounts',
  customers: '/dashboard/customers',
  vendors: '/dashboard/vendors',
  invoices: '/dashboard/invoices',
  expenses: '/dashboard/expenses',
  transactions: '/dashboard/transactions',
  reports: '/dashboard/reports',
  notifications: '/dashboard/notifications',
} as const;

export const SESSION_COOKIE = 'accounting_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
export const SESSION_REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;

export const AUTH_ERRORS = {
  invalidCredentials: 'Invalid Username or Password',
  sessionExpired: 'Your session has expired. Please sign in again.',
  unauthorized: 'You must be signed in to access this page.',
  generic: 'Something went wrong. Please try again.',
} as const;

export const AUTH_MESSAGES = {
  resetEmailSent: 'A password reset link has been sent to your email.',
  passwordChanged: 'Your password has been updated successfully.',
  loginSuccess: 'Welcome back! Redirecting to your dashboard...',
} as const;

export const NAV_ITEMS = [
  { href: ROUTES.dashboard, label: 'Dashboard', icon: 'LayoutDashboard', permission: 'dashboard:read' as const },
  { href: ROUTES.accounts, label: 'Chart of Accounts', icon: 'Wallet', permission: 'accounts:read' as const },
  { href: ROUTES.customers, label: 'Customers', icon: 'Users', permission: 'customers:read' as const },
  { href: ROUTES.vendors, label: 'Vendors', icon: 'Building2', permission: 'vendors:read' as const },
  { href: ROUTES.invoices, label: 'Invoices', icon: 'FileText', permission: 'invoices:read' as const },
  { href: ROUTES.expenses, label: 'Expenses', icon: 'Receipt', permission: 'expenses:read' as const },
  { href: ROUTES.transactions, label: 'Transactions', icon: 'ArrowLeftRight', permission: 'transactions:read' as const },
  { href: ROUTES.reports, label: 'Reports', icon: 'BarChart3', permission: 'reports:read' as const },
  { href: ROUTES.notifications, label: 'Notifications', icon: 'Bell', permission: 'notifications:read' as const },
] as const;
