"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const result = await login(username, password);
    setIsLoading(false);

    if (result.ok) {
      router.push("/");
    } else {
      setError(result.error || "Login failed");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {resetSuccess && (
        <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
          Password reset successfully. Sign in with your new password.
        </p>
      )}
      <div>
        <label htmlFor="username" className="block text-sm font-medium mb-2">
          Username
        </label>
        <input
          type="text"
          id="username"
          name="username"
          required
          minLength={3}
          maxLength={30}
          autoComplete="username"
          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
        />
      </div>
      <div className="flex justify-end -mt-4">
        <Link
          href="/forgot-password"
          className="text-sm text-accent hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-sm text-center text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-accent hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}
