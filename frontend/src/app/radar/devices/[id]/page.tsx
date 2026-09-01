"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getDevice, radarSubscribeUrl, type Device } from "@/lib/devices";

/*
 * Phase 4: live radar dashboard for a single device.
 *
 * Subscribes to the device's telemetry WebSocket and renders tracked targets on
 * a top-down (XY) radar plot. Telemetry frames arrive faster than React should
 * re-render, so the hot path (latest targets) lives in a ref drawn by a
 * requestAnimationFrame loop; only low-frequency metadata (connection state,
 * device online/offline, target count) drives React state.
 */

interface Target {
  x: number;
  y: number;
  velocity?: number | null;
  strength?: number | null;
}

type ConnState = "connecting" | "open" | "reconnecting" | "closed";

// Plot domain in metres: device sits at the origin, y forward, x lateral.
const Y_RANGE = 8;
const X_RANGE = 5;
const RANGE_RINGS = [2, 4, 6, 8];

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function drawRadar(canvas: HTMLCanvasElement, targets: Target[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  // Keep the backing store sized to the element * dpr for crisp lines.
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const accent = cssVar("--color-accent", "#5BA8A0");
  const muted = cssVar("--color-muted", "#6b7280");

  const pad = 24;
  const originX = cssW / 2;
  const originY = cssH - pad;
  // Uniform scale so the plot stays proportional in either dimension.
  const scale = Math.min((cssW / 2 - pad) / X_RANGE, (cssH - 2 * pad) / Y_RANGE);

  // Range rings (upper semicircle, centred on the device).
  ctx.strokeStyle = muted;
  ctx.fillStyle = muted;
  ctx.lineWidth = 1;
  ctx.font = "11px system-ui, sans-serif";
  for (const r of RANGE_RINGS) {
    if (r > Y_RANGE) continue;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(originX, originY, r * scale, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.fillText(`${r}m`, originX + 4, originY - r * scale + 12);
  }

  // Radial guide lines every 30° across the forward half.
  ctx.globalAlpha = 0.15;
  const maxR = Y_RANGE * scale;
  for (let deg = 0; deg <= 180; deg += 30) {
    const a = Math.PI + (deg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + Math.cos(a) * maxR, originY + Math.sin(a) * maxR);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // The device itself.
  ctx.fillStyle = muted;
  ctx.beginPath();
  ctx.arc(originX, originY, 4, 0, 2 * Math.PI);
  ctx.fill();

  // Targets.
  for (const t of targets) {
    if (typeof t.x !== "number" || typeof t.y !== "number") continue;
    const px = originX + t.x * scale;
    const py = originY - t.y * scale;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

export default function RadarDashboardPage() {
  const params = useParams<{ id: string }>();
  const deviceId = Number(params.id);
  const { token, isLoading } = useAuth();
  const router = useRouter();

  const [device, setDevice] = useState<Device | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [online, setOnline] = useState(false);
  const [count, setCount] = useState(0);
  const [seq, setSeq] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetsRef = useRef<Target[]>([]);

  const validId = Number.isInteger(deviceId) && deviceId > 0;

  // Redirect unauthenticated users to sign in.
  useEffect(() => {
    if (!isLoading && !token) router.push("/login");
  }, [isLoading, token, router]);

  // Load device metadata for the header.
  useEffect(() => {
    if (isLoading || !token || !validId) return;
    let active = true;
    getDevice(deviceId)
      .then((d) => active && setDevice(d))
      .catch((e) => active && setLoadError(e instanceof Error ? e.message : "Failed to load device"));
    return () => {
      active = false;
    };
  }, [isLoading, token, deviceId, validId]);

  // Render loop — decoupled from the message rate.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      if (canvas) drawRadar(canvas, targetsRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Telemetry WebSocket with automatic reconnect.
  useEffect(() => {
    if (isLoading || !token || !validId) return;

    let active = true;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const connect = () => {
      if (!active) return;
      setConn(attempts === 0 ? "connecting" : "reconnecting");
      ws = new WebSocket(radarSubscribeUrl(deviceId, token));

      ws.onopen = () => {
        if (!active) return;
        attempts = 0;
        setConn("open");
      };

      ws.onmessage = (ev) => {
        if (!active) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "status") {
          setOnline(Boolean(msg.online));
          // A device going offline should clear the field rather than freeze
          // the last positions on screen.
          if (!msg.online) {
            targetsRef.current = [];
            setCount(0);
          }
        } else if (msg.type === "telemetry") {
          const targets = Array.isArray(msg.targets) ? (msg.targets as Target[]) : [];
          targetsRef.current = targets;
          setCount(targets.length);
          setSeq(typeof msg.seq === "number" ? msg.seq : null);
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setConn("reconnecting");
        // Exponential backoff, capped, so a downed backend isn't hammered.
        const delay = Math.min(1000 * 2 ** attempts, 15000);
        attempts += 1;
        retryTimer = setTimeout(connect, delay);
      };

      // onerror is followed by onclose; let onclose drive the retry.
      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) {
        ws.onclose = null; // prevent the teardown close from scheduling a retry
        ws.close();
      }
    };
  }, [isLoading, token, deviceId, validId]);

  const statusLabel = useMemo(() => {
    if (conn === "open") return online ? "Live" : "Waiting for device";
    if (conn === "connecting") return "Connecting…";
    if (conn === "reconnecting") return "Reconnecting…";
    return "Disconnected";
  }, [conn, online]);

  const statusColor =
    conn === "open" && online
      ? "bg-emerald-500"
      : conn === "open"
        ? "bg-amber-500"
        : conn === "closed"
          ? "bg-red-500"
          : "bg-amber-500";

  if (isLoading || !token) {
    return <div className="mx-auto max-w-4xl px-6 py-16 text-muted">Loading…</div>;
  }

  if (!validId) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-muted">Invalid device.</p>
        <Link href="/radar/devices" className="mt-4 inline-block text-accent hover:underline">
          ← Back to devices
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-16">
      <div>
        <Link href="/radar/devices" className="text-sm text-accent hover:underline">
          ← Devices
        </Link>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{device?.name ?? `Device ${deviceId}`}</h1>
          <p className="mt-1 text-sm text-muted">
            {device ? `${device.device_type} · live tracking` : "Live tracking"}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <span className={`inline-flex h-2.5 w-2.5 rounded-full ${statusColor}`} />
          <span className="text-sm font-medium">{statusLabel}</span>
        </div>
      </header>

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Targets" value={String(count)} />
        <Stat label="Frame" value={seq !== null ? `#${seq}` : "—"} />
        <Stat label="Device" value={online ? "Online" : "Offline"} />
        <Stat label="Range" value={`${Y_RANGE}m`} />
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
        <canvas ref={canvasRef} className="block h-[460px] w-full" />
        {conn === "open" && !online && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-lg bg-background/80 px-4 py-2 text-sm text-muted">
              Device offline — waiting for it to connect.
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        Top-down view. The device sits at the base; rings mark distance in metres.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
