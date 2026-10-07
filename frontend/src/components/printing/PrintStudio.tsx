"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StlPreview, { type StlMetrics } from "./StlPreview";
import { pixelTrack, pixelTrackCustom } from "@/lib/metapixel";
import {
  createPrintOrder,
  estimatePrice,
  formatNaira,
  getPrintConfig,
  uploadStl,
  type PrintConfig,
  type PrintFilament,
} from "@/lib/printing";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type Tab = "upload" | "design";

export default function PrintStudio({ geoAllowed }: { geoAllowed: boolean }) {
  const [config, setConfig] = useState<PrintConfig | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    getPrintConfig().then(setConfig).catch((e) => setLoadErr(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (!geoAllowed) return <RegionNotice />;
  if (loadErr) return <Panel><p className="text-sm text-red-600">Couldn&apos;t load the print service: {loadErr}</p></Panel>;
  if (!config) return <Panel><p className="text-sm text-muted">Loading the print studio…</p></Panel>;
  if (!config.service_open)
    return (
      <Panel>
        <h3 className="text-lg font-semibold">We&apos;re at capacity right now</h3>
        <p className="mt-1 text-sm text-muted">
          We&apos;ve paused new orders to clear the queue — please check back soon. Thanks for your patience.
        </p>
      </Panel>
    );

  return <Studio config={config} />;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-surface p-6">{children}</div>;
}

function RegionNotice() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/contact/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: email.split("@")[0] || "waitlist",
          email,
          message: "3D printing expansion waitlist (outside Nigeria)",
        }),
      });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel>
      <h3 className="text-lg font-semibold">Not available in your region yet</h3>
      <p className="mt-1 text-sm text-muted">
        Our 3D-printing service currently ships within Nigeria only — we&apos;re working on expanding. Leave
        your email and we&apos;ll tell you when it reaches you.
      </p>
      {done ? (
        <p className="mt-4 text-sm text-accent">Thanks — we&apos;ll be in touch when we expand.</p>
      ) : (
        <form onSubmit={join} className="mt-4 flex max-w-md flex-col gap-2 sm:flex-row">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button disabled={busy} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
            Notify me
          </button>
        </form>
      )}
    </Panel>
  );
}

const field = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent";
const label = "text-xs font-medium uppercase tracking-wide text-muted";

// The preview/quote currently supports STL only. iOS Safari grays out files
// when the picker is filtered by extension alone (it doesn't know .stl), so keep
// a broad accept and enforce the real check in JS after a file is chosen.
const ACCEPTED_MODEL_EXT = [".stl"];
const FILE_ACCEPT = ".stl,model/stl,application/sla,application/octet-stream";

function Studio({ config }: { config: PrintConfig }) {
  const [tab, setTab] = useState<Tab>("upload");
  // Nudge the "I need it designed" path for visitors with no 3D file. Settles
  // after a few seconds or as soon as they pick a tab, so it never nags.
  const [hintDesign, setHintDesign] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHintDesign(false), 8000);
    return () => clearTimeout(t);
  }, []);
  function pickTab(t: Tab) {
    setHintDesign(false);
    setTab(t);
  }

  // shared
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zoneId, setZoneId] = useState<number | "">(config.shipping_zones[0]?.id ?? "");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: number; total: number | null; source: string } | null>(null);

  // upload
  const [file, setFile] = useState<File | null>(null);
  const [metrics, setMetrics] = useState<StlMetrics | null>(null);
  const [filamentId, setFilamentId] = useState<number>(config.filaments[0]?.id ?? 0);
  const [colorId, setColorId] = useState<number>(0);
  const [qty, setQty] = useState(1);
  const [previewColor, setPreviewColor] = useState<string>("#00ae42"); // Bambu-green default
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  // CSS-based expand (not the Fullscreen API, which iOS Safari doesn't support on
  // non-video elements — that's why the button did nothing on mobile).
  const [expanded, setExpanded] = useState(false);
  const previewWrapRef = useRef<HTMLDivElement>(null);

  function toggleFullscreen() {
    setExpanded((v) => !v);
  }
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  // design
  const [brief, setBrief] = useState("");

  const filament = useMemo<PrintFilament | undefined>(
    () => config.filaments.find((f) => f.id === filamentId),
    [config.filaments, filamentId],
  );
  const zone = config.shipping_zones.find((z) => z.id === zoneId);
  const shippingCost = zone?.flat_rate ?? 0;

  const oversized = useMemo(() => {
    if (!metrics) return false;
    const model = [metrics.x, metrics.y, metrics.z].sort((a, b) => a - b);
    const bed = [config.max_x_mm, config.max_y_mm, config.max_z_mm].sort((a, b) => a - b);
    return model.some((m, i) => m > bed[i]);
  }, [metrics, config]);

  const estimate = useMemo(() => {
    if (!metrics || !filament) return null;
    return estimatePrice({ volumeCm3: metrics.volumeCm3, surfaceCm2: metrics.surfaceCm2, filament, quantity: qty, config, shippingCost });
  }, [metrics, filament, qty, config, shippingCost]);

  // Fire a Meta "Quote" signal once per loaded model (not on every qty tweak),
  // so ads can build audiences from people who got far enough to see a price.
  const quotedFileRef = useRef<File | null>(null);
  useEffect(() => {
    if (file && estimate && filament && quotedFileRef.current !== file) {
      quotedFileRef.current = file;
      pixelTrackCustom("Quote", { value: estimate.total, currency: config.currency, content_name: filament.type });
    }
  }, [file, estimate, filament, config.currency]);

  function onPickFile(f: File | null) {
    setPreviewErr(null);
    if (f && !ACCEPTED_MODEL_EXT.some((ext) => f.name.toLowerCase().endsWith(ext))) {
      setFile(null);
      setMetrics(null);
      setCreated(null);
      setSubmitErr("That file type isn't supported yet — please upload an STL file.");
      return;
    }
    setFile(f);
    setMetrics(null);
    setCreated(null);
    setSubmitErr(null);
  }
  function onPickFilament(id: number) {
    setFilamentId(id);
    setColorId(0); // let them choose a colour for the new material
  }
  function onPickColor(id: number, hex: string) {
    setColorId(id);
    setPreviewColor(hex);
  }

  async function submit() {
    setSubmitErr(null);
    if (!name.trim() || !email.trim() || !phone.trim() || !address.trim()) {
      setSubmitErr("Please fill in your name, email, phone and delivery address.");
      return;
    }
    setSubmitting(true);
    try {
      if (tab === "upload") {
        if (!file || !metrics || !filament) {
          setSubmitErr("Upload a model first.");
          return;
        }
        const up = await uploadStl(file);
        const order = await createPrintOrder({
          source: "upload",
          customer_name: name, customer_email: email, customer_phone: phone,
          stl_url: up.url, filament_id: filament.id, color_id: colorId || null, quantity: qty,
          volume_cm3: metrics.volumeCm3, surface_cm2: metrics.surfaceCm2,
          dim_x_mm: metrics.x, dim_y_mm: metrics.y, dim_z_mm: metrics.z,
          shipping_zone_id: zoneId === "" ? null : zoneId, shipping_address: address, notes: notes || null,
        });
        pixelTrack("Lead", { value: order.total_estimate ?? 0, currency: config.currency, content_name: filament.type });
        setCreated({ id: order.id, total: order.total_estimate, source: "upload" });
      } else {
        if (!brief.trim()) {
          setSubmitErr("Tell us what you'd like designed.");
          return;
        }
        const order = await createPrintOrder({
          source: "design",
          customer_name: name, customer_email: email, customer_phone: phone,
          design_brief: brief,
          shipping_zone_id: zoneId === "" ? null : zoneId, shipping_address: address, notes: notes || null,
        });
        pixelTrack("Lead", { currency: config.currency, content_name: "design" });
        setCreated({ id: order.id, total: null, source: "design" });
      }
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Panel>
        <h3 className="text-lg font-semibold text-accent">Request received — #{created.id}</h3>
        {created.source === "upload" ? (
          <p className="mt-1 text-sm text-muted">
            {created.total != null && <>Estimated total <b className="text-foreground">{formatNaira(created.total)}</b>. </>}
            We&apos;ll review your model, confirm the final price and turnaround, and send you a payment link.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Thanks! We&apos;ll review your design brief and get back to you with a quote.
          </p>
        )}
        <p className="mt-3 text-xs text-muted">{config.estimate_disclaimer}</p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <TabBtn active={tab === "upload"} onClick={() => pickTab("upload")}>I have a 3D file</TabBtn>
        {config.design_enabled && (
          <TabBtn active={tab === "design"} onClick={() => pickTab("design")} pulse={tab !== "design"}>
            I need it designed
            {hintDesign && tab !== "design" && (
              <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                No 3D file?
              </span>
            )}
          </TabBtn>
        )}
      </div>

      {tab === "upload" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* left: upload + preview */}
          <div className="flex min-w-0 flex-col gap-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-surface px-6 py-8 text-center hover:border-accent">
              <span className="text-sm font-medium">{file ? file.name : "Upload your model"}</span>
              <span className="text-xs text-muted">STL file · max 50 MB</span>
              <input type="file" accept={FILE_ACCEPT} className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
            </label>
            {file && (
              <div ref={previewWrapRef}
                className={expanded
                  ? "fixed inset-0 z-[60] bg-background"
                  : "relative h-64 min-w-0 overflow-hidden rounded-2xl border border-border bg-surface"}>
                <StlPreview file={file} onMetrics={setMetrics} onError={() => { setMetrics(null); setPreviewErr("We couldn't read that model. Please make sure it's a valid STL file."); }} colorHex={previewColor} bedX={config.max_x_mm} bedY={config.max_y_mm} />
                <div className="absolute right-2 top-2 flex items-center gap-1.5">
                  <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-background/90 shadow-sm" title="Preview colour">
                    <input type="color" value={previewColor} onChange={(e) => setPreviewColor(e.target.value)}
                      className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" aria-label="Preview colour" />
                  </label>
                  <button type="button" onClick={toggleFullscreen} title={expanded ? "Exit fullscreen" : "Fullscreen preview"}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/90 shadow-sm hover:bg-background">
                    {expanded ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
            {previewErr && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{previewErr}</p>
            )}
            {metrics && (
              <div className="rounded-xl border border-border bg-surface p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted">Size</span>
                  <span className="font-mono tabular-nums">{metrics.x.toFixed(0)}×{metrics.y.toFixed(0)}×{metrics.z.toFixed(0)} mm</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted">Volume</span>
                  <span className="font-mono tabular-nums">{metrics.volumeCm3.toFixed(1)} cm³</span></div>
                {oversized && (
                  <p className="mt-2 rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-600 dark:text-red-400">
                    This model is larger than our print bed ({config.max_x_mm}×{config.max_y_mm}×{config.max_z_mm} mm).
                    It may need to be split or scaled — we&apos;ll advise.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* right: options + estimate */}
          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <span className={label}>Material</span>
              <select value={filamentId} onChange={(e) => onPickFilament(Number(e.target.value))} className={`mt-1 ${field}`}>
                {config.filaments.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
                ))}
              </select>
            </div>
            {filament && filament.colors.length > 0 && (
              <div>
                <span className={label}>Color</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {filament.colors.map((c) => (
                    <button key={c.id} type="button" onClick={() => onPickColor(c.id, c.hex)} title={c.name}
                      className={`h-8 w-8 rounded-full border-2 ${colorId === c.id ? "border-accent" : "border-border"}`}
                      style={{ backgroundColor: c.hex }} aria-label={c.name} />
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className={label}>Quantity</span>
              <input type="number" min={1} max={100} value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className={`mt-1 ${field}`} />
            </div>

            {estimate ? (
              <div className="rounded-xl border border-accent/25 bg-accent/5 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="flex items-center gap-2">
                    <span className={label}>Estimated total</span>
                    <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">estimate</span>
                  </span>
                  <span className="font-mono text-2xl font-bold text-accent">{formatNaira(estimate.total)}</span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  <div className="flex justify-between"><span>~{estimate.weightG} g {filament?.type}{qty > 1 ? ` × ${qty}` : ""} + setup</span><span className="font-mono">{formatNaira(estimate.itemsSubtotal)}</span></div>
                  <div className="flex justify-between"><span>Delivery{zone ? ` · ${zone.name}` : ""}</span><span className="font-mono">{formatNaira(estimate.shippingCost)}</span></div>
                  {estimate.minApplied && <div className="text-[11px]">Minimum order applied.</div>}
                </div>
                <p className="mt-3 rounded-lg bg-background px-2.5 py-2 text-xs leading-relaxed text-muted">
                  <b className="text-foreground">This is an estimate.</b> {config.estimate_disclaimer} You only pay after we confirm the final price.
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
                Upload a model to see an instant estimate.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-2xl">
          <span className={label}>Describe what you need designed</span>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={5}
            placeholder="e.g. A wall bracket for a 70mm pipe, must hold ~5kg. Rough sketch attached by email."
            className={`mt-1 ${field}`} />
          <p className="mt-1 text-xs text-muted">
            Include dimensions and use-case. We&apos;ll review and send a design + print quote. You can email reference
            photos after we reach out.
          </p>
        </div>
      )}

      {/* delivery + contact (shared) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><span className={label}>Full name</span><input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${field}`} /></div>
        <div><span className={label}>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${field}`} /></div>
        <div><span className={label}>Phone</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`mt-1 ${field}`} /></div>
        <div>
          <span className={label}>Delivery zone</span>
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value === "" ? "" : Number(e.target.value))} className={`mt-1 ${field}`}>
            {config.shipping_zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name} — {formatNaira(z.flat_rate)}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <span className={label}>Delivery address</span>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={`mt-1 ${field}`} />
        </div>
        <div className="sm:col-span-2">
          <span className={label}>Notes (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Anything we should know — deadline, finish, infill preference…" className={`mt-1 ${field}`} />
        </div>
      </div>

      {submitErr && <p className="text-sm text-red-600">{submitErr}</p>}

      <button onClick={submit} disabled={submitting}
        className="self-start rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
        {submitting ? "Submitting…" : tab === "upload" ? "Request this print" : "Request a design quote"}
      </button>
      <p className="text-xs text-muted">Delivery within Nigeria · turnaround depends on size &amp; quantity, confirmed with your quote · pay after we confirm.</p>
    </div>
  );
}

function TabBtn({ active, onClick, pulse, children }: { active: boolean; onClick: () => void; pulse?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-accent bg-accent/10 text-accent"
          : pulse
            ? "design-tab-pulse border-accent/50 text-accent hover:bg-accent/5"
            : "border-border text-muted hover:bg-surface"
      }`}>
      {children}
    </button>
  );
}
