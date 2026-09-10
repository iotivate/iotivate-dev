import { authFetch } from "./auth";
import type { PaginatedResponse } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ZonePoint {
  x: number;
  y: number;
}

export interface Zone {
  id: number;
  device_id: number;
  name: string;
  points: ZonePoint[];
  created_at: string;
  updated_at: string;
}

export type TriggerType = "enter" | "exit" | "dwell" | "occupancy";

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  enter: "Enter",
  exit: "Exit",
  dwell: "Dwell",
  occupancy: "Occupancy",
};

export interface Rule {
  id: number;
  zone_id: number;
  device_id: number;
  name: string;
  trigger_type: TriggerType;
  dwell_seconds: number | null;
  occupancy_threshold: number | null;
  cooldown_seconds: number;
  action_dashboard: boolean;
  action_email: boolean;
  notify_email: string | null;
  action_alarm: boolean;
  alarm_duration_ms: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleCreate {
  zone_id: number;
  name: string;
  trigger_type: TriggerType;
  dwell_seconds?: number | null;
  occupancy_threshold?: number | null;
  cooldown_seconds?: number;
  action_dashboard?: boolean;
  action_email?: boolean;
  notify_email?: string | null;
  action_alarm?: boolean;
  alarm_duration_ms?: number | null;
  enabled?: boolean;
}

export interface RuleEvent {
  id: number;
  rule_id: number;
  device_id: number;
  zone_id: number;
  trigger_type: TriggerType;
  fired_at: string;
  detail: Record<string, unknown> | null;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // FastAPI validation errors arrive as {detail: [{msg,...}]}; surface a string.
    const detail = body.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && detail[0]?.msg
          ? detail[0].msg
          : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// --- Zones ---------------------------------------------------------------- //
export function listZones(deviceId: number): Promise<PaginatedResponse<Zone>> {
  return authFetch(`${API_URL}/api/devices/${deviceId}/zones`).then((r) =>
    asJson<PaginatedResponse<Zone>>(r),
  );
}

export function createZone(deviceId: number, name: string, points: ZonePoint[]): Promise<Zone> {
  return authFetch(`${API_URL}/api/devices/${deviceId}/zones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, points }),
  }).then((r) => asJson<Zone>(r));
}

export async function deleteZone(zoneId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/api/zones/${zoneId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed (${res.status})`);
  }
}

// --- Rules ---------------------------------------------------------------- //
export function listRules(deviceId: number): Promise<PaginatedResponse<Rule>> {
  return authFetch(`${API_URL}/api/devices/${deviceId}/rules`).then((r) =>
    asJson<PaginatedResponse<Rule>>(r),
  );
}

export function createRule(deviceId: number, body: RuleCreate): Promise<Rule> {
  return authFetch(`${API_URL}/api/devices/${deviceId}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => asJson<Rule>(r));
}

export function updateRule(ruleId: number, body: Partial<RuleCreate>): Promise<Rule> {
  return authFetch(`${API_URL}/api/rules/${ruleId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => asJson<Rule>(r));
}

export async function deleteRule(ruleId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/api/rules/${ruleId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed (${res.status})`);
  }
}

// --- Events --------------------------------------------------------------- //
export function listEvents(deviceId: number, limit = 50): Promise<PaginatedResponse<RuleEvent>> {
  return authFetch(`${API_URL}/api/devices/${deviceId}/events?limit=${limit}`).then((r) =>
    asJson<PaginatedResponse<RuleEvent>>(r),
  );
}
