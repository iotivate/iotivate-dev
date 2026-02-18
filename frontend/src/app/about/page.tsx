import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { JsonLd, ORGANIZATION } from "@/lib/jsonld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

export const metadata: Metadata = {
  title: "About",
  description: "About iotivate — building practical IoT tools and firmware.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About iotivate",
          description:
            "About iotivate — building practical IoT tools and firmware.",
          url: `${SITE_URL}/about`,
          mainEntity: {
            "@context": "https://schema.org",
            ...ORGANIZATION,
          },
        }}
      />
      <PageHeader
        title="About iotivate"
        description="We build practical tools and firmware for the IoT and maker community."
      />
      <div className="prose prose-neutral dark:prose-invert max-w-2xl">
        <div className="space-y-6 text-muted leading-relaxed">
          <p>
            iotivate started from a simple idea: IoT development shouldn&apos;t
            require a complex toolchain just to get started. Too many projects
            die in setup hell before they ever get to the interesting part.
          </p>
          <p>
            We&apos;re building web-based tools that let you flash firmware,
            configure devices, and manage IoT projects — all from your browser.
            No drivers, no desktop apps, no friction.
          </p>
          <p>
            Our projects are documented, open-source, and designed for real-world
            use. Whether you&apos;re a hobbyist building your first ESP32
            project or an engineer prototyping a product, we want to make the
            process faster and less painful.
          </p>
          <h2 className="text-xl font-semibold text-foreground pt-4">
            What&apos;s next
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>ESP32 web-based firmware flasher</li>
            <li>Project showcase with build guides</li>
            <li>Firmware marketplace</li>
            <li>OTA update infrastructure</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
