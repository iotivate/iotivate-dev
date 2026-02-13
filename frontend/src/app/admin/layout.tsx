"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, authFetch } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      router.push("/login");
      return;
    }

    // Check if user is admin
    authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/admin/me`)
      .then((res) => {
        if (res.ok) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          router.push("/");
        }
      })
      .catch(() => {
        setIsAdmin(false);
        router.push("/");
      });
  }, [token, isLoading, router]);

  if (isLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/admin" className="font-semibold text-accent">
                Admin
              </Link>
              <div className="flex gap-4 text-sm">
                <Link href="/admin/tools" className="text-muted hover:text-foreground transition-colors">
                  Tools
                </Link>
                <Link href="/admin/projects" className="text-muted hover:text-foreground transition-colors">
                  Projects
                </Link>
                <Link href="/admin/contacts" className="text-muted hover:text-foreground transition-colors">
                  Contacts
                </Link>
              </div>
            </div>
            <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
              Back to site
            </Link>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
