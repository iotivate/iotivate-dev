"use client";

import { useState, useRef, useCallback } from "react";

type FlashState = "idle" | "connecting" | "connected" | "flashing" | "done" | "error";

export default function WebFlasher() {
  const [state, setState] = useState<FlashState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [firmware, setFirmware] = useState<File | null>(null);
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
      addLog("Serial port connected at 115200 baud.");

      const info = port.getInfo();
      if (info.usbVendorId) {
        addLog(`USB Vendor ID: 0x${info.usbVendorId.toString(16).toUpperCase()}`);
      }
      if (info.usbProductId) {
        addLog(`USB Product ID: 0x${info.usbProductId.toString(16).toUpperCase()}`);
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
        // port may already be closed
      }
      portRef.current = null;
    }
    setState("idle");
    addLog("Disconnected.");
  }

  async function flash() {
    if (!firmware || !portRef.current) return;
    setState("flashing");
    addLog(`Flashing firmware: ${firmware.name} (${(firmware.size / 1024).toFixed(1)} KB)`);

    // Simulated flash progress — real esptool.js integration goes here
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((r) => setTimeout(r, 200));
      addLog(`Progress: ${i}%`);
    }

    setState("done");
    addLog("Flash complete (simulated). Replace with esptool.js for real flashing.");
  }

  return (
    <div className="space-y-6">
      {/* Browser support check */}
      {!isSupported && (
        <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-lg text-sm">
          <p className="font-semibold">Web Serial API not supported</p>
          <p className="text-muted mt-1">
            Use Chrome, Edge, or Opera on desktop to access Web Serial.
          </p>
        </div>
      )}

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
        ) : (
          <button
            onClick={disconnect}
            className="px-5 py-2.5 border border-border font-medium rounded-lg hover:bg-surface transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            state === "connected" || state === "flashing" || state === "done"
              ? "bg-green-500"
              : state === "connecting"
              ? "bg-yellow-500 animate-pulse"
              : "bg-muted"
          }`}
        />
        <span className="text-muted">
          {state === "idle" && "No device connected"}
          {state === "connecting" && "Connecting..."}
          {state === "connected" && "Device connected"}
          {state === "flashing" && "Flashing..."}
          {state === "done" && "Flash complete"}
          {state === "error" && (error || "Connection error")}
        </span>
      </div>

      {/* Firmware upload + flash */}
      {(state === "connected" || state === "done") && (
        <div className="p-6 border border-border rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Firmware file (.bin)
            </label>
            <input
              type="file"
              accept=".bin"
              onChange={(e) => setFirmware(e.target.files?.[0] || null)}
              className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-border file:text-sm file:font-medium file:bg-surface file:text-foreground hover:file:bg-border file:cursor-pointer file:transition-colors"
            />
          </div>
          {firmware && (
            <button
              onClick={flash}
              disabled={state !== "connected"}
              className="px-5 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Flash Firmware
            </button>
          )}
        </div>
      )}

      {/* Log output */}
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
          <pre className="p-4 text-xs font-mono leading-relaxed max-h-64 overflow-y-auto bg-background">
            {log.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
