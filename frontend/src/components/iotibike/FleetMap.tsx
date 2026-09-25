"use client";

import type { Asset, AssetStatus, FleetSummary } from "@/lib/iotibike";

/*
 * Placeholder map: a stylized inline-SVG city map + positioned pins. Looks
 * professional and needs no tile key/dependency. Swap the <svg> base for
 * MapLibre GL once real GPS coordinates are streaming — the pin/overlay layer
 * stays the same.
 */

const pinBg: Record<AssetStatus, string> = {
  moving: "bg-emerald-500",
  idle: "bg-amber-500",
  parked: "bg-slate-400",
  alert: "bg-red-500",
};

function MiniKpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/90 px-3.5 py-2 shadow-sm backdrop-blur">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-0.5 font-mono text-xl font-bold tabular-nums tracking-tight ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export default function FleetMap({
  assets,
  selectedId,
  onSelect,
  summary,
}: {
  assets: Asset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  summary: FleetSummary;
}) {
  return (
    <section className="relative h-[60vh] overflow-hidden bg-[#E9EEEC] lg:h-full dark:bg-[#1a2320]" aria-label="Live map">
      {/* base map */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="1000" height="700" className="fill-[#E9EEEC] dark:fill-[#1a2320]" />
        <rect x="620" y="70" width="260" height="180" rx="26" className="fill-[#D7E6D2] dark:fill-[#23342b]" />
        <path d="M-20 470 C 180 430 300 560 520 520 C 720 484 840 590 1040 540 L1040 720 L-20 720 Z" className="fill-[#CBDDE3] dark:fill-[#1e2e33]" />
        <g className="stroke-[#D8E1DE] dark:stroke-[#2a352f]" strokeWidth={17} fill="none" strokeLinecap="round">
          <path d="M60 120 H940" /><path d="M60 300 H940" /><path d="M120 -20 V680" />
          <path d="M360 -20 V680" /><path d="M640 -20 V680" /><path d="M860 -20 V560" />
          <path d="M60 420 H620" /><path d="M120 560 H900" /><path d="M60 40 L520 300" />
        </g>
        <g className="stroke-white dark:stroke-[#3a463f]" strokeWidth={11} fill="none" strokeLinecap="round">
          <path d="M60 120 H940" /><path d="M60 300 H940" /><path d="M120 -20 V680" />
          <path d="M360 -20 V680" /><path d="M640 -20 V680" /><path d="M860 -20 V560" />
          <path d="M60 420 H620" /><path d="M120 560 H900" /><path d="M60 40 L520 300" />
        </g>
        <path d="M360 300 L360 210 L640 210 L640 120" fill="none" className="stroke-accent" strokeWidth={5} strokeLinecap="round" strokeDasharray="2 12" opacity={0.9} />
      </svg>

      {/* KPI + energy hero overlay */}
      <div className="absolute inset-x-3.5 top-3.5 z-[5] flex flex-wrap items-start gap-3">
        <div className="flex gap-2.5">
          <MiniKpi label="Active" value={String(summary.active)} />
          <MiniKpi label="Moving" value={String(summary.moving)} tone="text-emerald-500" />
          <MiniKpi label="Alerts" value={String(summary.alerts)} tone="text-red-500" />
        </div>
        <div className="ml-auto flex items-center gap-5 rounded-2xl bg-gradient-to-br from-accent to-accent-hover px-5 py-3 text-white shadow-lg shadow-accent/30">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-widest text-white/80">Fleet savings · today</div>
            <div className="mt-1 font-mono text-4xl font-extrabold tracking-tight">₦{summary.savedToday}</div>
            <div className="mt-1.5 text-[11.5px] text-white/90">
              This month <b className="font-semibold">₦{summary.savedMonth}</b> · <b className="font-semibold">≈ {summary.litresMonth} L</b> petrol avoided
            </div>
          </div>
          <div className="flex h-[50px] items-end gap-1" aria-hidden="true">
            {summary.weekBars.map((h, i) => (
              <span
                key={i}
                className={`w-2 rounded-[3px] ${i === summary.weekBars.length - 1 ? "bg-white" : "bg-white/40"}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* pins */}
      {assets.map((a) => {
        const selected = a.id === selectedId;
        return (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            aria-label={a.name}
            className={`absolute z-[6] flex -translate-x-1/2 -translate-y-full flex-col items-center ${selected ? "z-[9]" : ""}`}
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
          >
            <span
              className={`grid place-items-center rounded-[50%_50%_50%_3px] border-2 border-white shadow-md ${pinBg[a.status]} ${
                selected ? "h-[34px] w-[34px] outline outline-[3px] outline-offset-[3px] outline-accent" : "h-[30px] w-[30px]"
              }`}
              style={{ transform: "rotate(45deg)" }}
            >
              <span className="text-[11px] font-bold text-white" style={{ transform: "rotate(-45deg)" }}>{a.initials}</span>
            </span>
            <span className={`mt-1.5 whitespace-nowrap rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] font-semibold shadow-sm transition-opacity ${selected ? "opacity-100" : "opacity-0"}`}>
              {a.name} · {a.status === "moving" ? `${a.speed} km/h` : a.statusLabel}
            </span>
          </button>
        );
      })}

      {/* controls */}
      <div className="absolute bottom-4 right-3.5 z-[6] flex flex-col gap-1.5">
        {[
          <path key="in" d="M12 5v14M5 12h14" />,
          <path key="out" d="M5 12h14" />,
          <path key="layers" d="M12 3l9 5-9 5-9-5 9-5zM3 12l9 5 9-5" />,
        ].map((p, i) => (
          <button key={i} className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-border bg-surface shadow-sm hover:bg-background" aria-label={["Zoom in", "Zoom out", "Layers"][i]}>
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{p}</svg>
          </button>
        ))}
      </div>

      {/* legend */}
      <div className="absolute bottom-4 left-3.5 z-[6] flex gap-3.5 rounded-lg border border-border bg-surface/90 px-2.5 py-2 text-[11.5px] text-muted shadow-sm backdrop-blur">
        {[["Moving", "bg-emerald-500"], ["Idle", "bg-amber-500"], ["Parked", "bg-slate-400"], ["Alert", "bg-red-500"]].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${c}`} />{l}</span>
        ))}
      </div>
    </section>
  );
}
