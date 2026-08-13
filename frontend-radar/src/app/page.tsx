"use client";

import { useAuth, LOGIN_REDIRECT_URL } from "@/lib/auth";

/*
 * Phase 1 scaffold landing page. Its job is to make cross-subdomain SSO
 * visible and testable end-to-end: the auth context bootstraps a session from
 * the shared refresh cookie on mount, and this page reports the result. The
 * real radar dashboard replaces this from Phase 4 on.
 */
export default function Home() {
  const { user, isLoading, logout } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-medium tracking-widest text-[color:var(--color-accent)] uppercase">
          IoTivate Radar
        </span>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Live mmWave presence sensing
        </h1>
        <p className="text-[color:var(--color-muted)]">
          Radar is a separate product on its own subdomain that shares one
          IoTivate account. This scaffold verifies that shared sign-in.
        </p>
      </header>

      <section
        aria-live="polite"
        className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
      >
        {isLoading ? (
          <p className="text-[color:var(--color-muted)]">
            Checking your IoTivate session…
          </p>
        ) : user ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <p className="font-medium">
                Signed in as{" "}
                <span className="font-semibold">{user.username}</span>
                {user.is_pro && (
                  <span className="ml-2 rounded-full bg-[color:var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-white">
                    Pro
                  </span>
                )}
              </p>
            </div>
            <p className="text-sm text-[color:var(--color-muted)]">
              Single sign-on works — this session came from the shared{" "}
              <code className="font-mono">.iotivate.dev</code> refresh cookie,
              with no separate login on this subdomain.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/devices"
                className="rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--color-accent-hover)]"
              >
                Manage devices
              </a>
              <button
                onClick={logout}
                className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--color-background)]"
              >
                Log out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--color-muted)]" />
              <p className="font-medium">Not signed in</p>
            </div>
            <p className="text-sm text-[color:var(--color-muted)]">
              Accounts are managed on the main IoTivate site. Sign in there once
              and this page will pick up the session automatically.
            </p>
            <a
              href={LOGIN_REDIRECT_URL}
              className="self-start rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--color-accent-hover)]"
            >
              Sign in on iotivate.dev
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
