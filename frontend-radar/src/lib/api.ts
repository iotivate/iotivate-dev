import { authFetch } from "./auth";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function listDevices(): Promise<Paginated<Device>> {
  return authFetch(`${API_URL}/api/devices/`).then((r) => asJson<Paginated<Device>>(r));
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
