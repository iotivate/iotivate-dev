"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

/** Auth-aware call-to-action for the (server-rendered) radar landing page. */
export default function RadarCta() {
  const { token } = useAuth();
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href="/radar/devices"
        className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        {token ? "Go to your devices" : "Get started free"}
      </Link>
      {!token && (
        <Link
          href="/login"
          className="rounded-lg border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-surface"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
