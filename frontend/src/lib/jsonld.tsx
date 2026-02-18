const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

export const ORGANIZATION = {
  "@type": "Organization",
  name: "iotivate",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon-32.png`,
};

export const WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "iotivate.dev",
  url: SITE_URL,
  description:
    "Practical web-based tools, firmware, and hardware for ESP32 and IoT projects.",
  publisher: ORGANIZATION,
};

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
