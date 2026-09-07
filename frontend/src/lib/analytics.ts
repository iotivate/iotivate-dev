import { authFetch } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface EventSummary {
  window_hours: number;
  total_events: number;
  by_trigger: Record<string, number>;
  by_zone: { zone_id: number; name: string; count: number }[];
  daily: { date: string; count: number }[];
}

export interface OccupancyPoint {
  hour: string;
  avg: number;
  max: number;
}

export interface OccupancySeries {
  window_hours: number;
  zones: { zone_id: number; name: string; points: OccupancyPoint[] }[];
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function getEventSummary(deviceId: number, windowHours = 168): Promise<EventSummary> {
  return authFetch(
    `${API_URL}/api/devices/${deviceId}/analytics/summary?window_hours=${windowHours}`,
  ).then((r) => asJson<EventSummary>(r));
}

export function getOccupancy(deviceId: number, windowHours = 24): Promise<OccupancySeries> {
  return authFetch(
    `${API_URL}/api/devices/${deviceId}/analytics/occupancy?window_hours=${windowHours}`,
  ).then((r) => asJson<OccupancySeries>(r));
}
