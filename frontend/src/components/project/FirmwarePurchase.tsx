"use client";

import { useState } from "react";
import WebFlasher from "@/components/WebFlasher";

interface FirmwarePurchaseProps {
  name: string;
  version: string;
  price: number;
  currency?: string;
  features?: string[];
  firmwareUrl?: string;
  purchased?: boolean;
}

export default function FirmwarePurchase({
  name,
  version,
  price,
  currency = "USD",
  features = [],
  firmwareUrl,
  purchased = false,
}: FirmwarePurchaseProps) {
  const [isPurchased, setIsPurchased] = useState(purchased);
  const [isLoading, setIsLoading] = useState(false);
  const [showFlasher, setShowFlasher] = useState(false);

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(price);

  async function handlePurchase() {
    setIsLoading(true);

    // TODO: Integrate Stripe Checkout
    // For now, simulate purchase
    try {
      // In production, this would redirect to Stripe Checkout
      // const response = await fetch('/api/checkout', {
      //   method: 'POST',
      //   body: JSON.stringify({ firmwareId: name }),
      // });
      // const { url } = await response.json();
      // window.location.href = url;

      // Simulated success for demo
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsPurchased(true);
    } catch (error) {
      console.error("Purchase failed:", error);
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

        {/* Purchase or Flash */}
        {!isPurchased ? (
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold">{formattedPrice}</span>
            <button
              onClick={handlePurchase}
              disabled={isLoading}
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
              ) : (
                "Buy Firmware"
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Purchased</span>
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
          </div>
        )}
      </div>

      {/* Embedded flasher */}
      {isPurchased && showFlasher && (
        <div className="border-t border-border p-4">
          <WebFlasher />
        </div>
      )}
    </div>
  );
}
