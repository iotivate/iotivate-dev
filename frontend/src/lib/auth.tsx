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
  isRemembered: boolean;
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
      console.log('Attempting token refresh...');
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const newToken = data.access_token;
        localStorage.setItem(TOKEN_KEY, newToken);
        console.log('Token refresh successful');
        return newToken;
      } else {
        console.log('Token refresh failed:', res.status, res.statusText);
        // If refresh fails with 401, the refresh token is expired
        if (res.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
        }
      }
    } catch (error) {
      console.log('Token refresh error:', error);
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
  const [isRemembered, setIsRemembered] = useState(false);

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

  // Check if token is close to expiry (within 10 minutes)
  const isTokenExpiringSoon = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000; // Increased buffer time
      return exp - now < tenMinutes;
    } catch {
      return true; // If we can't parse, assume it's expired
    }
  }, []);

  // Proactive token refresh
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;

    const scheduleRefresh = (token: string) => {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000;
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000; // Refresh 10 minutes before expiry
        const timeUntilRefresh = Math.max(exp - now - tenMinutes, 60000); // At least 60 seconds

        refreshTimer = setTimeout(async () => {
          const newToken = await tryRefresh();
          if (newToken) {
            setToken(newToken);
            scheduleRefresh(newToken); // Schedule next refresh
          } else {
            // Refresh failed, user will be logged out on next API call
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
            setUser(null);
          }
        }, timeUntilRefresh);
      } catch {
        // Token is malformed, clear it
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    };

    if (token) {
      scheduleRefresh(token);
    }

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [token]);

  useEffect(() => {
    async function init() {
      const stored = localStorage.getItem(TOKEN_KEY);

      if (stored) {
        // Check if token is expired or expiring soon
        if (isTokenExpiringSoon(stored)) {
          // Try to refresh immediately
          const newToken = await tryRefresh();
          if (newToken) {
            setToken(newToken);
            await fetchUser(newToken);
            // We have a valid refresh token, so we were remembered
            setIsRemembered(true);
          } else {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
            setIsRemembered(false);
          }
        } else {
          // Token is still valid
          setToken(stored);
          const ok = await fetchUser(stored);
          if (!ok) {
            // Access token expired — try refresh
            const newToken = await tryRefresh();
            if (newToken) {
              setToken(newToken);
              await fetchUser(newToken);
              setIsRemembered(true);
            } else {
              localStorage.removeItem(TOKEN_KEY);
              setToken(null);
              setIsRemembered(false);
            }
          } else {
            // Token is valid, check if we have a refresh cookie by trying refresh
            const refreshWorks = await tryRefresh();
            if (refreshWorks) {
              setToken(refreshWorks);
              setIsRemembered(true);
            } else {
              // No refresh token, user will need to re-login when token expires
              setIsRemembered(false);
            }
          }
        }
      } else {
        // No stored token, check if we have a valid refresh cookie
        const newToken = await tryRefresh();
        if (newToken) {
          setToken(newToken);
          await fetchUser(newToken);
          setIsRemembered(true);
        }
      }
      setIsLoading(false);
    }
    init();
  }, [fetchUser, isTokenExpiringSoon]);

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
      setIsRemembered(rememberMe || false);
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
    setIsRemembered(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isRemembered, login, register, logout }}>
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
