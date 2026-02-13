"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok && res.status === 429) {
        setError("Too many requests. Please try again later.");
        setIsLoading(false);
        return;
      }

      // Always show success to avoid leaking user existence
      setSubmitted(true);
    } catch {
      setError("Unable to reach the server. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-4 text-center">Check your email</h1>
        <p className="text-muted text-center mb-8">
          If an account with that email exists, we&apos;ve sent a password reset link.
          Check your inbox and spam folder.
        </p>
        <Link
          href="/login"
          className="block text-center text-accent hover:underline"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-4 text-center">Forgot password</h1>
      <p className="text-muted text-center mb-8">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="email"
            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {isLoading ? "Sending..." : "Send reset link"}
        </button>
        <p className="text-sm text-center text-muted">
          Remember your password?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
