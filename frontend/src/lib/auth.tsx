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

/**
 * Attempt to exchange the httpOnly refresh cookie for a new access token.
 * Returns the new access token on success, or null on failure.
 *
 * Does NOT mutate localStorage — callers decide what to do on failure, since
 * the meaning of "no refresh available" depends on context (init vs. retry
 * after a 401 vs. proactive scheduled refresh).
 */
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
      // Network error — treat as no refresh available
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

    // Refresh failed — clear state and redirect to the actual login page
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
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

  // Check if token is close to expiry (within 10 minutes)
  const isTokenExpiringSoon = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      return exp - now < tenMinutes;
    } catch {
      return true; // If we can't parse, assume it's expired
    }
  }, []);

  // Proactive token refresh — runs whenever the access token changes
  useEffect(() => {
    if (!token) return;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const exp = payload.exp * 1000;
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      // Refresh 10 minutes before expiry, but never sooner than 60 seconds from now
      const timeUntilRefresh = Math.max(exp - now - tenMinutes, 60_000);

      refreshTimer = setTimeout(async () => {
        const newToken = await tryRefresh();
        if (newToken) {
          setToken(newToken);
        } else {
          // Refresh genuinely failed — fully log out
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      }, timeUntilRefresh);
    } catch {
      // Malformed token — clear state
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [token]);

  // Initial auth bootstrap on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const stored = localStorage.getItem(TOKEN_KEY);

      // Case 1: We have a stored access token that is still comfortably valid.
      if (stored && !isTokenExpiringSoon(stored)) {
        const ok = await fetchUser(stored);
        if (cancelled) return;
        if (ok) {
          setToken(stored);
          setIsLoading(false);
          return;
        }
        // Server rejected it — fall through to refresh attempt below.
      }

      // Case 2: No usable access token. Try to mint a new one from the
      // refresh cookie (this is the "remember me" path).
      const newToken = await tryRefresh();
      if (cancelled) return;

      if (newToken) {
        await fetchUser(newToken);
        if (cancelled) return;
        setToken(newToken);
      } else {
        // No refresh available — make sure local state is clean.
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
      setIsLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
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
