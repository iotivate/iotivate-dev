import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your iotivate.dev account.",
};

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8 text-center">Sign in</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
