/*
 * iotiBike fleet data layer.
 *
 * Screen 1 ships with SAMPLE data so the dashboard is real, professional, and
 * demoable before any device/backend exists. When the ingest lands, only
 * `listAssets` / `getFleetSummary` need to point at the real API
 * (GET https://device.iotivate.dev is device-side; the app reads from the user
 * API) — the components don't change.
 */

export type AssetStatus = "moving" | "idle" | "parked" | "alert";

export interface TripRow {
  when: string;
  dist: string;
}

export interface Asset {
  id: string;
  name: string;
  code: string;
  initials: string;
  status: AssetStatus;
  statusLabel: string;
  speed: string; // km/h, or "—"
  battery: number; // 0-100
  area: string;
  geo: string;
  distToday: string; // km
  timeToday: string; // min
  avgSpeed: string; // km/h
  wh: string; // energy used
  elecCost: string; // ₦, no symbol
  petrolCost: string; // ₦, no symbol
  saved: string; // ₦, no symbol, or "—"
  x: number; // % position on the placeholder map
  y: number;
  trips: TripRow[];
}

export interface FleetSummary {
  active: number;
  moving: number;
  alerts: number;
  savedToday: string; // ₦
  savedMonth: string; // ₦
  litresMonth: string; // L
  weekBars: number[]; // 0-100 heights, last = today
}

export const PETROL_PER_LITRE = 1250; // ₦/L (sample; make configurable later)

const n = (s: string) => parseInt(s.replace(/,/g, ""), 10) || 0;

/** Litres of petrol avoided, derived from the equivalent petrol cost. */
export function litresAvoided(petrolCost: string): string {
  return (n(petrolCost) / PETROL_PER_LITRE).toFixed(1);
}

/** Electricity cost as a % of the petrol cost — width of the "electricity" bar. */
export function elecPercent(elecCost: string, petrolCost: string): number {
  const p = n(petrolCost);
  if (!p) return 0;
  return Math.max(6, Math.round((n(elecCost) / p) * 100));
}

export function statusPillClasses(s: AssetStatus): string {
  switch (s) {
    case "moving":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "idle":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "alert":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-slate-500/10 text-slate-600 dark:text-slate-400";
  }
}

export function statusDotClass(s: AssetStatus): string {
  switch (s) {
    case "moving":
      return "bg-emerald-500";
    case "idle":
      return "bg-amber-500";
    case "alert":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
}

export function batteryColorClass(b: number): string {
  if (b <= 15) return "bg-red-500";
  if (b <= 40) return "bg-amber-500";
  return "bg-emerald-500";
}

// --------------------------------------------------------------------------- //
// SAMPLE DATA — replace with real API calls when devices are streaming.
// --------------------------------------------------------------------------- //
const SAMPLE_ASSETS: Asset[] = [
  {
    id: "a1", name: "Musa A.", code: "Bike-07", initials: "MA", status: "moving", statusLabel: "Moving",
    speed: "24", battery: 78, area: "Wuse II", geo: "Inside Abuja Delivery Zone",
    distToday: "23.7", timeToday: "48", avgSpeed: "29.6", wh: "612", elecCost: "153", petrolCost: "2,400", saved: "2,247",
    x: 36, y: 30,
    trips: [{ when: "Today · 09:12", dist: "6.4 km" }, { when: "Today · 08:03", dist: "9.1 km" }, { when: "Yesterday · 17:40", dist: "12.2 km" }],
  },
  {
    id: "a2", name: "Chidi O.", code: "Bike-11", initials: "CO", status: "moving", statusLabel: "Moving",
    speed: "31", battery: 64, area: "Garki", geo: "Inside Abuja Delivery Zone",
    distToday: "18.9", timeToday: "37", avgSpeed: "30.6", wh: "503", elecCost: "126", petrolCost: "1,980", saved: "1,854",
    x: 64, y: 44,
    trips: [{ when: "Today · 09:30", dist: "8.8 km" }, { when: "Today · 08:20", dist: "10.1 km" }],
  },
  {
    id: "a3", name: "Bike-14", code: "Bike-14", initials: "14", status: "parked", statusLabel: "Parked",
    speed: "0", battery: 42, area: "Maitama", geo: "Inside Abuja Delivery Zone",
    distToday: "11.2", timeToday: "26", avgSpeed: "25.8", wh: "291", elecCost: "73", petrolCost: "1,150", saved: "1,077",
    x: 60, y: 17,
    trips: [{ when: "Today · 07:55", dist: "11.2 km" }],
  },
  {
    id: "a4", name: "Amina Y.", code: "Bike-03", initials: "AY", status: "idle", statusLabel: "Idle",
    speed: "0", battery: 91, area: "Asokoro", geo: "Inside Abuja Delivery Zone",
    distToday: "4.6", timeToday: "12", avgSpeed: "22.4", wh: "120", elecCost: "30", petrolCost: "470", saved: "440",
    x: 86, y: 56,
    trips: [{ when: "Today · 09:40", dist: "4.6 km" }],
  },
  {
    id: "a5", name: "Bike-22", code: "Bike-22", initials: "22", status: "alert", statusLabel: "Offline",
    speed: "—", battery: 12, area: "Karu · last seen 2h ago", geo: "Left Abuja Delivery Zone",
    distToday: "—", timeToday: "—", avgSpeed: "—", wh: "—", elecCost: "—", petrolCost: "—", saved: "—",
    x: 20, y: 78,
    trips: [{ when: "Today · 06:10", dist: "—" }],
  },
];

const SAMPLE_FLEET_SUMMARY: FleetSummary = {
  active: 5, moving: 2, alerts: 1,
  savedToday: "2,240", savedMonth: "58,400", litresMonth: "48",
  weekBars: [38, 54, 47, 72, 60, 86, 100],
};

/** TODO: swap to `authFetch(`${API_URL}/api/bike/assets`)` once ingest is live. */
export async function listAssets(): Promise<Asset[]> {
  return SAMPLE_ASSETS;
}

export async function getFleetSummary(): Promise<FleetSummary> {
  return SAMPLE_FLEET_SUMMARY;
}

export const IS_SAMPLE_DATA = true;
