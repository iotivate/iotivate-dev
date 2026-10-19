import type { Metadata } from "next";
import Link from "next/link";
import ServiceInquiryForm from "@/components/services/ServiceInquiryForm";
import { JsonLd, ORGANIZATION } from "@/lib/jsonld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

const META_DESCRIPTION =
  "Final-year & masters project builds for students — working IoT/embedded hardware prototypes, " +
  "built, tested and documented, delivered on time. ESP32, sensors, automation & robotics. Across Nigeria.";

export const metadata: Metadata = {
  title: "Final-Year & Masters Project Builds",
  description: META_DESCRIPTION,
  alternates: { canonical: "/final-year-projects" },
  keywords: [
    "final year project Nigeria",
    "final year project help",
    "engineering project build",
    "ESP32 student project",
    "IoT final year project",
    "masters project prototype",
    "project supervisor",
  ],
  openGraph: {
    title: "Final-Year & Masters Project Builds",
    description: META_DESCRIPTION,
    url: `${SITE_URL}/final-year-projects`,
    type: "website",
  },
};

const GET = [
  { icon: "idea", title: "Concept & scoping", body: "Not sure what to build or how? We help you shape a solid, achievable project around your topic." },
  { icon: "build", title: "A working prototype", body: "Real, functioning hardware — not just slides. Built, wired, and programmed to actually work." },
  { icon: "test", title: "Tested & reliable", body: "We test it properly so it works on demo day, not just on the bench." },
  { icon: "docs", title: "Documentation support", body: "Block diagrams, circuit diagrams, component lists and methodology to back up your report." },
  { icon: "learn", title: "You understand it", body: "We walk you through how it works so you can defend and present it with confidence." },
  { icon: "clock", title: "On your deadline", body: "We plan around your submission date and keep you updated so nothing slips." },
];

const FIELDS = ["IoT & connected devices", "Embedded systems (ESP32, Arduino)", "Automation & control", "Robotics", "Sensors & monitoring", "Power & energy"];

const STEPS = [
  { n: "1", title: "Share your project", body: "Send your topic, requirements, and deadline. Got a project brief or supervisor's spec? Even better." },
  { n: "2", title: "Scope & quote", body: "We confirm what's achievable and send a clear quote and timeline — no surprises." },
  { n: "3", title: "Build & test", body: "We design, build and test the prototype, keeping you updated as it comes together." },
  { n: "4", title: "Deliver & walkthrough", body: "You get the working build, documentation, and a walkthrough so you can present it confidently." },
];

export default function FinalYearProjectsPage() {
  return (
    <div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Student hardware project builds",
          name: "iotivate Final-Year & Masters Project Builds",
          areaServed: "NG",
          url: `${SITE_URL}/final-year-projects`,
          description: META_DESCRIPTION,
          provider: ORGANIZATION,
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-surface/40">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <span className="text-sm font-medium uppercase tracking-widest text-accent">iotivate · Student Projects</span>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-balance sm:text-5xl">
            Your final-year project — built, tested, and ready to defend
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Working IoT and embedded hardware prototypes for final-year and masters students —
            designed, built, documented, and delivered on time, so you can focus on presenting it well.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#start" className="inline-flex items-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
              Get your project started
            </Link>
            <Link href="#process" className="inline-flex items-center rounded-lg border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-surface">
              How it works
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6">
        {/* What you get */}
        <section className="py-16">
          <h2 className="text-2xl font-bold tracking-tight">What you get</h2>
          <p className="mt-2 max-w-2xl text-muted">A complete project you can hand in and defend — not a pile of parts.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GET.map((d) => (
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

        {/* Fields */}
        <section className="border-t border-border py-16">
          <h2 className="text-2xl font-bold tracking-tight">Projects we build</h2>
          <p className="mt-2 max-w-2xl text-muted">If it involves hardware, sensors, or microcontrollers, we can build it.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {FIELDS.map((f) => (
              <span key={f} className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground">{f}</span>
            ))}
          </div>
        </section>

        {/* Process */}
        <section id="process" className="border-t border-border py-16">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 font-mono font-semibold text-accent">{s.n}</span>
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
              <h2 className="text-2xl font-bold tracking-tight">Tell us about your project</h2>
              <p className="mt-3 text-muted">
                Send your topic and deadline — we&apos;ll reply with what&apos;s achievable, a quote, and a plan.
                The earlier you reach out, the smoother it goes.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-muted">
                {["Working prototype, not just theory", "Documentation to back your report", "We explain it so you can defend it", "Built around your deadline"].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none text-accent" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-3">
              <ServiceInquiryForm
                service="Final-Year Project"
                detailsLabel="Your project topic & requirements"
                detailsPlaceholder="e.g. An IoT-based smart irrigation system that monitors soil moisture and controls a water pump, with data on a mobile app. Due in 6 weeks. Department: Electrical Engineering."
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
    case "idea":
      return <svg {...common}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.5.5 1 1.2 1 2.5h6c0-1.3.5-2 1-2.5A6 6 0 0 0 12 3Z" /></svg>;
    case "build":
      return <svg {...common}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a2 2 0 1 0 3 3l6-6a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6Z" /></svg>;
    case "test":
      return <svg {...common}><path d="M9 3h6M10 3v6l-4.5 8A2 2 0 0 0 7.3 20h9.4a2 2 0 0 0 1.8-3L14 9V3" /></svg>;
    case "docs":
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg>;
    case "learn":
      return <svg {...common}><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}
