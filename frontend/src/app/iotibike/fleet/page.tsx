"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  getFleetSummary,
  listAssets,
  type Asset,
  type FleetSummary,
} from "@/lib/iotibike";
import AssetList from "@/components/iotibike/AssetList";
import FleetMap from "@/components/iotibike/FleetMap";
import AssetDetail from "@/components/iotibike/AssetDetail";

/*
 * iotiBike — Fleet Overview (Screen 1).
 * Path-based (/iotibike), same-origin so it shares the site session, mirroring
 * the /radar section. Renders sample data today; the data layer (lib/iotibike)
 * swaps to the real API once devices stream in.
 */
export default function IotiBikeFleetPage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !token) router.push("/login");
  }, [isLoading, token, router]);

  useEffect(() => {
    if (isLoading || !token) return;
    let active = true;
    Promise.all([listAssets(), getFleetSummary()]).then(([a, s]) => {
      if (!active) return;
      setAssets(a);
      setSummary(s);
      setSelectedId((cur) => cur ?? a[0]?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [isLoading, token]);

  const selected = useMemo(
    () => assets.find((a) => a.id === selectedId) ?? null,
    [assets, selectedId],
  );

  if (isLoading || !token) {
    return <div className="px-6 py-16 text-muted">Loading…</div>;
  }

  if (!summary || !selected) {
    return <div className="px-6 py-16 text-muted">Loading fleet…</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:h-[calc(100vh-4rem)] lg:grid-cols-[322px_1fr_348px]">
      <AssetList assets={assets} selectedId={selectedId} onSelect={setSelectedId} />
      <FleetMap assets={assets} selectedId={selectedId} onSelect={setSelectedId} summary={summary} />
      <AssetDetail asset={selected} />
    </div>
  );
}
