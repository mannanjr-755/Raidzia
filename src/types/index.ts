export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'ACCOUNTANT'
  | 'MANAGER'
  | 'AUDITOR'
  | 'VIEWER';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface SessionData {
  user: AuthUser;
  rememberMe: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResult {
  success: boolean;
  message?: string;
  error?: string;
}

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
