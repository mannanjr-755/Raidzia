import type {
  LoginCredentials,
  LoginResult,
  ForgotPasswordRequest,
  ForgotPasswordResult,
  ChangePasswordRequest,
  ChangePasswordResult,
  ApiResponse,
  AuthUser,
} from '@/types/auth';
import { AUTH_ERRORS, AUTH_MESSAGES } from '@/lib/constants/auth';

class AuthService {
  private baseUrl = '/api/auth';

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
      });

      const data = (await response.json()) as ApiResponse<T>;

      if (!response.ok) {
        return {
          success: false,
          error: data.error || AUTH_ERRORS.generic,
        };
      }

      return data;
    } catch {
      return { success: false, error: AUTH_ERRORS.generic };
    }
  }

  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const result = await this.request<{ user: AuthUser }>('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, user: result.data?.user };
  }

  async logout(): Promise<ApiResponse> {
    return this.request('/logout', { method: 'POST' });
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<ForgotPasswordResult> {
    const result = await this.request('/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!result.success) {
      return { success: false, message: '', error: result.error };
    }

    return {
      success: true,
      message: result.message || AUTH_MESSAGES.resetEmailSent,
    };
  }

  async changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResult> {
    const result = await this.request('/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      message: result.message || AUTH_MESSAGES.passwordChanged,
    };
  }

  async getSession(): Promise<AuthUser | null> {
    const result = await this.request<{ user: AuthUser }>('/session');
    return result.success ? (result.data?.user ?? null) : null;
  }
}

export const authService = new AuthService();
