import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, ORGANIZATION } from "@/lib/jsonld";
import RadarCta from "./RadarCta";

/*
 * Public marketing landing for iotivate.dev/radar. Server-rendered for SEO
 * (metadata + JSON-LD); the auth-aware CTA is the only client island.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

const META_DESCRIPTION =
  "Turn an mmWave radar module and an ESP32 into a live presence-sensing dashboard — " +
  "draw zones, set rules, get instant alerts, and trigger a remote alarm, all under your " +
  "existing iotivate account.";

export const metadata: Metadata = {
  title: "Radar — Live mmWave presence sensing",
  description: META_DESCRIPTION,
  alternates: { canonical: "/radar" },
  keywords: [
    "mmWave radar",
    "ESP32 presence sensor",
    "occupancy detection",
    "IoT dashboard",
    "presence sensing",
    "radar zones and rules",
  ],
  openGraph: {
    title: "IoTivate Radar — Live mmWave presence sensing",
    description: META_DESCRIPTION,
    url: `${SITE_URL}/radar`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "IoTivate Radar — Live mmWave presence sensing",
    description: META_DESCRIPTION,
  },
};

const FEATURES = [
  {
    icon: "📡",
    title: "Live XY tracking",
    body: "Watch tracked targets move across a top-down radar plot in real time, straight from your ESP32 over a secure WebSocket.",
  },
  {
    icon: "▦",
    title: "Zones & rules",
    body: "Draw zones on the map and set rules — enter, exit, dwell, or occupancy thresholds — that evaluate every frame.",
  },
  {
    icon: "🔔",
    title: "Instant alerts",
    body: "Fire a dashboard alert, an email, or a remote alarm on the device itself the moment a rule trips.",
  },
  {
    icon: "🛰️",
    title: "Multi-device fleet",
    body: "Manage many devices from one place, with live online status, frame rate, and last-seen at a glance.",
  },
  {
    icon: "📈",
    title: "Analytics & history",
    body: "See events over time, busiest zones, and presence-by-hour — no raw-data firehose, just the signal.",
  },
  {
    icon: "🔒",
    title: "Secure by design",
    body: "Per-device tokens, authenticated WebSockets, and role-based sharing (owner / admin / viewer) on one account.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Flash & connect",
    body: "Pair an mmWave module with an ESP32 and point it at your iotivate account.",
  },
  {
    n: "2",
    title: "Pair with a code",
    body: "Add a device in the dashboard and enter the pairing code on the device — it gets its own token.",
  },
  {
    n: "3",
    title: "Watch & automate",
    body: "See live presence, draw zones, add rules, and get alerts. Upgrade to Pro for automation depth.",
  },
];

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-5xl px-6 ${className}`}>{children}</section>;
}

export default function RadarHome() {
  return (
    <div className="flex flex-col gap-20 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "IoTivate Radar",
          applicationCategory: "IoT presence sensing dashboard",
          operatingSystem: "Web",
          url: `${SITE_URL}/radar`,
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
        <span className="text-sm font-medium uppercase tracking-widest text-accent">
          IoTivate Radar
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Live mmWave presence sensing, on your own account
        </h1>
        <p className="max-w-2xl text-lg text-muted">{META_DESCRIPTION}</p>
        <RadarCta />
      </Section>

      {/* Features */}
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-surface p-6">
              <div className="text-2xl" aria-hidden>
                {f.icon}
              </div>
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
          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 font-semibold text-accent">
                {s.n}
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-muted">{s.body}</p>
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
              The live dashboard and multi-device fleet are free. Zones, rules, notifications, and
              analytics depth unlock with iotivate Pro — one subscription across every product.
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
        <h2 className="text-2xl font-semibold">Ready to see who&apos;s there?</h2>
        <RadarCta />
        <p className="text-sm text-muted">
          Building the hardware yourself?{" "}
          <Link href="/radar/build" className="text-accent hover:underline">
            Follow the build guide
          </Link>{" "}
          or{" "}
          <Link href="/radar/flash" className="text-accent hover:underline">
            flash firmware from your browser
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
