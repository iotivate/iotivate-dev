import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import WebFlasher from "@/components/WebFlasher";

export const metadata: Metadata = {
  title: "ESP32 Web Flasher",
  description: "Flash ESP32 firmware directly from your browser.",
};

export default function Esp32WebFlasherPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <PageHeader
        title="ESP32 Web Flasher"
        description="Flash ESP32 firmware directly from your browser using the Web Serial API. No drivers, no installs."
      />
      <WebFlasher />
    </div>
  );
}
