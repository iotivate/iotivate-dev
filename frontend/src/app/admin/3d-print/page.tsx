"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, authFetch } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN = `${API_URL}/api/admin/print`;

const ORDER_STATUSES = ["new", "quoted", "paid", "printing", "shipped", "completed", "cancelled"];

const input = "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";
const lbl = "text-xs font-medium uppercase tracking-wide text-muted";
const btn = "rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50";
const btnGhost = "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background";

interface Color { id: number; name: string; hex: string; enabled: boolean }
interface Filament {
  id: number; type: string; name: string; density_g_cm3: number; rate_per_gram: number;
  enabled: boolean; sort_order: number; colors: Color[];
}
interface Zone { id: number; name: string; flat_rate: number; enabled: boolean; sort_order: number }
interface Settings {
  setup_fee: number; min_order: number; fill_factor: number;
  max_x_mm: number; max_y_mm: number; max_z_mm: number;
  currency: string; lead_time_text: string; service_open: boolean;
  design_enabled: boolean; estimate_disclaimer: string;
}
interface Order {
  id: number; created_at: string; status: string; source: string;
  customer_name: string; customer_email: string; customer_phone: string | null;
  stl_url: string | null; quantity: number; est_weight_g: number | null;
  total_estimate: number | null; design_brief: string | null;
  shipping_address: string | null; notes: string | null;
}

async function jget<T>(url: string): Promise<T> {
  const r = await authFetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function jsend(url: string, method: string, body?: unknown) {
  const r = await authFetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok && r.status !== 204) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.detail || `Request failed (${r.status})`);
  }
  return r.status === 204 ? null : r.json();
}

export default function AdminPrinting() {
  const { token } = useAuth();
  if (!token) return <p className="text-muted">Loading…</p>;
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-bold">3D Printing</h1>
      <SettingsSection />
      <FilamentsSection />
      <ZonesSection />
      <OrdersSection />
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SettingsSection() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { jget<Settings>(`${ADMIN}/settings`).then(setS).catch(() => setErr("Failed to load settings")); }, []);

  async function save() {
    if (!s) return;
    setMsg(null); setErr(null);
    try { await jsend(`${ADMIN}/settings`, "PUT", s); setMsg("Saved"); }
    catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
  }
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s!, [k]: Number(e.target.value) });

  return (
    <Section title="Pricing & settings" right={s && <button className={btn} onClick={save}>Save</button>}>
      {!s ? <p className="text-sm text-muted">Loading…</p> : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Fld label={`Rate is per gram, per filament (below)`} wide><span className="text-xs text-muted">Price = weight × rate/g × qty + setup, floored to minimum, + shipping.</span></Fld>
          <Fld label="Setup fee (₦)"><input className={input} type="number" value={s.setup_fee} onChange={num("setup_fee")} /></Fld>
          <Fld label="Minimum order (₦)"><input className={input} type="number" value={s.min_order} onChange={num("min_order")} /></Fld>
          <Fld label="Fill factor (0–1)"><input className={input} type="number" step="0.05" value={s.fill_factor} onChange={num("fill_factor")} /></Fld>
          <Fld label="Bed max X (mm)"><input className={input} type="number" value={s.max_x_mm} onChange={num("max_x_mm")} /></Fld>
          <Fld label="Bed max Y (mm)"><input className={input} type="number" value={s.max_y_mm} onChange={num("max_y_mm")} /></Fld>
          <Fld label="Bed max Z (mm)"><input className={input} type="number" value={s.max_z_mm} onChange={num("max_z_mm")} /></Fld>
          <Fld label="Lead time"><input className={input} value={s.lead_time_text} onChange={(e) => setS({ ...s, lead_time_text: e.target.value })} /></Fld>
          <Fld label="Currency"><input className={input} value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} /></Fld>
          <Fld label="Disclaimer" wide><input className={`${input} w-full`} value={s.estimate_disclaimer} onChange={(e) => setS({ ...s, estimate_disclaimer: e.target.value })} /></Fld>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.service_open} onChange={(e) => setS({ ...s, service_open: e.target.checked })} /> Service open (accepting orders)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.design_enabled} onChange={(e) => setS({ ...s, design_enabled: e.target.checked })} /> Offer design service</label>
        </div>
      )}
      {msg && <p className="mt-3 text-sm text-accent">{msg}</p>}
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </Section>
  );
}

function Fld({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-3" : ""}><span className={lbl}>{label}</span><div className="mt-1">{children}</div></div>;
}

function FilamentsSection() {
  const [items, setItems] = useState<Filament[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => { jget<Filament[]>(`${ADMIN}/filaments`).then(setItems).catch(() => setErr("Failed to load")); }, []);
  useEffect(() => { load(); }, [load]);

  async function addFilament(f: Omit<Filament, "id" | "colors">) {
    try { await jsend(`${ADMIN}/filaments`, "POST", f); setAdding(false); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Create failed"); }
  }

  return (
    <Section title="Filaments" right={<button className={btnGhost} onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "Add filament"}</button>}>
      {adding && <FilamentForm onSubmit={addFilament} />}
      <div className="flex flex-col gap-3">
        {items.map((f) => <FilamentRow key={f.id} filament={f} onChange={load} />)}
        {items.length === 0 && <p className="text-sm text-muted">No filaments yet.</p>}
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </Section>
  );
}

function FilamentForm({ onSubmit }: { onSubmit: (f: Omit<Filament, "id" | "colors">) => void }) {
  const [f, setF] = useState({ type: "PLA", name: "", density_g_cm3: 1.24, rate_per_gram: 50, enabled: true, sort_order: 0 });
  return (
    <div className="mb-4 grid gap-2 rounded-md border border-accent/30 bg-accent/5 p-3 sm:grid-cols-5">
      <input className={input} placeholder="Type (PLA)" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} />
      <input className={input} placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className={input} type="number" step="0.01" placeholder="Density" value={f.density_g_cm3} onChange={(e) => setF({ ...f, density_g_cm3: Number(e.target.value) })} />
      <input className={input} type="number" placeholder="Rate/g (₦)" value={f.rate_per_gram} onChange={(e) => setF({ ...f, rate_per_gram: Number(e.target.value) })} />
      <button className={btn} onClick={() => onSubmit(f)} disabled={!f.name}>Create</button>
    </div>
  );
}

function FilamentRow({ filament, onChange }: { filament: Filament; onChange: () => void }) {
  const [f, setF] = useState(filament);
  const [newColor, setNewColor] = useState({ name: "", hex: "#808080" });

  const save = async () => { await jsend(`${ADMIN}/filaments/${f.id}`, "PUT", { type: f.type, name: f.name, density_g_cm3: f.density_g_cm3, rate_per_gram: f.rate_per_gram, enabled: f.enabled, sort_order: f.sort_order }); onChange(); };
  const addColor = async () => { if (!newColor.name) return; await jsend(`${ADMIN}/filaments/${f.id}/colors`, "POST", { ...newColor, enabled: true }); setNewColor({ name: "", hex: "#808080" }); onChange(); };
  const delColor = async (id: number) => { try { await jsend(`${ADMIN}/colors/${id}`, "DELETE"); onChange(); } catch { await jsend(`${ADMIN}/colors/${id}`, "PUT", { ...f.colors.find((c) => c.id === id)!, enabled: false }); onChange(); } };

  return (
    <div className={`rounded-md border p-3 ${f.enabled ? "border-border" : "border-border bg-background/50 opacity-70"}`}>
      <div className="grid items-center gap-2 sm:grid-cols-6">
        <input className={input} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} />
        <input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={input} type="number" step="0.01" value={f.density_g_cm3} onChange={(e) => setF({ ...f, density_g_cm3: Number(e.target.value) })} title="density g/cm³" />
        <input className={input} type="number" value={f.rate_per_gram} onChange={(e) => setF({ ...f, rate_per_gram: Number(e.target.value) })} title="₦ per gram" />
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> enabled</label>
        <button className={btn} onClick={save}>Save</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {f.colors.map((c) => (
          <span key={c.id} className={`flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs ${c.enabled ? "" : "opacity-50"}`}>
            <span className="inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c.hex }} />
            {c.name}
            <button className="text-red-600 hover:underline" onClick={() => delColor(c.id)} aria-label={`remove ${c.name}`}>✕</button>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <input className={`${input} w-24`} placeholder="color" value={newColor.name} onChange={(e) => setNewColor({ ...newColor, name: e.target.value })} />
          <input type="color" value={newColor.hex} onChange={(e) => setNewColor({ ...newColor, hex: e.target.value })} className="h-8 w-8 rounded border border-border" />
          <button className={btnGhost} onClick={addColor}>+ color</button>
        </span>
      </div>
    </div>
  );
}

function ZonesSection() {
  const [items, setItems] = useState<Zone[]>([]);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => { jget<Zone[]>(`${ADMIN}/zones`).then(setItems).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Section title="Delivery zones" right={<button className={btnGhost} onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "Add zone"}</button>}>
      {adding && <ZoneForm onDone={() => { setAdding(false); load(); }} />}
      <div className="flex flex-col gap-2">
        {items.map((z) => <ZoneRow key={z.id} zone={z} onChange={load} />)}
        {items.length === 0 && <p className="text-sm text-muted">No zones yet.</p>}
      </div>
    </Section>
  );
}

function ZoneForm({ onDone }: { onDone: () => void }) {
  const [z, setZ] = useState({ name: "", flat_rate: 0, enabled: true, sort_order: 0 });
  return (
    <div className="mb-3 grid gap-2 rounded-md border border-accent/30 bg-accent/5 p-3 sm:grid-cols-3">
      <input className={input} placeholder="Zone name" value={z.name} onChange={(e) => setZ({ ...z, name: e.target.value })} />
      <input className={input} type="number" placeholder="Flat rate (₦)" value={z.flat_rate} onChange={(e) => setZ({ ...z, flat_rate: Number(e.target.value) })} />
      <button className={btn} disabled={!z.name} onClick={async () => { await jsend(`${ADMIN}/zones`, "POST", z); onDone(); }}>Create</button>
    </div>
  );
}

function ZoneRow({ zone, onChange }: { zone: Zone; onChange: () => void }) {
  const [z, setZ] = useState(zone);
  return (
    <div className="grid items-center gap-2 sm:grid-cols-4">
      <input className={input} value={z.name} onChange={(e) => setZ({ ...z, name: e.target.value })} />
      <input className={input} type="number" value={z.flat_rate} onChange={(e) => setZ({ ...z, flat_rate: Number(e.target.value) })} />
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={z.enabled} onChange={(e) => setZ({ ...z, enabled: e.target.checked })} /> enabled</label>
      <button className={btn} onClick={async () => { await jsend(`${ADMIN}/zones/${z.id}`, "PUT", { name: z.name, flat_rate: z.flat_rate, enabled: z.enabled, sort_order: z.sort_order }); onChange(); }}>Save</button>
    </div>
  );
}

function OrdersSection() {
  const [data, setData] = useState<{ items: Order[]; total: number }>({ items: [], total: 0 });
  const [skip, setSkip] = useState(0);
  const PAGE = 20;
  const load = useCallback(() => { jget<{ items: Order[]; total: number }>(`${ADMIN}/orders?skip=${skip}&limit=${PAGE}`).then(setData).catch(() => {}); }, [skip]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: number, s: string) { await jsend(`${ADMIN}/orders/${id}`, "PUT", { status: s }); load(); }

  return (
    <Section title={`Orders (${data.total})`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-3">#</th><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Details</th>
              <th className="py-2 pr-3">Est. total</th><th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((o) => (
              <tr key={o.id} className="border-b border-border align-top">
                <td className="py-2 pr-3 font-mono">{o.id}</td>
                <td className="py-2 pr-3 whitespace-nowrap text-muted">{new Date(o.created_at + "Z").toLocaleDateString()}</td>
                <td className="py-2 pr-3">{o.source}</td>
                <td className="py-2 pr-3">
                  <div>{o.customer_name}</div>
                  <div className="text-xs text-muted">{o.customer_email}{o.customer_phone ? ` · ${o.customer_phone}` : ""}</div>
                </td>
                <td className="py-2 pr-3 max-w-xs">
                  {o.source === "upload" ? (
                    <div className="text-xs">
                      {o.stl_url && <a href={o.stl_url} className="text-accent hover:underline" target="_blank" rel="noreferrer">STL ↗</a>}
                      {" "}qty {o.quantity}{o.est_weight_g ? ` · ~${o.est_weight_g}g` : ""}
                    </div>
                  ) : (
                    <div className="text-xs text-muted line-clamp-3">{o.design_brief}</div>
                  )}
                  {o.shipping_address && <div className="mt-0.5 text-xs text-muted">→ {o.shipping_address}</div>}
                </td>
                <td className="py-2 pr-3 font-mono">{o.total_estimate != null ? `₦${Math.round(o.total_estimate).toLocaleString()}` : "—"}</td>
                <td className="py-2 pr-3">
                  <select className={input} value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {data.total > PAGE && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button className={btnGhost} disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>← Prev</button>
          <span className="text-muted">{skip + 1}–{Math.min(skip + PAGE, data.total)} of {data.total}</span>
          <button className={btnGhost} disabled={skip + PAGE >= data.total} onClick={() => setSkip(skip + PAGE)}>Next →</button>
        </div>
      )}
    </Section>
  );
}
