"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Tools" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Image src="/logo.png" alt="iotivate.dev" width={32} height={32} />
            iotivate<span className="text-accent">.dev</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === href
                    ? "text-accent bg-accent/10"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="ml-4 pl-4 border-l border-border flex items-center gap-2">
              {isLoading ? (
                <span className="text-sm text-muted">...</span>
              ) : user ? (
                <>
                  <span className="text-sm text-muted">{user.username}</span>
                  <button
                    onClick={logout}
                    className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="px-3 py-1.5 text-sm bg-accent text-white rounded-md hover:bg-accent-hover transition-colors"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
          <MobileMenu pathname={pathname} user={user} isLoading={isLoading} logout={logout} />
        </div>
      </div>
    </nav>
  );
}

interface MobileMenuProps {
  pathname: string;
  user: { username: string } | null;
  isLoading: boolean;
  logout: () => void;
}

function MobileMenu({ pathname, user, isLoading, logout }: MobileMenuProps) {
  return (
    <details className="md:hidden relative">
      <summary className="list-none cursor-pointer p-2">
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </summary>
      <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-lg shadow-lg py-2">
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`block px-4 py-2 text-sm ${
              pathname === href
                ? "text-accent bg-accent/10"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
        <div className="border-t border-border mt-2 pt-2">
          {isLoading ? (
            <span className="block px-4 py-2 text-sm text-muted">...</span>
          ) : user ? (
            <>
              <span className="block px-4 py-2 text-sm text-muted">{user.username}</span>
              <button
                onClick={logout}
                className="block w-full text-left px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="block px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="block px-4 py-2 text-sm text-accent"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </details>
  );
}
