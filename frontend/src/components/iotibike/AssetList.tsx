"use client";

import {
  batteryColorClass,
  statusDotClass,
  statusPillClasses,
  type Asset,
} from "@/lib/iotibike";

export default function AssetList({
  assets,
  selectedId,
  onSelect,
}: {
  assets: Asset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="flex min-h-0 max-h-[42vh] flex-col border-r border-border bg-surface lg:h-full lg:max-h-none" aria-label="Assets">
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[15px] font-bold tracking-tight">Fleet</h1>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
            Demo · sample data
          </span>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-muted">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            placeholder="Search riders or bikes…"
            aria-label="Search assets"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-2.5" role="group" aria-label="Filter">
        {[
          ["All", assets.length],
          ["Moving", assets.filter((a) => a.status === "moving").length],
          ["Idle", assets.filter((a) => a.status === "idle" || a.status === "parked").length],
          ["Alerts", assets.filter((a) => a.status === "alert").length],
        ].map(([label, count], i) => (
          <button
            key={label}
            aria-pressed={i === 0}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              i === 0
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted hover:bg-background"
            }`}
          >
            {label} · {count}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2.5 pb-4">
        {assets.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={`grid w-full grid-cols-[34px_1fr_auto] items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
              a.id === selectedId
                ? "border-accent/30 bg-accent/10"
                : "border-transparent hover:bg-background"
            }`}
          >
            <span className="relative grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-slate-500/10 text-[12.5px] font-bold text-muted">
              {a.initials}
              <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[2.5px] border-surface ${statusDotClass(a.status)}`} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold">{a.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                {a.code}
                <i className="inline-block h-1 w-1 rounded-full bg-muted/60" />
                <span className="truncate">{a.area.split(" · ")[0]}</span>
              </span>
            </span>
            <span className="flex flex-col items-end gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${statusPillClasses(a.status)}`}>
                {a.status === "alert" ? "Alert" : a.statusLabel}
              </span>
              {a.saved !== "—" ? (
                <span className="font-mono text-[11px] font-semibold text-accent">+₦{a.saved}</span>
              ) : (
                <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted">
                  <span className="h-[5px] w-[26px] overflow-hidden rounded-full bg-border">
                    <span className={`block h-full rounded-full ${batteryColorClass(a.battery)}`} style={{ width: `${a.battery}%` }} />
                  </span>
                  {a.battery}%
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
