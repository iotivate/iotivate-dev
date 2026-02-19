"use client";

import StlViewer from "@/components/StlViewer";
import { usePro } from "@/lib/auth";

export default function StlViewerWithPro() {
  const { isPro } = usePro();
  return <StlViewer isPro={isPro} />;
}
