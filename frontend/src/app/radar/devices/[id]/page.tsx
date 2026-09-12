"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, usePro } from "@/lib/auth";
import { getDevice, radarSubscribeUrl, triggerAlarm, type Device } from "@/lib/devices";
import { createZone, deleteZone, listZones, TRIGGER_LABELS, type TriggerType, type Zone } from "@/lib/zones";
import RulesPanel from "@/components/radar/RulesPanel";
import EventsTimeline from "@/components/radar/EventsTimeline";
import AnalyticsPanel from "@/components/radar/AnalyticsPanel";
import { Siren } from "@/lib/siren";
import { AlarmIcon, SpeakerOnIcon, SpeakerOffIcon } from "@/components/radar/icons";

/*
 * Radar dashboard for a single device (Phase 4 + Phase 6b).
 *
 * Live telemetry renders on a top-down XY plot; zones drawn by the user overlay
 * the same coordinate space, and rules firing over the WebSocket surface as live
 * toasts + a zone flash. The hot render path (targets/zones/draft) reads refs
 * from a requestAnimationFrame loop; React state carries only low-frequency UI.
 */

interface Target {
  x: number;
  y: number;
  velocity?: number | null;
  strength?: number | null;
}

type ConnState = "connecting" | "open" | "reconnecting" | "closed";

interface Geometry {
  pad: number;
  originX: number;
  originY: number;
  scale: number;
}

interface DraftRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Toast {
  id: number;
  title: string;
  sub: string;
}

// Plot domain in metres: device sits at the origin, y forward, x lateral.
const Y_RANGE = 8;
const X_RANGE = 5;
const RANGE_RINGS = [2, 4, 6, 8];
const FLASH_MS = 1500;

function plotGeometry(cssW: number, cssH: number): Geometry {
  const pad = 24;
  return {
    pad,
    originX: cssW / 2,
    originY: cssH - pad,
    scale: Math.min((cssW / 2 - pad) / X_RANGE, (cssH - 2 * pad) / Y_RANGE),
  };
}

function toPx(g: Geometry, x: number, y: number) {
  return { px: g.originX + x * g.scale, py: g.originY - y * g.scale };
}

function toMetres(g: Geometry, px: number, py: number) {
  return { x: (px - g.originX) / g.scale, y: (g.originY - py) / g.scale };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

interface DrawInput {
  targets: Target[];
  zones: Zone[];
  draft: DraftRect | null;
  flashing: Map<number, number>;
}

function drawRadar(canvas: HTMLCanvasElement, input: DrawInput) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const accent = cssVar("--color-accent", "#5BA8A0");
  const muted = cssVar("--color-muted", "#6b7280");
  const g = plotGeometry(cssW, cssH);

  // Range rings (upper semicircle, centred on the device).
  ctx.strokeStyle = muted;
  ctx.fillStyle = muted;
  ctx.lineWidth = 1;
  ctx.font = "11px system-ui, sans-serif";
  for (const r of RANGE_RINGS) {
    if (r > Y_RANGE) continue;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(g.originX, g.originY, r * g.scale, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.fillText(`${r}m`, g.originX + 4, g.originY - r * g.scale + 12);
  }

  // Radial guide lines every 30° across the forward half.
  ctx.globalAlpha = 0.15;
  const maxR = Y_RANGE * g.scale;
  for (let deg = 0; deg <= 180; deg += 30) {
    const a = Math.PI + (deg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(g.originX, g.originY);
    ctx.lineTo(g.originX + Math.cos(a) * maxR, g.originY + Math.sin(a) * maxR);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Zones (under targets).
  const now = Date.now();
  for (const z of input.zones) {
    const pts = z.points;
    if (!pts || pts.length < 3) continue;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const { px, py } = toPx(g, p.x, p.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    const flash = input.flashing.get(z.id);
    const isFlashing = flash !== undefined && now < flash;
    ctx.fillStyle = accent;
    ctx.globalAlpha = isFlashing ? 0.35 : 0.12;
    ctx.fill();
    ctx.globalAlpha = isFlashing ? 1 : 0.5;
    ctx.lineWidth = isFlashing ? 2 : 1.5;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Label near the topmost vertex.
    const top = pts.reduce((a, b) => (b.y > a.y ? b : a), pts[0]);
    const { px, py } = toPx(g, top.x, top.y);
    ctx.fillStyle = accent;
    ctx.fillText(z.name, px + 4, py - 4);
  }

  // Draft rectangle being drawn.
  if (input.draft) {
    const a = toPx(g, input.draft.x0, input.draft.y0);
    const b = toPx(g, input.draft.x1, input.draft.y1);
    ctx.strokeStyle = accent;
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = 0.9;
    ctx.strokeRect(Math.min(a.px, b.px), Math.min(a.py, b.py), Math.abs(b.px - a.px), Math.abs(b.py - a.py));
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Device origin.
  ctx.fillStyle = muted;
  ctx.beginPath();
  ctx.arc(g.originX, g.originY, 4, 0, 2 * Math.PI);
  ctx.fill();

  // Targets (on top).
  for (const t of input.targets) {
    if (typeof t.x !== "number" || typeof t.y !== "number") continue;
    const { px, py } = toPx(g, t.x, t.y);
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
  const { isPro } = usePro();
  const router = useRouter();

  const [device, setDevice] = useState<Device | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [online, setOnline] = useState(false);
  const [count, setCount] = useState(0);
  const [seq, setSeq] = useState<number | null>(null);

  const [zones, setZones] = useState<Zone[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [pending, setPending] = useState<{ points: { x: number; y: number }[] } | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reloadSignal, setReloadSignal] = useState(0);
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmSource, setAlarmSource] = useState<string | null>(null);
  const [alarmBusy, setAlarmBusy] = useState(false);
  const [sirenMuted, setSirenMuted] = useState(false);
  const sirenRef = useRef<Siren | null>(null);

  const canControl = device?.role === "owner" || device?.role === "admin";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetsRef = useRef<Target[]>([]);
  const zonesRef = useRef<Zone[]>([]);
  const draftRef = useRef<DraftRect | null>(null);
  const flashRef = useRef<Map<number, number>>(new Map());
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const toastIdRef = useRef(0);

  const validId = Number.isInteger(deviceId) && deviceId > 0;

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  const loadZones = useCallback(() => {
    if (!validId) return;
    listZones(deviceId)
      .then((r) => setZones(r.items))
      .catch(() => {
        /* zones are non-critical; keep the live view usable */
      });
  }, [deviceId, validId]);

  // Redirect unauthenticated users to sign in.
  useEffect(() => {
    if (!isLoading && !token) router.push("/login");
  }, [isLoading, token, router]);

  // Load device metadata + zones.
  useEffect(() => {
    if (isLoading || !token || !validId) return;
    let active = true;
    getDevice(deviceId)
      .then((d) => active && setDevice(d))
      .catch((e) => active && setLoadError(e instanceof Error ? e.message : "Failed to load device"));
    loadZones();
    return () => {
      active = false;
    };
  }, [isLoading, token, deviceId, validId, loadZones]);

  // Render loop — decoupled from the message rate.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        drawRadar(canvas, {
          targets: targetsRef.current,
          zones: zonesRef.current,
          draft: draftRef.current,
          flashing: flashRef.current,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Siren: create once, unlock on first user gesture (autoplay policy), and
  // stop on unmount.
  useEffect(() => {
    const siren = new Siren();
    sirenRef.current = siren;
    const unlock = () => siren.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      siren.stop();
    };
  }, []);

  // Wail while the alarm is active and not muted.
  useEffect(() => {
    const siren = sirenRef.current;
    if (!siren) return;
    if (alarmActive && !sirenMuted) siren.start();
    else siren.stop();
  }, [alarmActive, sirenMuted]);

  const pushToast = useCallback((title: string, sub: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, title, sub }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
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
          if (!msg.online) {
            targetsRef.current = [];
            setCount(0);
          }
        } else if (msg.type === "telemetry") {
          const targets = Array.isArray(msg.targets) ? (msg.targets as Target[]) : [];
          targetsRef.current = targets;
          setCount(targets.length);
          setSeq(typeof msg.seq === "number" ? msg.seq : null);
        } else if (msg.type === "rule_fired") {
          const zoneId = typeof msg.zone_id === "number" ? msg.zone_id : -1;
          flashRef.current.set(zoneId, Date.now() + FLASH_MS);
          const trigger = String(msg.trigger_type) as TriggerType;
          pushToast(
            String(msg.rule_name ?? "Rule triggered"),
            `${TRIGGER_LABELS[trigger] ?? trigger} · ${new Date().toLocaleTimeString()}`,
          );
          // Refresh the events timeline.
          setReloadSignal((n) => n + 1);
        } else if (msg.type === "alarm") {
          setAlarmActive(msg.state === "on");
          setAlarmSource(typeof msg.source === "string" ? msg.source : null);
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setConn("reconnecting");
        const delay = Math.min(1000 * 2 ** attempts, 15000);
        attempts += 1;
        retryTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [isLoading, token, deviceId, validId, pushToast]);

  // --- Zone drawing ------------------------------------------------------- //
  const eventToMetres = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const g = plotGeometry(rect.width, rect.height);
    const m = toMetres(g, e.clientX - rect.left, e.clientY - rect.top);
    return { x: clamp(m.x, -X_RANGE, X_RANGE), y: clamp(m.y, 0, Y_RANGE) };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = eventToMetres(e);
    dragStartRef.current = m;
    draftRef.current = { x0: m.x, y0: m.y, x1: m.x, y1: m.y };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawMode || !dragStartRef.current) return;
    const m = eventToMetres(e);
    draftRef.current = { x0: dragStartRef.current.x, y0: dragStartRef.current.y, x1: m.x, y1: m.y };
  };

  const onPointerUp = () => {
    if (!drawMode || !dragStartRef.current) return;
    const d = draftRef.current;
    dragStartRef.current = null;
    draftRef.current = null;
    if (!d) return;
    const minX = Math.min(d.x0, d.x1);
    const maxX = Math.max(d.x0, d.x1);
    const minY = Math.min(d.y0, d.y1);
    const maxY = Math.max(d.y0, d.y1);
    // Ignore accidental tiny drags.
    if (maxX - minX < 0.3 || maxY - minY < 0.3) return;
    const round = (v: number) => Math.round(v * 100) / 100;
    setPending({
      points: [
        { x: round(minX), y: round(minY) },
        { x: round(maxX), y: round(minY) },
        { x: round(maxX), y: round(maxY) },
        { x: round(minX), y: round(maxY) },
      ],
    });
    setPendingName("");
    setDrawMode(false);
  };

  async function savePending(e: React.FormEvent) {
    e.preventDefault();
    if (!pending || !pendingName.trim()) return;
    setZoneError(null);
    try {
      const zone = await createZone(deviceId, pendingName.trim(), pending.points);
      setZones((prev) => [...prev, zone]);
      setPending(null);
      setPendingName("");
    } catch (err) {
      setZoneError(err instanceof Error ? err.message : "Failed to save zone");
    }
  }

  async function handleDeleteZone(zoneId: number) {
    setZoneError(null);
    try {
      await deleteZone(zoneId);
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      // A deleted zone cascades its rules — refresh the rules panel.
      setReloadSignal((n) => n + 1);
    } catch (err) {
      setZoneError(err instanceof Error ? err.message : "Failed to delete zone");
    }
  }

  async function handleAlarm(state: "on" | "off") {
    if (alarmBusy) return;
    setAlarmBusy(true);
    setZoneError(null);
    try {
      await triggerAlarm(deviceId, state);
      // The server broadcasts the new state back; optimistic update for snappiness.
      setAlarmActive(state === "on");
      setAlarmSource("manual");
    } catch (err) {
      setZoneError(err instanceof Error ? err.message : "Failed to send alarm command");
    } finally {
      setAlarmBusy(false);
    }
  }

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
        <div role="alert" className="rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {loadError}
        </div>
      )}

      {alarmActive && (
        <div
          role="alert"
          className="flex animate-pulse items-center justify-between gap-4 rounded-lg border border-red-500 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-300"
        >
          <span className="flex items-center gap-2">
            <AlarmIcon className="h-5 w-5 shrink-0" />
            Alarm active{alarmSource ? ` (${alarmSource})` : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSirenMuted((m) => !m)}
              className="rounded-lg border border-red-500 p-1.5 text-red-600 hover:bg-red-500/10 dark:text-red-300"
              aria-label={sirenMuted ? "Unmute siren" : "Mute siren"}
              title={sirenMuted ? "Unmute siren" : "Mute siren"}
            >
              {sirenMuted ? <SpeakerOffIcon className="h-4 w-4" /> : <SpeakerOnIcon className="h-4 w-4" />}
            </button>
            {canControl && (
              <button
                onClick={() => handleAlarm("off")}
                disabled={alarmBusy}
                className="rounded-lg border border-red-500 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
              >
                Silence
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Targets" value={String(count)} />
        <Stat label="Frame" value={seq !== null ? `#${seq}` : "—"} />
        <Stat label="Zones" value={String(zones.length)} />
        <Stat label="Range" value={`${Y_RANGE}m`} />
      </div>

      {/* Map + zone toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Live map</h2>
          <div className="flex items-center gap-2">
            {canControl && (
              <button
                onClick={() => handleAlarm(alarmActive ? "off" : "on")}
                disabled={alarmBusy || !online}
                title={online ? "" : "Device is offline"}
                className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ${
                  alarmActive
                    ? "border-red-500 text-red-600 hover:bg-red-500/10 dark:text-red-300"
                    : "border-border hover:bg-surface"
                }`}
              >
                {alarmActive ? "Silence alarm" : "Trigger alarm"}
              </button>
            )}
            {isPro ? (
              <button
                onClick={() => {
                  setDrawMode((d) => !d);
                  setPending(null);
                }}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  drawMode ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-surface"
                }`}
              >
                {drawMode ? "Drawing… (drag on map)" : "Draw zone"}
              </button>
            ) : (
              <span className="text-xs text-muted">Zones & rules are a Pro feature</span>
            )}
          </div>
        </div>

        {zoneError && <p className="text-sm text-red-600">{zoneError}</p>}

        <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
          <canvas
            ref={canvasRef}
            className={`block h-[460px] w-full ${drawMode ? "cursor-crosshair" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
          {conn === "open" && !online && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-lg bg-background/80 px-4 py-2 text-sm text-muted">
                Device offline — waiting for it to connect.
              </p>
            </div>
          )}

          {/* Live rule-fired toasts */}
          <div className="pointer-events-none absolute right-3 top-3 flex w-64 flex-col gap-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-accent bg-background/95 px-3 py-2 text-sm shadow-lg"
              >
                <div className="font-medium text-accent">{t.title}</div>
                <div className="text-xs text-muted">{t.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Name-and-save a freshly drawn zone */}
        {pending && (
          <form onSubmit={savePending} className="flex flex-wrap items-center gap-3 rounded-xl border border-accent bg-surface p-4">
            <span className="text-sm text-muted">Name this zone:</span>
            <input
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              placeholder="e.g. Doorway"
              maxLength={80}
              autoFocus
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!pendingName.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Save zone
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background"
            >
              Discard
            </button>
          </form>
        )}

        {/* Existing zones list with delete (Pro) */}
        {zones.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <li
                key={z.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-accent" />
                {z.name}
                {isPro && (
                  <button
                    onClick={() => handleDeleteZone(z.id)}
                    className="text-xs text-red-600 hover:underline"
                    aria-label={`Delete zone ${z.name}`}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted">
          Top-down view. The device sits at the base; rings mark distance in metres.
          {isPro && " Use “Draw zone”, then drag a box on the map to add a zone."}
        </p>
      </div>

      <RulesPanel deviceId={deviceId} zones={zones} reloadSignal={reloadSignal} />
      <EventsTimeline deviceId={deviceId} zones={zones} reloadSignal={reloadSignal} />
      <AnalyticsPanel deviceId={deviceId} reloadSignal={reloadSignal} />
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
