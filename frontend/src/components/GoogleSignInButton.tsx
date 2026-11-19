"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const GSI_SRC = "https://accounts.google.com/gsi/client";

/**
 * "Sign in with Google" via Google Identity Services. Renders nothing unless
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is set, so it's safe to ship before Google is
 * configured. The ID token Google returns is verified server-side.
 */
export default function GoogleSignInButton({
  onError,
  redirectTo = "/",
}: {
  onError?: (msg: string) => void;
  redirectTo?: string;
}) {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const ref = useRef<HTMLDivElement | null>(null);

  const handleCredential = useCallback(
    async (resp: { credential?: string }) => {
      if (!resp?.credential) {
        onError?.("Google sign-in was cancelled.");
        return;
      }
      const result = await loginWithGoogle(resp.credential);
      if (result.ok) router.push(redirectTo);
      else onError?.(result.error || "Google sign-in failed.");
    },
    [loginWithGoogle, router, redirectTo, onError],
  );

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !ref.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential });
      window.google.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        logo_alignment: "center",
        width: Math.min(ref.current.offsetWidth || 360, 400),
      });
    };

    if (window.google?.accounts?.id) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    const target = existing ?? document.createElement("script");
    if (!existing) {
      target.src = GSI_SRC;
      target.async = true;
      target.defer = true;
      document.head.appendChild(target);
    }
    target.addEventListener("load", render, { once: true });

    return () => {
      cancelled = true;
      target.removeEventListener("load", render);
    };
  }, [handleCredential]);

  if (!CLIENT_ID) return null;
  return <div ref={ref} className="flex min-h-[40px] justify-center" />;
}
