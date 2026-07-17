const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

const ACCESS_TOKEN_KEY = 'rss_access_token';
const REFRESH_TOKEN_KEY = 'rss_refresh_token';
const TOKEN_COOKIE = 'rss_token';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string | null;
  twoFactorEnabled?: boolean;
}

export interface AuthData {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function setTokenCookie(token: string) {
  if (typeof document !== 'undefined') {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${TOKEN_COOKIE}=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax${secure}`;
  }
}

function clearTokenCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0`;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  setTokenCookie(accessToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearTokenCookie();
}

let refreshPromise: Promise<string | null> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readJsonBody<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    const fallback = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new ApiError(fallback || `Invalid response from API (${res.status})`, res.status);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    clearTokens();
    return null;
  }

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const json = await readJsonBody<ApiResponse<{ accessToken: string }>>(res);
  if (json?.success && json.data?.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, json.data.accessToken);
    setTokenCookie(json.data.accessToken);
    return json.data.accessToken;
  }

  clearTokens();
  return null;
}

async function getValidToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token) return token;

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
  attachAuth = true
): Promise<T> {
  const token = attachAuth ? await getValidToken() : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    const hint =
      API_URL.startsWith('http')
        ? `Cannot reach API at ${API_URL}. Check NEXT_PUBLIC_API_URL and CORS_ORIGINS.`
        : `Cannot reach API at ${API_URL}. For Netlify/Vercel set NEXT_PUBLIC_API_URL to your public API (https://…). Locally run "npm run dev".`;
    throw new ApiError(hint, 0);
  }

  if (res.status === 401 && retry && attachAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, false, attachAuth);
    }
    clearTokens();
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError('Unauthorized', 401);
  }

  const json = await readJsonBody<ApiResponse<T>>(res);
  if (!json) {
    throw new ApiError(`Empty response from API (${res.status})`, res.status);
  }

  if (!res.ok || !json.success) {
    throw new ApiError(json.message || json.error || 'Request failed', res.status);
  }

  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  login: (email: string, password: string) =>
    request<AuthData>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      true,
      false
    ),

  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    request<{ requireReauth: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    }),

  logout: async () => {
    const refreshToken = getRefreshToken();
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignore logout errors
    }
    clearTokens();
  },

  me: () => request<User>('/auth/me'),
};

export default api;
