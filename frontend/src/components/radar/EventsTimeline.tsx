"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listEvents, TRIGGER_LABELS, type RuleEvent, type Zone } from "@/lib/zones";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function EventsTimeline({
  deviceId,
  zones,
  reloadSignal,
}: {
  deviceId: number;
  zones: Zone[];
  reloadSignal: number;
}) {
  const [events, setEvents] = useState<RuleEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const zoneName = useMemo(() => {
    const m = new Map<number, string>();
    zones.forEach((z) => m.set(z.id, z.name));
    return m;
  }, [zones]);

  const load = useCallback(() => {
    listEvents(deviceId, 50)
      .then((res) => {
        setEvents(res.items);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load events"));
  }, [deviceId]);

  // Refetch on mount and whenever a rule fires live (reloadSignal bumps).
  useEffect(() => {
    load();
  }, [load, reloadSignal]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Recent activity</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {events.length === 0 ? (
        <p className="text-sm text-muted">No rule activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
                  {TRIGGER_LABELS[ev.trigger_type]}
                </span>
                <span>{zoneName.get(ev.zone_id) ?? `Zone ${ev.zone_id}`}</span>
              </div>
              <time className="shrink-0 text-xs text-muted" dateTime={ev.fired_at}>
                {timeAgo(ev.fired_at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
