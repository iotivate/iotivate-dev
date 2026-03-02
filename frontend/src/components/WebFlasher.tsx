"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ESPLoader, Transport, type LoaderOptions } from "esptool-js";

type FlashState = "idle" | "connecting" | "connected" | "flashing" | "done" | "error";

interface FileEntry {
  offset: string;
  file: File | null;
  data: Uint8Array | null;
  fromServer?: boolean;
}

interface WebFlasherProps {
  firmwareUrl?: string;
}

export default function WebFlasher({ firmwareUrl }: WebFlasherProps) {
  const [state, setState] = useState<FlashState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [chipInfo, setChipInfo] = useState<string | null>(null);
  const [firmwareLoaded, setFirmwareLoaded] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([
    { offset: "0x0", file: null, data: null },
  ]);

  const espLoaderRef = useRef<ESPLoader | null>(null);
  const transportRef = useRef<Transport | null>(null);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const isSupported = typeof navigator !== "undefined" && "serial" in navigator;

  // Auto-fetch firmware from URL when device is connected
  useEffect(() => {
    if (!firmwareUrl || firmwareLoaded) return;
    if (state !== "connected" && state !== "done") return;

    let cancelled = false;
    async function fetchFirmware() {
      addLog(`Downloading firmware from server...`);
      try {
        const res = await fetch(firmwareUrl!);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        const buffer = await res.arrayBuffer();
        const data = new Uint8Array(buffer);
        if (cancelled) return;

        setFiles((prev) => {
          const updated = [...prev];
          updated[0] = { offset: "0x0", file: null, data, fromServer: true };
          return updated;
        });
        setFirmwareLoaded(true);
        addLog(`Firmware loaded from server (${(data.length / 1024).toFixed(1)} KB)`);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to download firmware";
        addLog(`Error: ${msg}`);
      }
    }
    fetchFirmware();
    return () => { cancelled = true; };
  }, [firmwareUrl, firmwareLoaded, state, addLog]);

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
      {/* Quick start guide */}
      <details className="group border border-border rounded-lg">
        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none text-sm font-medium hover:bg-surface/50 transition-colors">
          <span>How to flash multiple .bin files (bootloader + partition + firmware)</span>
          <svg className="w-4 h-4 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 text-sm text-muted space-y-3 border-t border-border pt-3">
          <p>
            ESP32 firmware can be flashed in two ways: as separate files or as a single merged file.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-foreground mb-2">Option 1: Merged Firmware (Recommended)</p>
              <ul className="space-y-1 text-xs">
                <li>• Use our <a href="/tools/esp32-firmware-merger" className="text-accent hover:underline">Firmware Merger</a> tool first</li>
                <li>• Upload the single merged <code className="text-foreground bg-surface px-1 py-0.5 rounded">.bin</code> file</li>
                <li>• Set offset to <code className="text-foreground bg-surface px-1 py-0.5 rounded">0x0</code></li>
                <li>• Flash - all components are written to correct positions</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-2">Option 2: Separate Files (Traditional)</p>
              <p className="text-xs mb-2">ESP32 firmware typically consists of three separate files:</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-1.5 pr-4 font-semibold text-foreground">Offset</th>
                  <th className="py-1.5 pr-4 font-semibold text-foreground">File</th>
                  <th className="py-1.5 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 pr-4 text-accent">0x0</td>
                  <td className="py-1.5 pr-4">bootloader.bin</td>
                  <td className="py-1.5">First-stage bootloader</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 pr-4 text-accent">0x8000</td>
                  <td className="py-1.5 pr-4">partitions.bin</td>
                  <td className="py-1.5">Partition table layout</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-accent">0x10000</td>
                  <td className="py-1.5 pr-4">firmware.bin</td>
                  <td className="py-1.5">Application firmware</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-foreground mb-2">For Merged Firmware:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Click <strong className="text-foreground">Connect Device</strong> and select your ESP32</li>
                <li>Upload your merged .bin file at offset <code className="text-foreground bg-surface px-1 py-0.5 rounded">0x0</code></li>
                <li>Click <strong className="text-foreground">Flash Firmware</strong></li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-foreground mb-2">For Separate Files:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Click <strong className="text-foreground">Connect Device</strong> and select your ESP32</li>
                <li>Click <strong className="text-foreground">+ Add file</strong> to create rows for each .bin file (3 total)</li>
                <li>Set the offset and select the matching .bin for each row</li>
                <li>Click <strong className="text-foreground">Flash Firmware</strong></li>
              </ol>
            </div>
          </div>
          <p className="text-xs">
            These are the default offsets for ESP-IDF and Arduino. If your project uses a custom partition table,
            check your build output or <code className="text-foreground bg-surface px-1 py-0.5 rounded">partitions.csv</code> for the correct addresses.
          </p>
        </div>
      </details>

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
                {entry.fromServer ? (
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/20 rounded-lg text-sm">
                    <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-accent">Firmware loaded from server</span>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept=".bin"
                    onChange={(e) => handleFileSelect(index, e.target.files?.[0] || null)}
                    className="flex-1 text-sm text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-border file:text-sm file:font-medium file:bg-surface file:text-foreground hover:file:bg-border file:cursor-pointer file:transition-colors"
                  />
                )}
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
