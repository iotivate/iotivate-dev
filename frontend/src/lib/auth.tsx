"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "iotivate_token";

interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_pro: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const newToken = data.access_token;
        localStorage.setItem(TOKEN_KEY, newToken);
        return newToken;
      }
    } catch {
      // refresh failed
    }
    return null;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Authenticated fetch wrapper with automatic token refresh.
 * On 401, attempts a silent refresh once; if that fails, redirects to login.
 * Use this for all admin API calls.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    const newToken = await tryRefresh();
    if (newToken) {
      // Retry the original request with the new token
      const retryHeaders = new Headers(options.headers);
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      return fetch(url, { ...options, headers: retryHeaders });
    }

    // Refresh failed — clear state and redirect
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/admin/login";
  }

  return res;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, []);

  useEffect(() => {
    async function init() {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        setToken(stored);
        const ok = await fetchUser(stored);
        if (!ok) {
          // Access token expired — try refresh
          const newToken = await tryRefresh();
          if (newToken) {
            setToken(newToken);
            await fetchUser(newToken);
          } else {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
          }
        }
      }
      setIsLoading(false);
    }
    init();
  }, [fetchUser]);

  const login = async (username: string, password: string, rememberMe?: boolean) => {
    try {
      const loginUrl = rememberMe
        ? `${API_URL}/api/auth/login?remember_me=true`
        : `${API_URL}/api/auth/login`;
      const res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.detail || "Login failed" };
      }
      const data = await res.json();
      const accessToken = data.access_token;
      localStorage.setItem(TOKEN_KEY, accessToken);
      setToken(accessToken);
      await fetchUser(accessToken);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  };

  const register = async (email: string, username: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.detail || "Registration failed" };
      }
      // Auto-login after registration
      return login(username, password);
    } catch {
      return { ok: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best-effort cookie clear
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function usePro() {
  const { user, isLoading } = useAuth();
  return {
    isPro: user?.is_pro ?? false,
    isLoading,
    isLoggedIn: !!user,
  };
}
