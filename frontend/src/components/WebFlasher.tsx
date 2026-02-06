"use client";

import { useState, useRef, useCallback } from "react";
import { ESPLoader, Transport, type LoaderOptions } from "esptool-js";

type FlashState = "idle" | "connecting" | "connected" | "flashing" | "done" | "error";

interface FileEntry {
  offset: string;
  file: File | null;
  data: Uint8Array | null;
}

export default function WebFlasher() {
  const [state, setState] = useState<FlashState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [chipInfo, setChipInfo] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([
    { offset: "0x1000", file: null, data: null },
  ]);

  const espLoaderRef = useRef<ESPLoader | null>(null);
  const transportRef = useRef<Transport | null>(null);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const isSupported = typeof navigator !== "undefined" && "serial" in navigator;

  const terminal = {
    clean: () => setLog([]),
    writeLine: (data: string) => addLog(data),
    write: (data: string) => addLog(data),
  };

  async function connect() {
    if (!isSupported) return;
    setState("connecting");
    setError(null);
    setChipInfo(null);

    try {
      const port = await navigator.serial.requestPort();
      transportRef.current = new Transport(port, true);

      const loaderOptions: LoaderOptions = {
        transport: transportRef.current,
        baudrate: 115200,
        romBaudrate: 115200,
        terminal,
        debugLogging: false,
      };

      espLoaderRef.current = new ESPLoader(loaderOptions);
      const chip = await espLoaderRef.current.main();

      setChipInfo(chip);
      setState("connected");
      addLog(`Connected to ${chip}`);

      const macAddr = await espLoaderRef.current.chip.readMac(espLoaderRef.current);
      addLog(`MAC Address: ${macAddr}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      setState("error");
      setError(msg);
      addLog(`Error: ${msg}`);
    }
  }

  async function disconnect() {
    try {
      if (transportRef.current) {
        await transportRef.current.disconnect();
        await transportRef.current.waitForUnlock(1500);
      }
    } catch {
      // ignore
    }
    espLoaderRef.current = null;
    transportRef.current = null;
    setState("idle");
    setChipInfo(null);
    setProgress(0);
    addLog("Disconnected.");
  }

  async function handleFileSelect(index: number, file: File | null) {
    if (!file) {
      setFiles((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], file: null, data: null };
        return updated;
      });
      return;
    }

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    setFiles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], file, data };
      return updated;
    });

    addLog(`Loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  }

  function handleOffsetChange(index: number, offset: string) {
    setFiles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], offset };
      return updated;
    });
  }

  function addFileEntry() {
    setFiles((prev) => [...prev, { offset: "0x0", file: null, data: null }]);
  }

  function removeFileEntry(index: number) {
    if (files.length <= 1) return;
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function flash() {
    if (!espLoaderRef.current) return;

    const validFiles = files.filter((f) => f.data && f.offset);
    if (validFiles.length === 0) {
      setError("No firmware files selected");
      return;
    }

    setState("flashing");
    setProgress(0);
    setError(null);

    try {
      const fileArray = validFiles.map((f) => ({
        address: parseInt(f.offset, 16),
        data: Array.from(f.data!).map((b) => String.fromCharCode(b)).join(""),
      }));

      addLog(`Flashing ${fileArray.length} file(s)...`);

      await espLoaderRef.current.writeFlash({
        fileArray,
        flashSize: "keep",
        flashMode: "keep",
        flashFreq: "keep",
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const pct = Math.round((written / total) * 100);
          setProgress(pct);
        },
        calculateMD5Hash: (image: string) => {
          // Simple hash for verification display
          return image.slice(0, 32);
        },
      });

      setState("done");
      addLog("Flash complete! You can disconnect or reset your device.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Flash failed";
      setState("error");
      setError(msg);
      addLog(`Error: ${msg}`);
    }
  }

  async function eraseFlash() {
    if (!espLoaderRef.current) return;

    setState("flashing");
    addLog("Erasing flash... this may take a while.");

    try {
      await espLoaderRef.current.eraseFlash();
      setState("connected");
      addLog("Flash erased successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erase failed";
      setState("error");
      setError(msg);
      addLog(`Error: ${msg}`);
    }
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

      {/* Connection controls */}
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
            disabled={state === "flashing"}
            className="px-5 py-2.5 border border-border font-medium rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-3 text-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            state === "connected" || state === "done"
              ? "bg-green-500"
              : state === "connecting" || state === "flashing"
              ? "bg-yellow-500 animate-pulse"
              : state === "error"
              ? "bg-red-500"
              : "bg-muted"
          }`}
        />
        <span className="text-muted">
          {state === "idle" && "No device connected"}
          {state === "connecting" && "Connecting..."}
          {state === "connected" && (chipInfo ? `Connected: ${chipInfo}` : "Connected")}
          {state === "flashing" && `Flashing... ${progress}%`}
          {state === "done" && "Flash complete"}
          {state === "error" && (error || "Connection error")}
        </span>
      </div>

      {/* File selection - only when connected */}
      {(state === "connected" || state === "done") && (
        <div className="p-6 border border-border rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Firmware Files</h3>
            <button
              onClick={addFileEntry}
              className="text-sm text-accent hover:underline"
            >
              + Add file
            </button>
          </div>

          <div className="space-y-3">
            {files.map((entry, index) => (
              <div key={index} className="flex gap-3 items-center">
                <input
                  type="text"
                  value={entry.offset}
                  onChange={(e) => handleOffsetChange(index, e.target.value)}
                  placeholder="0x1000"
                  className="w-24 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <input
                  type="file"
                  accept=".bin"
                  onChange={(e) => handleFileSelect(index, e.target.files?.[0] || null)}
                  className="flex-1 text-sm text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-border file:text-sm file:font-medium file:bg-surface file:text-foreground hover:file:bg-border file:cursor-pointer file:transition-colors"
                />
                {files.length > 1 && (
                  <button
                    onClick={() => removeFileEntry(index)}
                    className="p-2 text-muted hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-muted">
            Enter the flash offset address (e.g., 0x1000 for bootloader, 0x10000 for app) and select the .bin file.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              onClick={flash}
              disabled={state !== "connected" || !files.some((f) => f.data)}
              className="px-5 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Flash Firmware
            </button>
            <button
              onClick={eraseFlash}
              disabled={state !== "connected"}
              className="px-5 py-2.5 border border-border font-medium rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
            >
              Erase Flash
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {state === "flashing" && progress > 0 && (
        <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
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
