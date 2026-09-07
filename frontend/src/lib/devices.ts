import { authFetch } from "./auth";
import type { PaginatedResponse } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Device {
  id: number;
  name: string;
  device_type: string;
  pairing_state: "unpaired" | "paired";
  firmware_version: string | null;
  last_seen_at: string | null;
  created_at: string;
  paired_at: string | null;
  role: "owner" | "admin" | "viewer" | null;
  // Live health, computed server-side per request (null/0 unless streaming).
  online: boolean;
  last_frame_at: string | null;
  frame_rate: number | null;
  target_count: number | null;
  subscriber_count: number;
}

export interface PairingInfo {
  device_id: number;
  pairing_code: string;
  expires_at: string;
  qr_payload: string;
}

export interface DeviceCreated {
  device: Device;
  pairing: PairingInfo;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function listDevices(): Promise<PaginatedResponse<Device>> {
  return authFetch(`${API_URL}/api/devices/`).then((r) => asJson<PaginatedResponse<Device>>(r));
}

export function getDevice(deviceId: number): Promise<Device> {
  return authFetch(`${API_URL}/api/devices/${deviceId}`).then((r) => asJson<Device>(r));
}

/** WebSocket URL for a device's live telemetry stream. Browsers can't set
 *  headers on a WebSocket, so the access token rides as a query param. */
export function radarSubscribeUrl(deviceId: number, accessToken: string): string {
  const wsBase = API_URL.replace(/^http/, "ws");
  return `${wsBase}/ws/radar/subscribe/${deviceId}?token=${encodeURIComponent(accessToken)}`;
}

export function triggerAlarm(
  deviceId: number,
  state: "on" | "off",
  durationMs?: number,
): Promise<{ delivered: boolean; state: string }> {
  return authFetch(`${API_URL}/api/devices/${deviceId}/alarm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(durationMs != null ? { state, duration_ms: durationMs } : { state }),
  }).then((r) => asJson<{ delivered: boolean; state: string }>(r));
}

export function createDevice(name: string): Promise<DeviceCreated> {
  return authFetch(`${API_URL}/api/devices/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).then((r) => asJson<DeviceCreated>(r));
}

export function regeneratePairingCode(deviceId: number): Promise<PairingInfo> {
  return authFetch(`${API_URL}/api/devices/${deviceId}/pairing-code`, {
    method: "POST",
  }).then((r) => asJson<PairingInfo>(r));
}

export async function deleteDevice(deviceId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/api/devices/${deviceId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Delete failed (${res.status})`);
  }
}
