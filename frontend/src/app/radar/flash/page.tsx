import type { Metadata } from "next";
import Link from "next/link";
import RadarFlasher from "./RadarFlasher";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://iotivate.dev";

const META_DESCRIPTION =
  "Flash IoTivate Radar firmware to your ESP32 directly from the browser — no drivers, " +
  "no toolchain. Then pair it and watch live presence tracking.";

export const metadata: Metadata = {
  title: "Flash Radar firmware",
  description: META_DESCRIPTION,
  alternates: { canonical: "/radar/flash" },
  openGraph: {
    title: "Flash IoTivate Radar firmware",
    description: META_DESCRIPTION,
    url: `${SITE_URL}/radar/flash`,
    type: "website",
  },
};

export default function RadarFlashPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-medium uppercase tracking-widest text-accent">
          IoTivate Radar
        </span>
        <h1 className="text-3xl font-semibold sm:text-4xl">Flash your device</h1>
        <p className="text-muted">
          Connect your ESP32 over USB and flash it right here — the browser talks to the chip
          directly via Web Serial, so there&apos;s nothing to install. Use a Chromium-based browser
          (Chrome or Edge) on desktop.
        </p>
      </header>

      <ol className="flex flex-col gap-2 text-sm text-muted">
        <li>1. Plug the ESP32 into a USB port (a data cable, not charge-only).</li>
        <li>2. Click Connect below and pick the serial port.</li>
        <li>3. Flash the firmware, then continue to pairing.</li>
      </ol>

      <div className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        A prebuilt radar firmware build isn&apos;t published yet — for now, select your compiled{" "}
        <code>.bin</code> below. Once an official build ships, this page will download it
        automatically.
      </div>

      <RadarFlasher />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/radar/devices"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Pair a device →
        </Link>
        <Link
          href="/radar/build"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface"
        >
          Build guide
        </Link>
      </div>
    </div>
  );
}
