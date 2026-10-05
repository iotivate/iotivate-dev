import Link from "next/link";
import { JsonLd, WEBSITE, ORGANIZATION } from "@/lib/jsonld";
import PcbBackground from "@/components/PcbBackground";
import HeroAnimations from "@/components/HeroAnimations";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <JsonLd data={WEBSITE} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          ...ORGANIZATION,
        }}
      />
      {/* Hero */}
      <section className="relative py-20 sm:py-32">
        <PcbBackground />
        <HeroAnimations>
          <div className="relative z-10">
            <h1 className="hero-title text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl">
              Build, flash, and print your hardware ideas.
            </h1>
            <p className="hero-description mt-6 text-lg sm:text-xl text-muted max-w-2xl leading-relaxed">
              A maker platform in one place: on-demand 3D printing, buildable IoT
              products like mmWave radar and GPS trackers, and free browser tools to
              flash firmware, monitor serial, and plan pinouts — no installs.
            </p>
            <div className="hero-buttons mt-10 flex flex-wrap gap-4">
              <Link
                href="/3d-print"
                className="inline-flex items-center px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors"
              >
                Start a 3D print
              </Link>
              <Link
                href="/tools"
                className="inline-flex items-center px-6 py-3 border border-border font-medium rounded-lg hover:bg-surface transition-colors"
              >
                Launch tools
              </Link>
            </div>
            <p className="hero-tagline mt-8 text-sm italic text-muted">
              Simplifying IoT, one module at a time.
            </p>
          </div>
        </HeroAnimations>
      </section>

      {/* What's on iotivate */}
      <section className="py-16 border-t border-border">
        <h2 className="text-2xl font-bold mb-8">Explore iotivate</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card
            href="/3d-print"
            title="3D Printing"
            description="Upload a model for an instant quote, pick a material and colour, and we print and deliver it. No model? We'll design it."
          />
          <Card
            href="/tools"
            title="Browser tools"
            description="Flash firmware, monitor serial, and plan pinouts — straight from the browser, no installs required."
          />
          <Card
            href="/radar"
            title="Radar"
            description="Turn an ESP32 + mmWave sensor into a live presence-sensing dashboard with zones, rules, and alerts."
          />
          <Card
            href="/iotibike"
            title="iotiBike"
            description="Smart GPS tracking, anti-theft, and fuel-vs-electricity savings for one bike or a whole fleet."
          />
        </div>
      </section>
    </div>
  );
}

function Card({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="block p-6 border border-border rounded-lg transition-colors hover:border-accent/50 hover:bg-surface">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </Link>
  );
}
