"use client";

import Link from "next/link";
import { usePro } from "@/lib/auth";
import type { ReactNode } from "react";

interface ProGateProps {
  children: ReactNode;
  featureName?: string;
  fallback?: ReactNode;
}

export default function ProGate({ children, featureName, fallback }: ProGateProps) {
  const { isPro, isLoading, isLoggedIn } = usePro();

  if (isLoading) return null;

  if (isPro) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  const linkHref = isLoggedIn ? "/pro" : "/login";
  const linkLabel = isLoggedIn ? "Upgrade to Pro" : "Log in to upgrade";

  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-accent/10 text-accent border border-accent/20">
        PRO
      </span>
      <span>
        {featureName ? `${featureName} is` : "This feature is"} available with iotivate Pro.{" "}
        <Link href={linkHref} className="text-accent hover:underline">
          {linkLabel}
        </Link>
      </span>
    </div>
  );
}
