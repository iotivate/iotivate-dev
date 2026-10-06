const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PrintColor {
  id: number;
  name: string;
  hex: string;
}
export interface PrintFilament {
  id: number;
  type: string;
  name: string;
  density_g_cm3: number;
  rate_per_gram: number;
  colors: PrintColor[];
}
export interface ShippingZone {
  id: number;
  name: string;
  flat_rate: number;
}
export interface PrintConfig {
  service_open: boolean;
  design_enabled: boolean;
  currency: string;
  setup_fee: number;
  min_order: number;
  wall_thickness_mm: number;
  infill_percent: number;
  max_x_mm: number;
  max_y_mm: number;
  max_z_mm: number;
  lead_time_text: string;
  estimate_disclaimer: string;
  filaments: PrintFilament[];
  shipping_zones: ShippingZone[];
}

export interface OrderCreate {
  source: "upload" | "design";
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  stl_url?: string | null;
  filament_id?: number | null;
  color_id?: number | null;
  quantity?: number;
  volume_cm3?: number | null;
  surface_cm2?: number | null;
  dim_x_mm?: number | null;
  dim_y_mm?: number | null;
  dim_z_mm?: number | null;
  design_brief?: string | null;
  shipping_zone_id?: number | null;
  shipping_address: string;
  notes?: string | null;
}

export interface OrderCreated {
  id: number;
  status: string;
  source: string;
  items_subtotal: number | null;
  shipping_cost: number | null;
  total_estimate: number | null;
  created_at: string;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && detail[0]?.msg
          ? detail[0].msg
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function getPrintConfig(): Promise<PrintConfig> {
  // no-store so admin changes (new colours, pricing) show on the next page load.
  return fetch(`${API_URL}/api/print/config`, { cache: "no-store" }).then((r) => asJson<PrintConfig>(r));
}

export function uploadStl(file: File): Promise<{ url: string; filename: string; size: number }> {
  const form = new FormData();
  form.append("file", file);
  return fetch(`${API_URL}/api/print/stl`, { method: "POST", body: form }).then((r) =>
    asJson<{ url: string; filename: string; size: number }>(r),
  );
}

export function createPrintOrder(payload: OrderCreate): Promise<OrderCreated> {
  return fetch(`${API_URL}/api/print/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => asJson<OrderCreated>(r));
}

/** Client-side estimate for live display. The server recomputes authoritatively
 *  on order submit, so this is for instant UX only. Mirrors print_quote.py
 *  (shell + infill): shell = surfaceArea × wallThickness (capped at volume),
 *  material = shell + infill% × interior. */
export function estimatePrice(args: {
  volumeCm3: number;
  surfaceCm2: number;
  filament: PrintFilament;
  quantity: number;
  config: PrintConfig;
  shippingCost: number;
}): { weightG: number; itemsSubtotal: number; shippingCost: number; total: number; minApplied: boolean } {
  const { volumeCm3, surfaceCm2, filament, quantity, config, shippingCost } = args;
  const qty = Math.max(1, quantity);
  const v = Math.max(0, volumeCm3);
  const wallCm = Math.max(0, config.wall_thickness_mm) / 10;
  const shell = Math.min(Math.max(0, surfaceCm2) * wallCm, v);
  const interior = Math.max(0, v - shell);
  const fill = Math.max(0, Math.min(1, config.infill_percent / 100));
  const weightG = (shell + fill * interior) * filament.density_g_cm3;
  const raw = weightG * filament.rate_per_gram * qty + config.setup_fee;
  const itemsSubtotal = Math.max(raw, config.min_order);
  return {
    weightG: Math.round(weightG * 10) / 10,
    itemsSubtotal: Math.round(itemsSubtotal * 100) / 100,
    shippingCost,
    total: Math.round((itemsSubtotal + shippingCost) * 100) / 100,
    minApplied: raw < config.min_order,
  };
}

export function formatNaira(n: number): string {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}
