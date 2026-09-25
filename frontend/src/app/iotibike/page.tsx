import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, ORGANIZATION } from "@/lib/jsonld";
import WaitlistForm from "./WaitlistForm";

/*
 * Public marketing landing for iotivate.dev/iotibike. Server-rendered for SEO
 * (metadata + JSON-LD); the waitlist form is the only client island. The authed
 * fleet dashboard lives at /iotibike/fleet (mirrors /radar vs /radar/devices).
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

const META_DESCRIPTION =
  "Make any bike smart: a plug-in tracker that streams live location over 4G, alerts you to theft, " +
  "geofences your rides, and shows exactly how much you save versus petrol — for one bike or a whole fleet.";

export const metadata: Metadata = {
  title: "iotiBike — Smart tracking for any bike",
  description: META_DESCRIPTION,
  alternates: { canonical: "/iotibike" },
  keywords: [
    "e-bike tracker",
    "GPS bike tracker",
    "fleet tracking",
    "anti-theft bike",
    "geofence",
    "delivery fleet management",
    "motorcycle tracker Nigeria",
  ],
  openGraph: {
    title: "iotiBike — Smart tracking for any bike",
    description: META_DESCRIPTION,
    url: `${SITE_URL}/iotibike`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iotiBike — Smart tracking for any bike",
    description: META_DESCRIPTION,
  },
};

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const FEATURES = [
  {
    title: "Live GPS tracking",
    body: "See where every bike is, right now, on a live map — streamed over 4G, no WiFi needed.",
    icon: (<><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2.6" /></>),
  },
  {
    title: "Theft & movement alerts",
    body: "Get an instant alert the moment a parked bike moves or leaves where it should be.",
    icon: (<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9.5 12l1.8 1.8L15 10" />),
  },
  {
    title: "Geofences",
    body: "Draw zones on the map and get notified when a bike enters or leaves them.",
    icon: (<><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" /><path d="M9 4v14M15 6v14" /></>),
  },
  {
    title: "Energy economics",
    body: "The headline number: how much you save versus petrol, per ride and per month.",
    icon: (<><path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6M20 16v-2" /></>),
  },
  {
    title: "Trip history",
    body: "Every route, distance, and duration — replay where a bike has been.",
    icon: (<><circle cx="6" cy="7" r="2" /><circle cx="18" cy="17" r="2" /><path d="M8 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h5" /></>),
  },
  {
    title: "Fleet-ready",
    body: "One bike or a hundred — delivery riders, rentals, logistics — all on one dashboard.",
    icon: (<><rect x="3" y="4" width="18" height="5" rx="1.5" /><rect x="3" y="11" width="18" height="5" rx="1.5" /><path d="M7 18h.01M7 6.5h.01M7 13h.01" /></>),
  },
];

const STEPS = [
  { n: "1", title: "Fit the tracker", body: "A small ESP32 + GPS + 4G module mounts on the bike and taps its power. No app-store drivers, no soldering." },
  { n: "2", title: "It streams over 4G", body: "The tracker phones home over cellular — location, speed, battery — even far from any WiFi." },
  { n: "3", title: "See everything on your phone", body: "Live map, alerts, trips, and your real savings — for your bike or your whole fleet." },
];

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-5xl px-6 ${className}`}>{children}</section>;
}

export default function IotiBikeLanding() {
  return (
    <div className="flex flex-col gap-20 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "iotiBike",
          applicationCategory: "Fleet & asset tracking",
          operatingSystem: "Web, iOS, Android",
          url: `${SITE_URL}/iotibike`,
          description: META_DESCRIPTION,
          offers: [
            { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
            { "@type": "Offer", name: "Pro", category: "subscription" },
          ],
          publisher: ORGANIZATION,
        }}
      />

      {/* Hero */}
      <Section className="flex flex-col gap-6">
        <span className="text-sm font-medium uppercase tracking-widest text-accent">iotiBike</span>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Make any bike smart, trackable, and cheaper to run
        </h1>
        <p className="max-w-2xl text-lg text-muted">{META_DESCRIPTION}</p>
        <WaitlistForm />
      </Section>

      {/* Features */}
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-surface p-6">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-accent" {...s}>{f.icon}</svg>
              <h2 className="mt-3 text-lg font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section className="flex flex-col gap-8">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="flex flex-col gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 font-semibold text-accent">
                {step.n}
              </span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Pricing pointer */}
      <Section>
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Free to start, Pro to automate</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Live tracking is free. Geofences, theft automation, full history, and fleet tools unlock
              with iotivate Pro — one subscription across every product.
            </p>
          </div>
          <Link
            href="/pro"
            className="shrink-0 rounded-lg border border-accent px-5 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
          >
            See Pro
          </Link>
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="flex flex-col items-start gap-5">
        <h2 className="text-2xl font-semibold">Be first to make your bike smart</h2>
        <p className="max-w-2xl text-muted">
          We&apos;re building it in the open. Join the waitlist for early access and follow the build.
        </p>
        <WaitlistForm />
      </Section>
    </div>
  );
}
