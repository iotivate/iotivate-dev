import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd, ORGANIZATION } from "@/lib/jsonld";
import PrintStudio from "@/components/printing/PrintStudio";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

const META_DESCRIPTION =
  "Online 3D printing in Nigeria — upload your STL for an instant quote, pick a material and colour, " +
  "and we print and deliver it. No model? We'll design it for you.";

export const metadata: Metadata = {
  title: "3D Printing — upload, quote, print & deliver",
  description: META_DESCRIPTION,
  alternates: { canonical: "/3d-print" },
  keywords: [
    "3D printing Nigeria",
    "online 3D printing service",
    "STL print service",
    "3D print quote",
    "custom 3D printing Abuja",
    "3D design service",
  ],
  openGraph: {
    title: "3D Printing — upload, quote, print & deliver",
    description: META_DESCRIPTION,
    url: `${SITE_URL}/3d-print`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "3D Printing — upload, quote, print & deliver",
    description: META_DESCRIPTION,
  },
};

export default async function PrintPage() {
  // Vercel sets the visitor's country; allow Nigeria + unknown/dev.
  const country = (await headers()).get("x-vercel-ip-country");
  const geoAllowed = !country || country === "NG";

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "3D printing & design",
          name: "iotivate 3D Printing",
          areaServed: "NG",
          url: `${SITE_URL}/3d-print`,
          description: META_DESCRIPTION,
          provider: ORGANIZATION,
        }}
      />

      <header className="mb-8 flex flex-col gap-3">
        <span className="text-sm font-medium uppercase tracking-widest text-accent">iotivate · 3D Printing</span>
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Upload your model, get an instant quote, we print &amp; deliver
        </h1>
        <p className="max-w-2xl text-muted">{META_DESCRIPTION}</p>
      </header>

      <PrintStudio geoAllowed={geoAllowed} />

      {/* How it works */}
      <section className="mt-14 grid gap-6 sm:grid-cols-3">
        {[
          ["1", "Upload or describe", "Drop in an STL for an instant quote — or tell us what to design."],
          ["2", "We confirm & you pay", "We check the model, confirm the final price, and send a payment link."],
          ["3", "Printed & delivered", "We print it and ship it to you anywhere in Nigeria."],
        ].map(([n, t, b]) => (
          <div key={n} className="flex flex-col gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 font-semibold text-accent">{n}</span>
            <h3 className="font-semibold">{t}</h3>
            <p className="text-sm text-muted">{b}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
