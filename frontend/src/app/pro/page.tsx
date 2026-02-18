"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, usePro } from "@/lib/auth";
import { authFetch } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PRO_FEATURES = [
  "Export logs (.txt, .csv, .json)",
  "Filter & search with regex",
  "Real-time plotter (multi-channel)",
  "Split view (console + plotter)",
  "Command macros",
  "Hex send mode",
  "More features coming soon",
];

export default function ProPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { isPro } = usePro();
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const success = searchParams?.get("success") === "true";

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-muted">
        Loading...
      </div>
    );
  }

  // Success state after subscription
  if (success && user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome to iotivate Pro!</h1>
        <p className="text-muted mb-8">
          Your subscription is active. Pro features are now unlocked in the Serial Monitor.
        </p>
        <Link
          href="/tools/serial-monitor"
          className="inline-block px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          Open Serial Monitor
        </Link>
      </div>
    );
  }

  // Manage subscription (pro users)
  if (isPro && user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold mb-2">iotivate Pro</h1>
        <p className="text-muted mb-8">You have an active Pro subscription.</p>

        <div className="border border-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Your Pro Features</h2>
          <ul className="space-y-2">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted">
                <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={handlePortal}
          disabled={portalLoading}
          className="px-6 py-3 border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
        >
          {portalLoading ? "Loading..." : "Manage Subscription"}
        </button>
      </div>
    );
  }

  // Pricing page (non-pro / logged out)
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-2">iotivate Pro</h1>
        <p className="text-muted max-w-xl mx-auto">
          Unlock the full power of the Serial Monitor. Export logs, filter data, plot values in real time, and more.
        </p>
      </div>

      {/* Plan toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-lg border border-border p-1">
          <button
            onClick={() => setPlan("monthly")}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              plan === "monthly"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPlan("yearly")}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              plan === "yearly"
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      {/* Pricing card */}
      <div className="max-w-md mx-auto border border-border rounded-lg p-8">
        <div className="text-center mb-6">
          <div className="text-4xl font-bold">
            ${plan === "monthly" ? "7" : "70"}
            <span className="text-lg font-normal text-muted">
              /{plan === "monthly" ? "mo" : "yr"}
            </span>
          </div>
          {plan === "yearly" && (
            <p className="text-sm text-accent mt-1">Save $14/year (2 months free)</p>
          )}
        </div>

        <ul className="space-y-3 mb-8">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>

        {error && (
          <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
        )}

        {user ? (
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Subscribe to Pro"}
          </button>
        ) : (
          <Link
            href="/login"
            className="block w-full py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors text-center"
          >
            Log in to subscribe
          </Link>
        )}
      </div>

      {/* Free tier reminder */}
      <div className="mt-12 text-center">
        <p className="text-sm text-muted">
          Not ready to upgrade?{" "}
          <Link href="/tools/serial-monitor" className="text-accent hover:underline">
            The free Serial Monitor
          </Link>{" "}
          includes connect, console, baud rate selection, timestamps, command history, and more.
        </p>
      </div>
    </div>
  );

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Failed to create checkout");
        return;
      }
      const data = await res.json();

      // Use overlay checkout if available, otherwise redirect
      if (window.LemonSqueezy) {
        window.LemonSqueezy.Url.Open(data.url);
      } else {
        window.location.href = data.url;
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/subscription/portal`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Failed to load portal");
        return;
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }
}
