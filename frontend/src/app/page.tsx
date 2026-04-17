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
              The browser-based workshop for IoT makers.
            </h1>
            <p className="hero-description mt-6 text-lg sm:text-xl text-muted max-w-2xl leading-relaxed">
              Free tools to flash firmware, monitor serial, and plan pinouts —
              all in your browser, no installs required. Plus buy-and-flash
              project kits you can run on your board straight from the page.
            </p>
            <div className="hero-buttons mt-10 flex flex-wrap gap-4">
              <Link
                href="/tools"
                className="inline-flex items-center px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors"
              >
                Launch Tools
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center px-6 py-3 border border-border font-medium rounded-lg hover:bg-surface transition-colors"
              >
                Browse Projects
              </Link>
            </div>
            <p className="hero-tagline mt-8 text-sm italic text-muted">
              Simplifying IoT, one module at a time.
            </p>
          </div>
        </HeroAnimations>
      </section>

      {/* What We Do */}
      <section className="py-16 border-t border-border">
        <h2 className="text-2xl font-bold mb-8">What we build</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card
            title="Web-Based Tools"
            description="Flash firmware, configure devices, and manage IoT projects directly from your browser. No installs required."
          />
          <Card
            title="Real Projects"
            description="Documented IoT builds with source code, schematics, and firmware — ready to learn from or fork."
          />
          <Card
            title="Open Platform"
            description="Everything we build is designed to be shared, extended, and integrated into your own workflows."
          />
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 border border-border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </div>
  );
}
