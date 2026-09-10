"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getEventSummary,
  getOccupancy,
  type EventSummary,
  type OccupancySeries,
} from "@/lib/analytics";
import { TRIGGER_LABELS, type TriggerType } from "@/lib/zones";

const WINDOWS = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
];

/** Dependency-free vertical bar chart from flex columns. */
function Bars({
  points,
  colorClass = "bg-accent",
}: {
  points: { label: string; value: number; title?: string }[];
  colorClass?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  if (points.length === 0) return <p className="text-sm text-muted">No data in this window.</p>;
  return (
    <div className="flex h-32 items-end gap-1 overflow-x-auto">
      {points.map((p, i) => (
        <div
          key={i}
          className="flex min-w-[14px] flex-1 flex-col items-center gap-1"
          title={p.title ?? `${p.label}: ${p.value}`}
        >
          <div className="flex w-full flex-1 items-end">
            <div
              className={`w-full rounded-t ${colorClass}`}
              style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-full truncate text-center text-[10px] text-muted">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPanel({
  deviceId,
  reloadSignal,
}: {
  deviceId: number;
  reloadSignal: number;
}) {
  const [windowHours, setWindowHours] = useState(168);
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancySeries | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      getEventSummary(deviceId, windowHours),
      getOccupancy(deviceId, Math.min(windowHours, 720)),
    ])
      .then(([s, o]) => {
        setSummary(s);
        setOccupancy(o);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analytics"));
  }, [deviceId, windowHours]);

  useEffect(() => {
    load();
  }, [load, reloadSignal]);

  const dailyPoints = (summary?.daily ?? []).map((d) => ({
    label: d.date.slice(5), // MM-DD
    value: d.count,
    title: `${d.date}: ${d.count} events`,
  }));
  const triggers = Object.entries(summary?.by_trigger ?? {});

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.hours}
              onClick={() => setWindowHours(w.hours)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                windowHours === w.hours
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border hover:bg-surface"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Events</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{summary?.total_events ?? "—"}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Zones tracked</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{occupancy?.zones.length ?? "—"}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Triggers</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {triggers.length === 0 ? (
              <span className="text-sm text-muted">—</span>
            ) : (
              triggers.map(([t, c]) => (
                <span key={t} className="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
                  {TRIGGER_LABELS[t as TriggerType] ?? t} {c}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 text-sm font-medium">Events per day</div>
        <Bars points={dailyPoints} />
      </div>

      {summary && summary.by_zone.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-2 text-sm font-medium">Events by zone</div>
          <ul className="flex flex-col gap-1 text-sm">
            {summary.by_zone.map((z) => (
              <li key={z.zone_id} className="flex justify-between">
                <span className="truncate">{z.name}</span>
                <span className="tabular-nums text-muted">{z.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {occupancy && occupancy.zones.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 text-sm font-medium">Peak occupancy by hour</div>
          <div className="flex flex-col gap-4">
            {occupancy.zones.map((z) => (
              <div key={z.zone_id}>
                <div className="mb-1 text-xs text-muted">{z.name}</div>
                <Bars
                  points={z.points.map((p) => ({
                    label: p.hour.slice(11, 13), // HH
                    value: p.max,
                    title: `${p.hour.slice(0, 16).replace("T", " ")} · peak ${p.max}, avg ${p.avg}`,
                  }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
