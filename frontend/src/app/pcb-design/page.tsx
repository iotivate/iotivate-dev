import type { Metadata } from "next";
import Link from "next/link";
import PcbBackground from "@/components/PcbBackground";
import ServiceInquiryForm from "@/components/services/ServiceInquiryForm";
import { JsonLd, ORGANIZATION } from "@/lib/jsonld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

const META_DESCRIPTION =
  "Custom PCB design service — from schematic to production-ready Gerbers, BOM and layout. " +
  "ESP32 & IoT boards a specialty. Tell us your requirements and we design it. Delivery across Nigeria.";

export const metadata: Metadata = {
  title: "PCB Design — schematic, layout & production files",
  description: META_DESCRIPTION,
  alternates: { canonical: "/pcb-design" },
  keywords: [
    "PCB design Nigeria",
    "custom PCB design",
    "schematic design",
    "PCB layout service",
    "ESP32 PCB design",
    "Gerber files",
    "IoT hardware design",
  ],
  openGraph: {
    title: "PCB Design — schematic, layout & production files",
    description: META_DESCRIPTION,
    url: `${SITE_URL}/pcb-design`,
    type: "website",
  },
};

const DELIVERABLES = [
  { icon: "schematic", title: "Schematic design", body: "A clean, reviewed schematic — correct symbols, power, and connections you can trust." },
  { icon: "layout", title: "PCB layout & routing", body: "Tidy component placement and routing, optimised for signal integrity and manufacturability." },
  { icon: "files", title: "Production-ready files", body: "Gerbers, drill files, pick-and-place and a full BOM — everything a fab house needs." },
  { icon: "chip", title: "ESP32 & IoT focus", body: "Microcontrollers, sensors, power management, wireless — the hardware we build every day." },
  { icon: "check", title: "DFM review", body: "Design-for-manufacturing checks so your board actually builds cleanly the first time." },
  { icon: "handoff", title: "Fab & assembly handoff", body: "We can hand files to your manufacturer, or guide you through ordering your boards." },
];

const STEPS = [
  { n: "1", title: "Share your requirements", body: "Tell us what the board should do — features, parts, constraints, deadline. A sketch or datasheet helps." },
  { n: "2", title: "Schematic & quote", body: "We scope it, send a fixed quote, then design and review the schematic with you." },
  { n: "3", title: "Layout & routing", body: "Component placement, routing, and DFM checks — iterated until it's production-ready." },
  { n: "4", title: "Delivery", body: "You get Gerbers, BOM, and all production files — ready to manufacture, anywhere." },
];

export default function PcbDesignPage() {
  return (
    <div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "PCB design",
          name: "iotivate PCB Design",
          areaServed: "NG",
          url: `${SITE_URL}/pcb-design`,
          description: META_DESCRIPTION,
          provider: ORGANIZATION,
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <PcbBackground />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <span className="text-sm font-medium uppercase tracking-widest text-accent">iotivate · PCB Design</span>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-balance sm:text-5xl">
            Custom PCB design, from idea to production-ready board
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Describe what you need and we design it — schematic, layout, and all the production files your
            manufacturer needs. ESP32, sensors and IoT hardware are our everyday work.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#start"
              className="inline-flex items-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Start your PCB
            </Link>
            <Link
              href="#process"
              className="inline-flex items-center rounded-lg border border-border bg-background/60 px-6 py-3 text-sm font-medium backdrop-blur transition-colors hover:bg-surface"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6">
        {/* Deliverables */}
        <section className="py-16">
          <h2 className="text-2xl font-bold tracking-tight">What you get</h2>
          <p className="mt-2 max-w-2xl text-muted">A complete, manufacturable design package — not just a drawing.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DELIVERABLES.map((d) => (
              <div key={d.title} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon name={d.icon} />
                </div>
                <h3 className="mt-4 font-semibold">{d.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{d.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Process */}
        <section id="process" className="border-t border-border py-16">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <p className="mt-2 max-w-2xl text-muted">A simple, transparent path from brief to boards.</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 font-mono font-semibold text-accent">
                  {s.n}
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Inquiry */}
        <section id="start" className="border-t border-border py-16">
          <div className="grid gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold tracking-tight">Tell us about your board</h2>
              <p className="mt-3 text-muted">
                Share the idea — even a rough one. We&apos;ll come back with a fixed quote and a timeline.
                You only pay once we agree on the scope.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-muted">
                {["Fixed quote before any work starts", "Production-ready files you own", "ESP32 / IoT specialists", "Delivery & support across Nigeria"].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none text-accent" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-3">
              <ServiceInquiryForm
                service="PCB Design"
                detailsLabel="What should the board do?"
                detailsPlaceholder="e.g. An ESP32-based sensor board that reads temperature + humidity, runs on a LiPo battery with USB-C charging, and sends data over WiFi. ~50×40mm."
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const common = { className: "h-5 w-5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "schematic":
      return <svg {...common}><path d="M4 7h4M16 7h4M12 3v4M4 17h4M16 17h4M12 17v4" /><rect x="8" y="5" width="8" height="4" rx="1" /><rect x="8" y="15" width="8" height="4" rx="1" /></svg>;
    case "layout":
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18M15 15h.01M18 12h.01" /></svg>;
    case "files":
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg>;
    case "chip":
      return <svg {...common}><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2" /></svg>;
    case "check":
      return <svg {...common}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
    case "handoff":
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}
