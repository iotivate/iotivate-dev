import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { JsonLd, ORGANIZATION } from "@/lib/jsonld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

const META_DESCRIPTION =
  "About iotivate — browser-based tools and buy-and-flash project blueprints for IoT makers.";

export const metadata: Metadata = {
  title: "About",
  description: META_DESCRIPTION,
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
          description: META_DESCRIPTION,
          url: `${SITE_URL}/about`,
          mainEntity: {
            "@context": "https://schema.org",
            ...ORGANIZATION,
          },
        }}
      />
      <PageHeader
        title="About iotivate"
        description="Simplifying IoT, one module at a time."
      />
      <div className="prose prose-neutral dark:prose-invert max-w-2xl">
        <div className="space-y-6 text-muted leading-relaxed">
          <p>
            iotivate started from a simple idea: building connected devices
            shouldn&apos;t require fighting your toolchain before you write a
            single line of code. Too many projects die in setup hell before
            they ever get to the interesting part. So we moved the whole
            workshop into the browser.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">
            Tools
          </h2>
          <p>
            Flash firmware, monitor serial, plan pinouts, merge binaries,
            preview 3D enclosures — all from a browser tab. No drivers, no
            desktop apps, no friction. Free for the essentials, with
            iotivate Pro unlocking power-user workflows like batch flashing,
            the serial plotter, macros, export, and split view. Built on open
            web standards so what works today keeps working.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">
            Projects
          </h2>
          <p>
            A growing catalog of complete, working builds — schematic, parts
            list, build guide, and firmware, all in one place. The difference:
            once you buy a project,{" "}
            <strong className="text-foreground font-semibold">
              you flash the firmware to your board directly from the project
              page
            </strong>
            . No downloads, no tooling, no guesswork. You go from &ldquo;I
            want to build this&rdquo; to &ldquo;it&apos;s running on my
            board&rdquo; in minutes.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">
            Where it&apos;s going
          </h2>
          <p>
            Today we focus on ESP32 because that&apos;s where the momentum
            is, but the platform is chip-agnostic by design. STM32, RP2040,
            and other MCUs are chapters still to be written. And the projects
            with real traction don&apos;t stay digital — the most popular
            ones graduate into physical modules you can buy ready-made.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">
            Who it&apos;s for
          </h2>
          <p>
            Hobbyists, students, prototypers, and engineers. Anyone who&apos;s
            tired of spending the first two hours of a Saturday project on
            driver installs and IDE plugins.
          </p>
        </div>
      </div>
    </div>
  );
}
