"use client";

import SerialMonitor from "@/components/SerialMonitor";
import { usePro } from "@/lib/auth";

export default function SerialMonitorWithPro() {
  const { isPro } = usePro();
  return <SerialMonitor isPro={isPro} />;
}
