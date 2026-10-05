"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth, usePro } from "@/lib/auth";

// Products live under the "Solutions" dropdown. Add future products here.
const solutions = [
  { href: "/radar", label: "Radar", desc: "mmWave presence sensing" },
  { href: "/iotibike", label: "iotiBike", desc: "Smart bike & fleet tracking" },
];

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/3d-print", label: "3D Printing" },
  { href: "/tools", label: "Tools" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function isSolutionsActive(pathname: string): boolean {
  return solutions.some((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
}

function SolutionsDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const active = isSolutionsActive(pathname);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          active ? "text-accent bg-accent/10" : "text-muted hover:text-foreground"
        }`}
      >
        Solutions
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-1 w-64 rounded-lg border border-border bg-background py-1 shadow-lg"
        >
          {solutions.map((s) => {
            const itemActive = pathname === s.href || pathname.startsWith(`${s.href}/`);
            return (
              <Link
                key={s.href}
                href={s.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 transition-colors ${
                  itemActive ? "bg-accent/10" : "hover:bg-accent/5"
                }`}
              >
                <span className={`block text-sm font-medium ${itemActive ? "text-accent" : "text-foreground"}`}>
                  {s.label}
                </span>
                <span className="block text-xs text-muted">{s.desc}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const { isPro } = usePro();

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Image src="/logo.png" alt="iotivate.dev" width={32} height={32} />
            iotivate<span className="text-accent">.dev</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {/* Home */}
            <Link
              href="/"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === "/" ? "text-accent bg-accent/10" : "text-muted hover:text-foreground"
              }`}
            >
              Home
            </Link>
            {/* Solutions dropdown (products) */}
            <SolutionsDropdown pathname={pathname} />
            {/* The rest */}
            {navLinks.slice(1).map(({ href, label }) => (
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
                  {isPro ? (
                    <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-accent/10 text-accent border border-accent/20">
                      PRO
                    </span>
                  ) : (
                    <Link
                      href="/pro"
                      className="px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 rounded transition-colors"
                    >
                      Upgrade
                    </Link>
                  )}
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
          <MobileMenu pathname={pathname} user={user} isLoading={isLoading} logout={logout} isPro={isPro} />
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
  isPro: boolean;
}

function MobileMenu({ pathname, user, isLoading, logout, isPro }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <div className="md:hidden relative">
      <button onClick={toggleMenu} className="p-2 cursor-pointer" aria-label="Menu" aria-expanded={isOpen}>
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-background border border-border rounded-lg shadow-lg py-2">
          {/* Home */}
          <Link
            href="/"
            onClick={closeMenu}
            className={`block px-4 py-2 text-sm ${
              pathname === "/" ? "text-accent bg-accent/10" : "text-muted hover:text-foreground"
            }`}
          >
            Home
          </Link>

          {/* Solutions group */}
          <div className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted/70">
            Solutions
          </div>
          {solutions.map((s) => {
            const itemActive = pathname === s.href || pathname.startsWith(`${s.href}/`);
            return (
              <Link
                key={s.href}
                href={s.href}
                onClick={closeMenu}
                className={`block py-2 pl-6 pr-4 text-sm ${
                  itemActive ? "text-accent bg-accent/10" : "text-muted hover:text-foreground"
                }`}
              >
                {s.label}
              </Link>
            );
          })}

          {/* The rest */}
          {navLinks.slice(1).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={closeMenu}
              className={`block px-4 py-2 text-sm ${
                pathname === href ? "text-accent bg-accent/10" : "text-muted hover:text-foreground"
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
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="text-sm text-muted">{user.username}</span>
                  {isPro ? (
                    <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-accent/10 text-accent border border-accent/20">
                      PRO
                    </span>
                  ) : (
                    <Link href="/pro" onClick={closeMenu} className="text-xs text-accent hover:underline">
                      Upgrade
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-muted hover:text-foreground"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm text-muted hover:text-foreground"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm text-accent"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
