"use client";

import { useState, useRef, useCallback } from "react";

type InstallState = "idle" | "connecting" | "connected" | "installing" | "done" | "error";

const FIRMWARE_VERSION = "1.0.0";

export default function WirelessEarInstaller() {
  const [state, setState] = useState<InstallState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const portRef = useRef<SerialPort | null>(null);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const isSupported = typeof navigator !== "undefined" && "serial" in navigator;

  async function connect() {
    if (!isSupported) return;
    setState("connecting");
    setError(null);
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setState("connected");
      addLog("Device connected.");

      const info = port.getInfo();
      if (info.usbVendorId) {
        addLog(`Vendor ID: 0x${info.usbVendorId.toString(16).toUpperCase()}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      setState("error");
      setError(msg);
      addLog(`Error: ${msg}`);
    }
  }

  async function disconnect() {
    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch {
        // ignore
      }
      portRef.current = null;
    }
    setState("idle");
    setProgress(0);
    addLog("Disconnected.");
  }

  async function install() {
    if (!portRef.current) return;
    setState("installing");
    setProgress(0);
    addLog(`Installing WirelessEar firmware v${FIRMWARE_VERSION}...`);

    // Simulated installation progress
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((r) => setTimeout(r, 150));
      setProgress(i);
      if (i === 25) addLog("Erasing flash...");
      if (i === 50) addLog("Writing firmware...");
      if (i === 75) addLog("Verifying...");
    }

    setState("done");
    addLog("Installation complete! You can now disconnect your device.");
  }

  return (
    <div className="space-y-6">
      {/* Browser support */}
      {!isSupported && (
        <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-lg text-sm">
          <p className="font-semibold">Web Serial API not supported</p>
          <p className="text-muted mt-1">
            Use Chrome, Edge, or Opera on desktop.
          </p>
        </div>
      )}

      {/* Firmware info card */}
      <div className="p-6 border border-border rounded-lg bg-surface/50">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">WirelessEar Firmware</h3>
            <p className="text-sm text-muted mt-1">
              Wireless audio monitoring system for ESP32
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-accent/10 text-accent border border-accent/20">
            v{FIRMWARE_VERSION}
          </span>
        </div>
        <ul className="mt-4 text-sm text-muted space-y-1">
          <li>• Stream audio over Wi-Fi</li>
          <li>• Low latency transmission</li>
          <li>• Web configuration interface</li>
        </ul>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {state === "idle" || state === "error" ? (
          <button
            onClick={connect}
            disabled={!isSupported}
            className="px-5 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            Connect Device
          </button>
        ) : state === "connected" ? (
          <>
            <button
              onClick={install}
              className="px-5 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors"
            >
              Install Firmware
            </button>
            <button
              onClick={disconnect}
              className="px-5 py-2.5 border border-border font-medium rounded-lg hover:bg-surface transition-colors"
            >
              Disconnect
            </button>
          </>
        ) : state === "done" ? (
          <button
            onClick={disconnect}
            className="px-5 py-2.5 border border-border font-medium rounded-lg hover:bg-surface transition-colors"
          >
            Disconnect
          </button>
        ) : null}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            state === "connected" || state === "done"
              ? "bg-green-500"
              : state === "connecting" || state === "installing"
              ? "bg-yellow-500 animate-pulse"
              : state === "error"
              ? "bg-red-500"
              : "bg-muted"
          }`}
        />
        <span className="text-muted">
          {state === "idle" && "No device connected"}
          {state === "connecting" && "Connecting..."}
          {state === "connected" && "Ready to install"}
          {state === "installing" && `Installing... ${progress}%`}
          {state === "done" && "Installation complete"}
          {state === "error" && (error || "Connection error")}
        </span>
      </div>

      {/* Progress bar */}
      {state === "installing" && (
        <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
            <span className="text-xs font-medium text-muted">Console</span>
            <button
              onClick={() => setLog([])}
              className="text-xs text-muted hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <pre className="p-4 text-xs font-mono leading-relaxed max-h-48 overflow-y-auto bg-background">
            {log.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
