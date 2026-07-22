"use client";

/*
 * SHARED AUTH CONTEXT — source of truth is frontend/src/lib/auth.tsx on the
 * main iotivate.dev site. This is a near-verbatim copy so radar.iotivate.dev
 * reuses the exact same session logic; keep the two in sync (a good candidate
 * for extraction into a shared workspace package once a second consumer beyond
 * radar exists).
 *
 * The ONLY intentional divergence: radar has no login/register UI of its own.
 * Accounts are created and passwords set on the main site; radar bootstraps its
 * session purely from the shared `.iotivate.dev` refresh cookie via
 * tryRefresh(). So the "please sign in" redirect points at the main site's
 * login (NEXT_PUBLIC_LOGIN_URL) instead of a local /login route.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const LOGIN_URL =
  process.env.NEXT_PUBLIC_LOGIN_URL || "http://iotivate.localhost:3000/login";
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
  logout: () => void;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to exchange the httpOnly refresh cookie for a new access token.
 * Returns the new access token on success, or null on failure.
 *
 * On radar this is the ENTIRE login path: the shared cross-subdomain cookie is
 * sent automatically (credentials: "include"), so a user already signed in on
 * iotivate.dev gets a session here with no second login.
 */
async function tryRefresh(): Promise<string | null> {
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
 * On 401, attempts a silent refresh once; if that fails, redirects to the main
 * site's login (radar has no login page of its own).
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
      const retryHeaders = new Headers(options.headers);
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      return fetch(url, { ...options, headers: retryHeaders });
    }

    localStorage.removeItem(TOKEN_KEY);
    window.location.href = LOGIN_URL;
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
      const exp = payload.exp * 1000;
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;
      return exp - now < tenMinutes;
    } catch {
      return true;
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
      const timeUntilRefresh = Math.max(exp - now - tenMinutes, 60_000);

      refreshTimer = setTimeout(async () => {
        const newToken = await tryRefresh();
        if (newToken) {
          setToken(newToken);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      }, timeUntilRefresh);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [token]);

  // Initial auth bootstrap on mount — the cross-subdomain SSO entry point.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const stored = localStorage.getItem(TOKEN_KEY);

      if (stored && !isTokenExpiringSoon(stored)) {
        const ok = await fetchUser(stored);
        if (cancelled) return;
        if (ok) {
          setToken(stored);
          setIsLoading(false);
          return;
        }
      }

      const newToken = await tryRefresh();
      if (cancelled) return;

      if (newToken) {
        await fetchUser(newToken);
        if (cancelled) return;
        setToken(newToken);
      } else {
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
    <AuthContext.Provider value={{ user, token, isLoading, logout }}>
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

export const LOGIN_REDIRECT_URL = LOGIN_URL;
