"use client";

import {
  batteryColorClass,
  elecPercent,
  litresAvoided,
  statusPillClasses,
  type Asset,
} from "@/lib/iotibike";

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-[22px] font-bold tabular-nums tracking-tight">
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-muted">{unit}</span>}
      </div>
    </div>
  );
}

const control = {
  locate: <><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></>,
  alarm: <path d="M19.1 5.6a9 9 0 0 1 0 12.7M16.5 8.3a5.2 5.2 0 0 1 0 7.4M6.8 8.3l4.7-4.7a.75.75 0 0 1 1.3.5v15.8a.75.75 0 0 1-1.3.5l-4.7-4.7H4.5A1.9 1.9 0 0 1 2.6 14 9 9 0 0 1 2.3 12c0-.8.1-1.6.3-2.4A1.9 1.9 0 0 1 4.5 8.3z" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};

export default function AssetDetail({ asset: a }: { asset: Asset }) {
  const alert = a.status === "alert";
  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-border bg-surface lg:h-full" aria-label="Asset detail">
      {/* header */}
      <div className="border-b border-border px-[18px] pb-3.5 pt-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 font-bold text-accent">{a.initials}</div>
          <div className="min-w-0">
            <div className="truncate text-base font-bold tracking-tight">{a.name}</div>
            <div className="mt-0.5 text-[12.5px] text-muted">{a.code} · {a.area}</div>
          </div>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${statusPillClasses(a.status)}`}>
            {alert ? "Offline" : a.statusLabel}
          </span>
        </div>
        <div className={`mt-2.5 text-[12.5px] ${alert ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
          {alert ? "⚠ " : ""}{a.geo}
        </div>
      </div>

      {/* energy economics HERO */}
      {!alert && (
        <div className="mx-[18px] mt-3.5 overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-b from-surface to-accent/5 shadow-sm shadow-accent/10">
          <div className="flex items-center justify-between px-4 pb-0.5 pt-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Saved today · vs petrol</span>
            <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10.5px] font-semibold text-accent">
              ≈ {litresAvoided(a.petrolCost)} L avoided
            </span>
          </div>
          <div className="flex items-baseline gap-2.5 px-4 pt-0.5">
            <span className="font-mono text-[38px] font-extrabold leading-none tracking-tight text-accent">₦{a.saved}</span>
            <span className="text-xs font-medium text-muted">kept in the rider&apos;s pocket</span>
          </div>
          <div className="flex flex-col gap-2 px-4 pb-1 pt-3">
            <div className="grid grid-cols-[64px_1fr_auto] items-center gap-2.5 text-xs text-muted">
              <span>Electricity</span>
              <span className="h-2.5 overflow-hidden rounded-md bg-border">
                <span className="block h-full rounded-md bg-accent" style={{ width: `${elecPercent(a.elecCost, a.petrolCost)}%` }} />
              </span>
              <span className="font-mono font-semibold tabular-nums text-foreground">₦{a.elecCost}</span>
            </div>
            <div className="grid grid-cols-[64px_1fr_auto] items-center gap-2.5 text-xs text-muted">
              <span>Petrol equiv.</span>
              <span className="h-2.5 overflow-hidden rounded-md bg-border">
                <span className="block h-full w-full rounded-md bg-[#C2AE8E]" />
              </span>
              <span className="font-mono font-semibold tabular-nums text-foreground">₦{a.petrolCost}</span>
            </div>
          </div>
          <div className="mt-1.5 flex justify-between border-t border-dashed border-accent/20 px-4 py-2.5 text-xs text-muted">
            <span>Energy used <b className="font-mono text-foreground">{a.wh} Wh</b></span>
            <span>{a.distToday} km · {a.timeToday} min</span>
          </div>
        </div>
      )}

      {/* metrics */}
      <div className="grid grid-cols-2 gap-2.5 px-[18px] pb-1 pt-3.5">
        <Metric label="Speed" value={a.speed} unit={a.status === "moving" ? "km/h" : undefined} />
        <Metric label="Today" value={a.distToday} unit="km" />
        <div className="col-span-2 rounded-xl border border-border p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Battery</span>
            <span className={`font-mono font-bold ${a.battery <= 15 ? "text-red-500" : a.battery <= 40 ? "text-amber-500" : "text-emerald-500"}`}>{a.battery}%</span>
          </div>
          <span className="block h-2 overflow-hidden rounded-md bg-border">
            <span className={`block h-full rounded-md ${batteryColorClass(a.battery)}`} style={{ width: `${a.battery}%` }} />
          </span>
        </div>
      </div>

      {/* controls */}
      <div className="px-[18px] pb-2 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted/70">Controls</div>
      <div className="grid grid-cols-3 gap-2 px-[18px]">
        <button className="flex flex-col items-center gap-1.5 rounded-[10px] bg-accent px-1.5 py-2.5 text-[12.5px] font-semibold text-white hover:bg-accent-hover">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{control.locate}</svg>
          Locate
        </button>
        <button className="flex flex-col items-center gap-1.5 rounded-[10px] border border-border px-1.5 py-2.5 text-[12.5px] font-semibold hover:bg-background">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{control.alarm}</svg>
          Alarm
        </button>
        <button className="flex flex-col items-center gap-1.5 rounded-[10px] border border-red-500/20 px-1.5 py-2.5 text-[12.5px] font-semibold text-red-600 hover:bg-red-500/5 dark:text-red-400">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{control.lock}</svg>
          Immobilize
        </button>
      </div>

      {/* trips */}
      <div className="px-[18px] pb-2 pt-4 text-[11px] font-bold uppercase tracking-wide text-muted/70">Recent trips</div>
      <div className="flex flex-col px-[18px] pb-6">
        {a.trips.map((t, i) => (
          <div key={i} className="flex items-center justify-between border-b border-border py-2.5 text-[12.5px] last:border-b-0">
            <span className="text-muted">{t.when}</span>
            <span className="font-mono font-semibold tabular-nums">{t.dist}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
