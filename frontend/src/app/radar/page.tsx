"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

/*
 * Radar product section, living at iotivate.dev/radar (a route in the main app,
 * so it shares the site session, nav, and footer — no separate subdomain or SSO
 * plumbing). This landing is public; /radar/devices requires sign-in.
 */
export default function RadarHome() {
  const { token } = useAuth();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-medium uppercase tracking-widest text-accent">
          IoTivate Radar
        </span>
        <h1 className="text-3xl font-semibold sm:text-4xl">Live mmWave presence sensing</h1>
        <p className="text-muted">
          Turn an mmWave radar module and an ESP32 into a live presence-sensing dashboard with
          zones, rules, and alerts — all under your existing IoTivate account.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/radar/devices"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          {token ? "Manage devices" : "Get started"}
        </Link>
        {!token && (
          <Link
            href="/login"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
