"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Segment = "personal" | "fleet" | "build";
type State = "idle" | "loading" | "done" | "error";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "personal", label: "Track my own bike" },
  { value: "fleet", label: "Manage a fleet" },
  { value: "build", label: "Build one myself" },
];

/*
 * Waitlist capture. Reuses the existing /api/contact endpoint (name/email/message)
 * so signups are stored and email-notified with no new backend — swap to a
 * dedicated /api/iotibike/waitlist later if volume warrants.
 */
export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState<Segment>("personal");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/contact/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: email.split("@")[0] || "waitlist",
          email,
          message: `iotiBike waitlist signup — interested in: ${segment}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail;
        throw new Error(typeof detail === "string" ? detail : "Something went wrong — please try again.");
      }
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="flex max-w-md items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3.5 text-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>You&apos;re on the list — we&apos;ll email you the moment early access opens.</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSegment(s.value)}
            aria-pressed={segment === s.value}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              segment === s.value
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:bg-surface"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {state === "loading" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <p className="text-xs text-muted">No spam. Just early access + the build updates.</p>
    </form>
  );
}
