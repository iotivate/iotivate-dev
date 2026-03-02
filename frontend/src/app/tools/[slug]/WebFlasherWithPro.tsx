"use client";

import WebFlasher from "@/components/WebFlasher";
import { usePro } from "@/lib/auth";

export default function WebFlasherWithPro() {
  const { isPro } = usePro();
  return <WebFlasher isPro={isPro} />;
}