"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, authFetch } from "@/lib/auth";
import WebFlasher from "@/components/WebFlasher";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FirmwarePurchaseProps {
  name: string;
  version: string;
  price: number;
  currency?: string;
  features?: string[];
  firmwareUrl?: string;
  sourceCodeUrl?: string;
  projectSlug: string;
  variantId?: string;
}

export default function FirmwarePurchase({
  name,
  version,
  price,
  currency = "USD",
  features = [],
  firmwareUrl,
  sourceCodeUrl,
  projectSlug,
  variantId,
}: FirmwarePurchaseProps) {
  const { user, token } = useAuth();
  const router = useRouter();
  const isFree = price === 0;

  const [isPurchased, setIsPurchased] = useState(isFree);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showFlasher, setShowFlasher] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(price);

  const checkPurchaseStatus = useCallback(async () => {
    if (!token || isFree) return;
    setIsChecking(true);
    try {
      const res = await authFetch(`${API_URL}/api/purchases/${projectSlug}`);
      if (res.ok) {
        const data = await res.json();
        setIsPurchased(data.purchased);
      }
    } catch {
      // Silently fail — user can retry purchase
    } finally {
      setIsChecking(false);
    }
  }, [token, projectSlug, isFree]);

  // Check purchase status on mount and when user changes
  useEffect(() => {
    checkPurchaseStatus();
  }, [checkPurchaseStatus]);

  async function handlePurchase() {
    setError(null);

    if (!user || !token) {
      router.push("/admin/login");
      return;
    }

    setIsLoading(true);

    try {
      const res = await authFetch(`${API_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_slug: projectSlug }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          // Already purchased
          setIsPurchased(true);
          return;
        }
        setError(data.detail || "Failed to start checkout");
        return;
      }

      const { url } = await res.json();

      // Try overlay checkout first, fall back to redirect
      if (window.LemonSqueezy) {
        window.LemonSqueezy.Url.Open(url);

        // Set up event handler to detect when overlay closes
        window.LemonSqueezy.Setup({
          eventHandler: (event) => {
            if (event.event === "Checkout.Success") {
              // Re-check purchase status after a brief delay for webhook processing
              setTimeout(() => checkPurchaseStatus(), 2000);
            }
          },
        });
      } else {
        // Fallback: open in new tab
        window.open(url, "_blank");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-surface border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Firmware</h3>
        <span className="text-xs px-2 py-1 rounded bg-accent/10 text-accent border border-accent/20">
          v{version}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Firmware info */}
        <div>
          <h4 className="font-medium mb-2">{name}</h4>
          {features.length > 0 && (
            <ul className="text-sm text-muted space-y-1">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Purchase or Flash */}
        {!isPurchased ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold">{formattedPrice}</span>
              <button
                onClick={handlePurchase}
                disabled={isLoading || isChecking || (!isFree && !variantId)}
                className="flex-1 px-4 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : isChecking ? (
                  "Checking..."
                ) : !user ? (
                  "Sign in to Purchase"
                ) : (
                  "Buy Firmware"
                )}
              </button>
            </div>
            {!user && (
              <p className="text-xs text-muted">
                You need an account to purchase firmware.{" "}
                <button
                  onClick={() => router.push("/admin/login")}
                  className="text-accent hover:underline"
                >
                  Sign in or create an account
                </button>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{isFree ? "Free" : "Purchased"}</span>
            </div>

            <button
              onClick={() => setShowFlasher(!showFlasher)}
              className="w-full px-4 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {showFlasher ? "Hide Flasher" : "Flash Now"}
            </button>

            {sourceCodeUrl && (
              <a
                href={sourceCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-2.5 border border-border font-medium rounded-lg hover:bg-surface transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Download Source Code
              </a>
            )}
          </div>
        )}
      </div>

      {/* Embedded flasher */}
      {isPurchased && showFlasher && (
        <div className="border-t border-border p-4">
          <WebFlasher firmwareUrl={firmwareUrl} />
        </div>
      )}
    </div>
  );
}
