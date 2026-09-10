"use client";

import { usePro } from "@/lib/auth";
import WebFlasher from "@/components/WebFlasher";

// Hosted radar firmware isn't published yet; until then WebFlasher falls back to
// manual .bin upload. When a build is available, set NEXT_PUBLIC_RADAR_FIRMWARE_URL
// and it will auto-download on connect.
const FIRMWARE_URL = process.env.NEXT_PUBLIC_RADAR_FIRMWARE_URL || undefined;

export default function RadarFlasher() {
  const { isPro } = usePro();
  return <WebFlasher firmwareUrl={FIRMWARE_URL} isPro={isPro} />;
}
