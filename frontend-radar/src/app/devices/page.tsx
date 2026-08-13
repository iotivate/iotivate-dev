"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAuth, LOGIN_REDIRECT_URL } from "@/lib/auth";
import {
  createDevice,
  deleteDevice,
  listDevices,
  regeneratePairingCode,
  type Device,
  type PairingInfo,
} from "@/lib/api";

function QrImage({ payload }: { payload: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, { margin: 2, width: 200 })
      .then((url) => active && setDataUrl(url))
      .catch(() => active && setDataUrl(null));
    return () => {
      active = false;
    };
  }, [payload]);
  if (!dataUrl) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="Device pairing QR code" width={200} height={200} className="rounded-lg" />;
}

function PairingPanel({ pairing, onDone }: { pairing: PairingInfo; onDone: () => void }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-accent)] bg-[color:var(--color-surface)] p-6">
      <h3 className="font-semibold">Pair your device</h3>
      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
        Enter this code on the device, or scan the QR during provisioning. It expires at{" "}
        {new Date(pairing.expires_at).toLocaleTimeString()}.
      </p>
      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <QrImage payload={pairing.qr_payload} />
        <div>
          <div className="font-mono text-3xl tracking-[0.3em]">{pairing.pairing_code}</div>
          <button
            onClick={onDone}
            className="mt-4 rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--color-background)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const { user, isLoading } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pairing, setPairing] = useState<PairingInfo | null>(null);

  // Used by the event handlers (setState in a handler is fine). The mount
  // effect below inlines the same fetch with an unmount guard instead of
  // calling this, so no state update lands after the component unmounts.
  const load = useCallback(async () => {
    try {
      const data = await listDevices();
      setDevices(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      window.location.href = LOGIN_REDIRECT_URL;
      return;
    }
    let active = true;
    (async () => {
      try {
        const data = await listDevices();
        if (!active) return;
        setDevices(data.items);
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load devices");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoading, user]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createDevice(name.trim());
      setName("");
      setPairing(created.pairing);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add device");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate(id: number) {
    setError(null);
    try {
      setPairing(await regeneratePairingCode(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate code");
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await deleteDevice(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete device");
    }
  }

  if (isLoading || (!user && loading)) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-[color:var(--color-muted)]">Loading…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold">Devices</h1>
        <p className="mt-1 text-[color:var(--color-muted)]">
          Register a radar device and pair it to your IoTivate account.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {pairing && <PairingPanel pairing={pairing} onDone={() => setPairing(null)} />}

      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Device name (e.g. Living Room)"
          maxLength={80}
          className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-4 py-2"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-lg bg-[color:var(--color-accent)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
        >
          Add device
        </button>
      </form>

      <section className="flex flex-col gap-3">
        {loading ? (
          <p className="text-[color:var(--color-muted)]">Loading devices…</p>
        ) : devices.length === 0 ? (
          <p className="text-[color:var(--color-muted)]">No devices yet. Add one above to get started.</p>
        ) : (
          devices.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.name}</span>
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${d.pairing_state === "paired" ? "bg-emerald-500" : "bg-amber-500"}`}
                    title={d.pairing_state}
                  />
                  <span className="text-xs text-[color:var(--color-muted)]">{d.pairing_state}</span>
                </div>
                <div className="text-xs text-[color:var(--color-muted)]">
                  {d.device_type} · your role: {d.role ?? "—"}
                </div>
              </div>
              <div className="flex gap-2">
                {(d.role === "owner" || d.role === "admin") && (
                  <button
                    onClick={() => handleRegenerate(d.id)}
                    className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-sm hover:bg-[color:var(--color-background)]"
                  >
                    {d.pairing_state === "paired" ? "Re-pair" : "Show code"}
                  </button>
                )}
                {d.role === "owner" && (
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
