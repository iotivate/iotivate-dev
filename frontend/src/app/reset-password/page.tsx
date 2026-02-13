"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Invalid reset link</h1>
        <p className="text-muted mb-8">
          This password reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password" className="text-accent hover:underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 429) {
          setError("Too many requests. Please try again later.");
        } else if (res.status === 422 && data?.detail) {
          // Extract validation error messages from Pydantic
          const messages = Array.isArray(data.detail)
            ? data.detail.map((d: { msg?: string }) => d.msg || "").join(". ")
            : data.detail;
          setError(messages);
        } else {
          setError(data?.detail || "Invalid or expired reset link.");
        }
        setIsLoading(false);
        return;
      }

      router.push("/login?reset=success");
    } catch {
      setError("Unable to reach the server. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-4 text-center">Set new password</h1>
      <p className="text-muted text-center mb-8">
        Enter your new password below.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            New password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
            Confirm new password
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {isLoading ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <p className="text-muted">Loading...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
