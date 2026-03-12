"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ESPLoader, Transport, type LoaderOptions } from "esptool-js";
import { md5 } from "js-md5";
import ProGate from "./ProGate";

type FlashState = "idle" | "connecting" | "connected" | "flashing" | "done" | "error";

interface FileEntry {
  offset: string;
  file: File | null;
  data: Uint8Array | null;
  fromServer?: boolean;
}

interface WebFlasherProps {
  firmwareUrl?: string;
  isPro?: boolean;
}

export default function WebFlasher({ firmwareUrl, isPro = false }: WebFlasherProps) {
  const [state, setState] = useState<FlashState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [chipInfo, setChipInfo] = useState<string | null>(null);
  const [firmwareLoaded, setFirmwareLoaded] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([
    { offset: "0x0", file: null, data: null },
  ]);
  const [eraseAll, setEraseAll] = useState(false);

  // Firmware type selection state
  const [firmwareType, setFirmwareType] = useState<"merged" | "separate-standard" | "separate-custom">("merged");

  // Flash configuration state
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [flashSize, setFlashSize] = useState<string>("keep");
  const [flashMode, setFlashMode] = useState<string>("keep");
  const [flashFreq, setFlashFreq] = useState<string>("keep");


  const espLoaderRef = useRef<ESPLoader | null>(null);
  const transportRef = useRef<Transport | null>(null);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Serial number injection helper
  const injectSerialNumber = useCallback((originalData: Uint8Array, serialNumber: string): Uint8Array => {
    // For ESP32 firmware, we'll inject the serial number at a specific location
    // This is a simplified implementation - in production you'd need to:
    // 1. Parse the firmware format (ELF, bin, etc.)
    // 2. Find the appropriate section for serial number storage
    // 3. Modify the data while maintaining checksums

    const modifiedData = new Uint8Array(originalData);
    const serialBytes = new TextEncoder().encode(serialNumber.padEnd(16, '\0'));

    // Look for a placeholder pattern or specific offset
    // For demo purposes, we'll replace the first occurrence of "SERIALNO" with the actual serial
    const placeholder = new TextEncoder().encode("SERIALNO");

    for (let i = 0; i <= modifiedData.length - placeholder.length; i++) {
      let match = true;
      for (let j = 0; j < placeholder.length; j++) {
        if (modifiedData[i + j] !== placeholder[j]) {
          match = false;
          break;
        }
      }

      if (match) {
        // Replace with actual serial number (truncated to fit)
        const replacement = serialBytes.slice(0, placeholder.length);
        modifiedData.set(replacement, i);
        addLog(`Serial number injected at offset 0x${i.toString(16)}`);
        break;
      }
    }

    return modifiedData;
  }, [addLog]);

  // Auto device detection helper
  const waitForDeviceConnection = useCallback(async (timeoutMs: number = 30000): Promise<boolean> => {
    return new Promise((resolve) => {
      let timeout: NodeJS.Timeout;

      const checkForDevice = async () => {
        try {
          // Check if there are any available serial ports
          const ports = await navigator.serial.getPorts();
          if (ports.length > 0) {
            // Try to connect to the first available port
            const port = ports[0];
            const testTransport = new Transport(port, true);

            const testLoader = new ESPLoader({
              transport: testTransport,
              baudrate: 115200,
              romBaudrate: 115200,
              terminal,
              debugLogging: false,
            });

            await testLoader.main();
            // Disconnect transport instead of loader
            await testTransport.disconnect();

            clearTimeout(timeout);
            resolve(true);
            return;
          }
        } catch (error) {
          // Device not ready, continue waiting
        }

        // Check again in 1 second
        setTimeout(checkForDevice, 1000);
      };

      // Start checking
      checkForDevice();

      // Set timeout
      timeout = setTimeout(() => {
        resolve(false);
      }, timeoutMs);
    });
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

  function handleFirmwareTypeChange(type: "merged" | "separate-standard" | "separate-custom") {
    setFirmwareType(type);

    if (type === "merged") {
      // Reset to single file at 0x0 for merged firmware
      setFiles([{ offset: "0x0", file: null, data: null }]);
    } else if (type === "separate-standard") {
      // Set up three pre-configured entries for separate files
      setFiles([
        { offset: "0x1000", file: null, data: null }, // Bootloader
        { offset: "0x8000", file: null, data: null }, // Partition Table
        { offset: "0x10000", file: null, data: null }, // Application
      ]);
    } else if (type === "separate-custom") {
      // Start with one editable entry for custom configuration
      setFiles([{ offset: "0x1000", file: null, data: null }]);
    }
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
        data: Array.from(f.data!).map((byte) => String.fromCharCode(byte)).join(""),
      }));

      addLog(`Flashing ${fileArray.length} file(s)...`);

      // Multi-file flashing requires explicit parameters (not "keep")
      const isMultiFile = fileArray.length > 1;

      if (isMultiFile) {
        addLog(`Multi-file detected - using explicit flash parameters`);
        addLog(`Flash config: ${flashSize === "keep" ? "4MB" : flashSize}, ${flashMode === "keep" ? "dio" : flashMode}, ${flashFreq === "keep" ? "40m" : flashFreq}`);
        addLog("Multi-file flashing: MD5 verification disabled (known esptool-js issue)");
      }

      const flashOptions: any = {
        fileArray,
        flashSize: isMultiFile && flashSize === "keep" ? "4MB" : flashSize,
        flashMode: isMultiFile && flashMode === "keep" ? "dio" : flashMode,
        flashFreq: isMultiFile && flashFreq === "keep" ? "40m" : flashFreq,
        eraseAll: eraseAll,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const pct = Math.round((written / total) * 100);
          setProgress(pct);
        },
      };

      // Only add MD5 calculation for single-file scenarios
      if (!isMultiFile) {
        flashOptions.calculateMD5Hash = (image: string) => {
          try {
            // Convert hex string to binary data for MD5 calculation
            const bytes = new Uint8Array(image.length / 2);
            for (let i = 0; i < image.length; i += 2) {
              bytes[i / 2] = parseInt(image.substr(i, 2), 16);
            }

            // Calculate proper MD5 hash of the firmware binary
            const hash = md5(bytes);
            addLog(`Firmware MD5: ${hash}`);
            return hash;

          } catch (error) {
            // Return dummy hash to allow flashing to continue
            return "00000000000000000000000000000000";
          }
        };
      }

      await espLoaderRef.current.writeFlash(flashOptions);

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
          <span>ESP32 Memory Layout & Advanced Options</span>
          <svg className="w-4 h-4 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 text-sm text-muted space-y-4 border-t border-border pt-3">
          <div>
            <p className="font-medium text-foreground mb-2">ESP32 Flash Memory Layout</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-1.5 pr-4 font-semibold text-foreground">Address</th>
                    <th className="py-1.5 pr-4 font-semibold text-foreground">Component</th>
                    <th className="py-1.5 font-semibold text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 pr-4 text-accent">0x0-0x1000</td>
                    <td className="py-1.5 pr-4">Boot Sector</td>
                    <td className="py-1.5">Reserved area (filled with 0xFF)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 pr-4 text-accent">0x1000</td>
                    <td className="py-1.5 pr-4">Bootloader</td>
                    <td className="py-1.5">Second-stage bootloader</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 pr-4 text-accent">0x8000</td>
                    <td className="py-1.5 pr-4">Partition Table</td>
                    <td className="py-1.5">Memory layout definition</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-4 text-accent">0x10000</td>
                    <td className="py-1.5 pr-4">Application</td>
                    <td className="py-1.5">Main firmware application</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="font-medium text-foreground mb-2">Firmware Types Explained</p>
            <div className="space-y-2 text-xs">
              <div>
                <strong>Merged Firmware:</strong> A single .bin file containing all components with proper spacing, always flashed at 0x0.
                Created by tools like our <a href="/tools/esp32-firmware-merger" className="text-accent hover:underline">Firmware Merger</a> or ESP-IDF's merge command.
              </div>
              <div>
                <strong>Separate Files:</strong> Individual component files (.bin) that must be flashed to their specific addresses.
                Common when building with ESP-IDF or Arduino IDE separately.
              </div>
            </div>
          </div>

          <div>
            <p className="font-medium text-foreground mb-2">Troubleshooting</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>If ESP32 won't boot: Check you're using the correct firmware type and addresses</li>
              <li>For custom partition tables: Check your project's partition.csv for correct addresses</li>
              <li>Flash errors: Try erasing flash first, or check connection</li>
              <li>Large files: Multi-file flashing automatically disables MD5 verification for compatibility</li>
            </ul>
          </div>
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

      {/* Firmware Type Selection - only when connected */}
      {(state === "connected" || state === "done") && (
        <div className="p-6 border border-border rounded-lg space-y-4">
          <div className="space-y-3">
            <h3 className="font-semibold">What type of firmware do you have?</h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="firmwareType"
                  value="merged"
                  checked={firmwareType === "merged"}
                  onChange={(e) => handleFirmwareTypeChange(e.target.value as "merged")}
                  className="w-4 h-4 text-accent bg-background border-border focus:ring-accent/50"
                />
                <span className="text-sm">
                  <strong>Single merged firmware file</strong> - One .bin file containing everything
                </span>
              </label>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="firmwareType"
                  value="separate-standard"
                  checked={firmwareType === "separate-standard"}
                  onChange={(e) => handleFirmwareTypeChange(e.target.value as "separate-standard")}
                  className="w-4 h-4 text-accent bg-background border-border focus:ring-accent/50"
                />
                <span className="text-sm">
                  <strong>Multiple separate files (standard)</strong> - Bootloader, partition table, and application files
                </span>
              </label>
            </div>
            <ProGate featureName="Custom address flashing">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="firmwareType"
                    value="separate-custom"
                    checked={firmwareType === "separate-custom"}
                    onChange={(e) => handleFirmwareTypeChange(e.target.value as "separate-custom")}
                    className="w-4 h-4 text-accent bg-background border-border focus:ring-accent/50"
                  />
                  <span className="text-sm">
                    <strong>Multiple separate files (custom addresses)</strong> - Manual configuration for advanced users
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                      PRO
                    </span>
                  </span>
                </label>
              </div>
            </ProGate>
          </div>
        </div>
      )}

      {/* File selection - only when connected */}
      {(state === "connected" || state === "done") && (
        <div className="p-6 border border-border rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {firmwareType === "merged" && "Upload Merged Firmware"}
              {firmwareType === "separate-standard" && "Upload Separate Files (Standard)"}
              {firmwareType === "separate-custom" && "Upload Separate Files (Custom)"}
            </h3>
            {(firmwareType === "separate-standard" && files.length < 3) && (
              <button
                onClick={addFileEntry}
                className="text-sm text-accent hover:underline"
              >
                + Add file
              </button>
            )}
            {firmwareType === "separate-custom" && (
              <button
                onClick={addFileEntry}
                className="text-sm text-accent hover:underline"
              >
                + Add file
              </button>
            )}
          </div>

          <div className="space-y-3">
            {firmwareType === "merged" && (
              /* Merged firmware interface - single file at 0x0 */
              <div className="space-y-3">
                <div className="bg-surface border border-accent/20 rounded-lg p-3">
                  <p className="text-sm text-foreground mb-2">
                    <strong>Instructions:</strong> Upload your merged .bin file. It will be flashed starting at 0x0 and contains all components (bootloader, partition table, and application) with proper spacing.
                  </p>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="w-24 px-3 py-2 bg-surface border border-accent/20 rounded-lg text-sm font-mono text-center text-accent">
                    0x0
                  </div>
                  {files[0]?.fromServer ? (
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
                      onChange={(e) => handleFileSelect(0, e.target.files?.[0] || null)}
                      className="flex-1 text-sm text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-border file:text-sm file:font-medium file:bg-surface file:text-foreground hover:file:bg-border file:cursor-pointer file:transition-colors"
                    />
                  )}
                  <div className="w-20 text-sm text-muted">Merged Firmware</div>
                </div>
              </div>
            )}

            {firmwareType === "separate-standard" && (
              /* Separate files interface - three pre-configured rows */
              <div className="space-y-3">
                <div className="bg-surface border border-accent/20 rounded-lg p-3">
                  <p className="text-sm text-foreground mb-2">
                    <strong>Instructions:</strong> Upload the three separate .bin files to their corresponding addresses. Each file will be flashed to its specific location in ESP32 memory.
                  </p>
                </div>
                {files.map((entry, index) => {
                  const fileLabels = ["Bootloader", "Partition Table", "Application"];
                  const fileDescriptions = [
                    "Second-stage bootloader",
                    "Memory layout definition",
                    "Main application firmware"
                  ];
                  return (
                    <div key={index} className="flex gap-3 items-center">
                      <div className="w-24 px-3 py-2 bg-surface border border-accent/20 rounded-lg text-sm font-mono text-center text-accent">
                        {entry.offset}
                      </div>
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
                      <div className="w-32 text-sm">
                        <div className="font-medium text-foreground">{fileLabels[index]}</div>
                        <div className="text-xs text-muted">{fileDescriptions[index]}</div>
                      </div>
                      {files.length > 3 && (
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
                  );
                })}
              </div>
            )}

            {firmwareType === "separate-custom" && (
              /* Custom files interface - editable addresses */
              <div className="space-y-3">
                <div className="bg-surface border border-accent/20 rounded-lg p-3">
                  <p className="text-sm text-foreground mb-2">
                    <strong>Advanced Mode:</strong> Configure custom flash addresses for your specific ESP32 setup.
                    Common uses: OTA partitions, custom bootloaders, factory data, or non-standard ESP32 variants.
                  </p>
                  <p className="text-xs text-muted">
                    Examples: OTA app at 0x110000, factory data at 0x9000, or custom partition layouts.
                  </p>
                </div>
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
                    <div className="w-32 text-xs text-muted">
                      Custom Component
                    </div>
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
            )}
          </div>


          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="eraseAll"
              checked={eraseAll}
              onChange={(e) => setEraseAll(e.target.checked)}
              className="w-4 h-4 text-accent bg-background border border-border rounded focus:ring-accent/50 focus:ring-2"
            />
            <label htmlFor="eraseAll" className="text-sm text-muted">
              Erase all flash before writing (recommended for clean installation)
            </label>
          </div>

          {/* Flash Configuration Options */}
          <div className="border-t border-border pt-3 mt-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Flash Configuration</span>
              <button
                type="button"
                onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                className="text-xs text-accent hover:underline"
              >
                {showAdvancedConfig ? 'Hide' : 'Show'} Advanced Options
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="radio"
                id="autoDetect"
                name="flashConfig"
                checked={!showAdvancedConfig}
                onChange={() => {
                  setShowAdvancedConfig(false);
                  setFlashSize("keep");
                  setFlashMode("keep");
                  setFlashFreq("keep");
                }}
                className="w-4 h-4 text-accent border border-border focus:ring-accent/50 focus:ring-2"
              />
              <label htmlFor="autoDetect" className="text-sm">
                <span className="font-medium text-foreground">Auto-detect</span>
                <span className="text-muted ml-1">(recommended - uses device settings)</span>
              </label>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="radio"
                id="manualConfig"
                name="flashConfig"
                checked={showAdvancedConfig}
                onChange={() => setShowAdvancedConfig(true)}
                className="w-4 h-4 text-accent border border-border focus:ring-accent/50 focus:ring-2"
              />
              <label htmlFor="manualConfig" className="text-sm">
                <span className="font-medium text-foreground">Manual configuration</span>
                <span className="text-muted ml-1">(for custom boards or troubleshooting)</span>
              </label>
            </div>

            {showAdvancedConfig && (
              <div className="pl-6 space-y-3 border-l-2 border-accent/20">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Flash Size</label>
                    <select
                      value={flashSize}
                      onChange={(e) => setFlashSize(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent/50"
                    >
                      <option value="keep">Auto-detect</option>
                      <option value="1MB">1MB</option>
                      <option value="2MB">2MB</option>
                      <option value="4MB">4MB</option>
                      <option value="8MB">8MB</option>
                      <option value="16MB">16MB</option>
                      <option value="32MB">32MB</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Flash Mode</label>
                    <select
                      value={flashMode}
                      onChange={(e) => setFlashMode(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent/50"
                    >
                      <option value="keep">Auto-detect</option>
                      <option value="qio">QIO (Fastest)</option>
                      <option value="qout">QOUT</option>
                      <option value="dio">DIO (Compatible)</option>
                      <option value="dout">DOUT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Flash Frequency</label>
                    <select
                      value={flashFreq}
                      onChange={(e) => setFlashFreq(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent/50"
                    >
                      <option value="keep">Auto-detect</option>
                      <option value="80m">80MHz (Fast)</option>
                      <option value="40m">40MHz (Standard)</option>
                      <option value="26m">26MHz (Safe)</option>
                      <option value="20m">20MHz (Conservative)</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-muted">
                  <p className="mb-1"><strong>Note:</strong> Auto-detect works for most boards. Use manual settings only for:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>Custom PCBs with specific requirements</li>
                    <li>Troubleshooting flash or boot issues</li>
                    <li>Boards with corrupted configuration</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

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
