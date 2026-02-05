import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="py-20 sm:py-32">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl">
          Simplifying IoT, One Module at a Time.
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted max-w-2xl leading-relaxed">
          We build practical tools, firmware, and hardware that make ESP32 and
          IoT projects easier to create, share, and deploy — without the
          complexity.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
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
            Explore Projects
          </Link>
        </div>
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
