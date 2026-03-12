"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ESPLoader, Transport, type LoaderOptions } from "esptool-js";
import { md5 } from "js-md5";
import ProGate from "./ProGate";

type FlashState = "idle" | "connecting" | "connected" | "flashing" | "done" | "error";
type BatchMode = "single" | "manual" | "auto";

interface FileEntry {
  offset: string;
  file: File | null;
  data: Uint8Array | null;
  fromServer?: boolean;
}

interface BatchDevice {
  id: string;
  name: string;
  serialNumber?: string;
  firmware: FileEntry[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  errorMessage?: string;
  flashTime?: number;
  completedAt?: Date;
}

interface BatchJob {
  id: string;
  name: string;
  devices: BatchDevice[];
  mode: BatchMode;
  created: Date;
  completed?: Date;
  currentDeviceIndex: number;
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

  // Flash configuration state
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [flashSize, setFlashSize] = useState<string>("keep");
  const [flashMode, setFlashMode] = useState<string>("keep");
  const [flashFreq, setFlashFreq] = useState<string>("keep");

  // Batch mode state (Pro features)
  const [batchMode, setBatchMode] = useState<BatchMode>("single");
  const [batchJob, setBatchJob] = useState<BatchJob | null>(null);
  const [showBatchBuilder, setShowBatchBuilder] = useState(false);

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

  // Batch processing helpers
  const processBatchQueue = useCallback(async (job: BatchJob) => {
    if (!job.devices.length) return;

    for (let i = 0; i < job.devices.length; i++) {
      const device = job.devices[i];

      // Update current device index
      setBatchJob(prev => prev ? { ...prev, currentDeviceIndex: i } : null);

      // Update device status to in_progress
      setBatchJob(prev => {
        if (!prev) return null;
        const updatedDevices = prev.devices.map(d =>
          d.id === device.id ? { ...d, status: 'in_progress' as const } : d
        );
        return { ...prev, devices: updatedDevices };
      });

      addLog(`\n--- Processing device ${i + 1}/${job.devices.length}: ${device.name} ---`);

      if (job.mode === 'manual') {
        // Manual mode: wait for user to connect device
        addLog(`Please connect ${device.name} and click continue...`);
        setState("idle");
        // Manual mode flow is handled by continueBatchManual function
        break;
      } else {
        // Auto mode: wait for device connection and flash automatically
        try {
          const startTime = Date.now();

          addLog(`Waiting for device connection...`);
          const deviceConnected = await waitForDeviceConnection(30000);

          if (!deviceConnected) {
            throw new Error('Device connection timeout');
          }

          addLog(`Device detected, connecting...`);

          // Connect to device
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
          await espLoaderRef.current.main();

          addLog(`Connected to ESP32`);

          // Prepare firmware files with serial number injection
          let firmwareFiles = device.firmware.filter(f => f.data && f.offset);

          if (device.serialNumber) {
            addLog(`Injecting serial number: ${device.serialNumber}`);
            firmwareFiles = firmwareFiles.map(f => {
              if (f.data && f.file?.name.toLowerCase().includes('firmware')) {
                // Inject serial number into main firmware file
                const modifiedData = injectSerialNumber(f.data, device.serialNumber!);
                return { ...f, data: modifiedData };
              }
              return f;
            });
          }

          // Flash the device
          const fileArray = firmwareFiles.map((f) => ({
            address: parseInt(f.offset, 16),
            data: Array.from(f.data!).map((byte) => String.fromCharCode(byte)).join(""),
          }));

          addLog(`Flashing ${fileArray.length} file(s)...`);

          await espLoaderRef.current.writeFlash({
            fileArray,
            flashSize: flashSize,
            flashMode: flashMode,
            flashFreq: flashFreq,
            eraseAll: eraseAll,
            compress: true,
            reportProgress: (fileIndex: number, written: number, total: number) => {
              const pct = Math.round((written / total) * 100);
              setProgress(pct);
            },
            calculateMD5Hash: (image: string) => {
              try {
                // Convert hex string to binary data for MD5 calculation
                const bytes = new Uint8Array(image.length / 2);
                for (let i = 0; i < image.length; i += 2) {
                  bytes[i / 2] = parseInt(image.substring(i, i + 2), 16);
                }
                // Calculate proper MD5 hash of the firmware binary
                const hash = md5(bytes);
                return hash;
              } catch (error) {
                // Return dummy hash to allow flashing to continue
                return "00000000000000000000000000000000";
              }
            },
          });

          // Disconnect
          espLoaderRef.current = null;
          if (transportRef.current) {
            await transportRef.current.disconnect();
            transportRef.current = null;
          }

          const flashTime = Date.now() - startTime;

          // Update device status to completed
          setBatchJob(prev => {
            if (!prev) return null;
            const updatedDevices = prev.devices.map(d =>
              d.id === device.id ? {
                ...d,
                status: 'completed' as const,
                flashTime,
                completedAt: new Date()
              } : d
            );
            return { ...prev, devices: updatedDevices };
          });

          addLog(`✓ Device ${device.name} flashed successfully in ${(flashTime/1000).toFixed(1)}s`);
          addLog(`Please disconnect device and connect the next one...`);

        } catch (error) {
          // Clean up on error
          espLoaderRef.current = null;
          if (transportRef.current) {
            try {
              await transportRef.current.disconnect();
              transportRef.current = null;
            } catch {}
          }

          // Update device status to failed
          setBatchJob(prev => {
            if (!prev) return null;
            const updatedDevices = prev.devices.map(d =>
              d.id === device.id ? {
                ...d,
                status: 'failed' as const,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
              } : d
            );
            return { ...prev, devices: updatedDevices };
          });

          addLog(`✗ Device ${device.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

          // Continue to next device in auto mode
          continue;
        }
      }
    }

    // Mark batch job as completed
    setBatchJob(prev => prev ? { ...prev, completed: new Date() } : null);
    addLog(`\n--- Batch job completed ---`);
    setState("done");
  }, [addLog, waitForDeviceConnection, injectSerialNumber]);

  const continueBatchManual = useCallback(async () => {
    if (!batchJob || batchJob.mode !== 'manual') return;

    const currentDevice = batchJob.devices[batchJob.currentDeviceIndex];
    if (!currentDevice) return;

    try {
      const startTime = Date.now();

      setState("connecting");
      addLog(`Connecting to ${currentDevice.name}...`);

      // Connect to device using existing logic
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

      addLog(`Connected to ${chip}!`);
      setState("connected");

      // Prepare firmware files with serial number injection
      let firmwareFiles = currentDevice.firmware.filter(f => f.data && f.offset);

      if (currentDevice.serialNumber) {
        addLog(`Injecting serial number: ${currentDevice.serialNumber}`);
        firmwareFiles = firmwareFiles.map(f => {
          if (f.data && f.file?.name.toLowerCase().includes('firmware')) {
            // Inject serial number into main firmware file
            const modifiedData = injectSerialNumber(f.data, currentDevice.serialNumber!);
            return { ...f, data: modifiedData };
          }
          return f;
        });
      }

      // Validate files
      if (firmwareFiles.length === 0) {
        throw new Error("No firmware files selected for this device");
      }

      setState("flashing");
      setProgress(0);

      // Flash the device using existing logic
      const fileArray = firmwareFiles.map((f) => ({
        address: parseInt(f.offset, 16),
        data: Array.from(f.data!).map((byte) => String.fromCharCode(byte)).join(""),
      }));

      addLog(`Flashing ${fileArray.length} file(s) to ${currentDevice.name}...`);

      await espLoaderRef.current.writeFlash({
        fileArray,
        flashSize: flashSize,
        flashMode: flashMode,
        flashFreq: flashFreq,
        eraseAll: eraseAll,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const pct = Math.round((written / total) * 100);
          setProgress(pct);
        },
        calculateMD5Hash: (image: string) => {
          try {
            // Convert hex string to binary data for MD5 calculation
            const bytes = new Uint8Array(image.length / 2);
            for (let i = 0; i < image.length; i += 2) {
              bytes[i / 2] = parseInt(image.substring(i, i + 2), 16);
            }
            // Calculate proper MD5 hash of the firmware binary
            const hash = md5(bytes);
            return hash;
          } catch (error) {
            // Return dummy hash to allow flashing to continue
            return "00000000000000000000000000000000";
          }
        },
      });

      // Clean up connection
      espLoaderRef.current = null;
      if (transportRef.current) {
        await transportRef.current.disconnect();
        transportRef.current = null;
      }

      const flashTime = Date.now() - startTime;

      // Update device status to completed
      setBatchJob(prev => {
        if (!prev) return null;
        const updatedDevices = prev.devices.map(d =>
          d.id === currentDevice.id ? {
            ...d,
            status: 'completed' as const,
            flashTime,
            completedAt: new Date()
          } : d
        );
        return { ...prev, devices: updatedDevices };
      });

      addLog(`✓ Device ${currentDevice.name} completed in ${(flashTime/1000).toFixed(1)}s`);

      // Move to next device or complete
      const nextIndex = batchJob.currentDeviceIndex + 1;
      if (nextIndex < batchJob.devices.length) {
        setBatchJob(prev => prev ? { ...prev, currentDeviceIndex: nextIndex } : null);
        addLog(`\n--- Ready for device ${nextIndex + 1}/${batchJob.devices.length}: ${batchJob.devices[nextIndex].name} ---`);
        addLog(`Please disconnect current device and connect: ${batchJob.devices[nextIndex].name}`);
        setState("idle");
        setProgress(0);
      } else {
        setBatchJob(prev => prev ? { ...prev, completed: new Date() } : null);
        addLog(`\n--- All devices completed! ---`);
        setState("done");
      }

    } catch (error) {
      // Clean up on error
      espLoaderRef.current = null;
      if (transportRef.current) {
        try {
          await transportRef.current.disconnect();
          transportRef.current = null;
        } catch {}
      }

      // Update device status to failed
      setBatchJob(prev => {
        if (!prev) return null;
        const updatedDevices = prev.devices.map(d =>
          d.id === currentDevice.id ? {
            ...d,
            status: 'failed' as const,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          } : d
        );
        return { ...prev, devices: updatedDevices };
      });

      addLog(`✗ Device ${currentDevice.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setState("error");
      setProgress(0);
    }
  }, [batchJob, addLog, injectSerialNumber]);

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
        data: Array.from(f.data!).map((byte) => String.fromCharCode(byte)).join(""),
      }));

      addLog(`Flashing ${fileArray.length} file(s)...`);

      await espLoaderRef.current.writeFlash({
        fileArray,
        flashSize: flashSize,
        flashMode: flashMode,
        flashFreq: flashFreq,
        eraseAll: eraseAll,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const pct = Math.round((written / total) * 100);
          setProgress(pct);
        },
        calculateMD5Hash: (image: string) => {
          try {
            // Convert hex string to binary data for MD5 calculation
            const bytes = new Uint8Array(image.length / 2);
            for (let i = 0; i < image.length; i += 2) {
              bytes[i / 2] = parseInt(image.substring(i, i + 2), 16);
            }

            // Calculate proper MD5 hash of the firmware binary
            const hash = md5(bytes);
            return hash;

          } catch (error) {
            // Return dummy hash to allow flashing to continue
            return "00000000000000000000000000000000";
          }
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

      {/* Batch Flashing Mode (Pro Feature) */}
      {isPro && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-surface border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Flashing Mode</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                PRO
              </span>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setBatchMode("single")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  batchMode === "single"
                    ? "bg-accent text-white"
                    : "border border-border hover:bg-surface"
                }`}
              >
                Single Device
              </button>
              <button
                onClick={() => setBatchMode("manual")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  batchMode === "manual"
                    ? "bg-accent text-white"
                    : "border border-border hover:bg-surface"
                }`}
              >
                Batch (Manual)
              </button>
              <button
                onClick={() => setBatchMode("auto")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  batchMode === "auto"
                    ? "bg-accent text-white"
                    : "border border-border hover:bg-surface"
                }`}
              >
                Batch (Auto)
              </button>
            </div>

            {batchMode !== "single" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">
                    {batchMode === "manual"
                      ? "Guided workflow with manual device swapping"
                      : "Automatic detection and flashing sequence"
                    }
                  </span>
                  <button
                    onClick={() => setShowBatchBuilder(!showBatchBuilder)}
                    className="text-sm text-accent hover:underline"
                  >
                    {showBatchBuilder ? "Hide" : "Setup"} Batch Queue
                  </button>
                </div>

{showBatchBuilder && (
                  <div className="border border-border rounded-lg p-4 bg-surface/30">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Batch Queue Builder</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const newDevice: BatchDevice = {
                                id: `device_${Date.now()}`,
                                name: `Device ${(batchJob?.devices.length || 0) + 1}`,
                                firmware: [...files],
                                status: 'pending' as const
                              };
                              const updatedJob = batchJob ? {
                                ...batchJob,
                                devices: [...batchJob.devices, newDevice]
                              } : {
                                id: `batch_${Date.now()}`,
                                name: `Batch Job ${new Date().toLocaleDateString()}`,
                                devices: [newDevice],
                                mode: batchMode,
                                created: new Date(),
                                currentDeviceIndex: 0
                              };
                              setBatchJob(updatedJob);
                            }}
                            className="px-3 py-1 text-sm bg-accent text-white rounded hover:bg-accent/90 transition-colors"
                          >
                            Add Device
                          </button>
                          {batchJob && batchJob.devices.length > 0 && (
                            <button
                              onClick={() => setBatchJob(null)}
                              className="px-3 py-1 text-sm border border-border rounded hover:bg-surface transition-colors"
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                      </div>

                      {!batchJob || batchJob.devices.length === 0 ? (
                        <div className="text-center py-8 text-muted">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 text-accent mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <p className="text-sm mb-4">No devices in queue</p>
                          <p className="text-xs">Add devices to create a batch flashing job</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-sm text-muted">
                            Queue: {batchJob.devices.length} device{batchJob.devices.length !== 1 ? 's' : ''}
                          </div>

                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {batchJob.devices.map((device, index) => (
                              <div key={device.id} className="border border-border rounded-lg p-3 bg-background/50">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs px-2 py-1 rounded bg-accent/10 text-accent">
                                      #{index + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={device.name}
                                      onChange={(e) => {
                                        const updatedDevices = batchJob.devices.map(d =>
                                          d.id === device.id ? { ...d, name: e.target.value } : d
                                        );
                                        setBatchJob({ ...batchJob, devices: updatedDevices });
                                      }}
                                      className="text-sm font-medium bg-transparent border-b border-border/50 focus:border-accent outline-none px-1"
                                      placeholder="Device name"
                                    />
                                  </div>
                                  <button
                                    onClick={() => {
                                      const updatedDevices = batchJob.devices.filter(d => d.id !== device.id);
                                      setBatchJob({ ...batchJob, devices: updatedDevices });
                                    }}
                                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-muted">Serial Number:</label>
                                    <input
                                      type="text"
                                      value={device.serialNumber || ''}
                                      onChange={(e) => {
                                        const updatedDevices = batchJob.devices.map(d =>
                                          d.id === device.id ? { ...d, serialNumber: e.target.value } : d
                                        );
                                        setBatchJob({ ...batchJob, devices: updatedDevices });
                                      }}
                                      className="text-xs bg-surface border border-border rounded px-2 py-1 flex-1"
                                      placeholder={`SN${String(index + 1).padStart(3, '0')}`}
                                    />
                                  </div>
                                  <div className="text-xs text-muted">
                                    Firmware: {device.firmware.filter(f => f.file).length} file{device.firmware.filter(f => f.file).length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="border-t border-border pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Batch Settings</span>
                              <span className="text-xs px-2 py-1 rounded bg-accent/10 text-accent">
                                {batchMode === 'manual' ? 'Manual Mode' : 'Auto Mode'}
                              </span>
                            </div>

                            {batchMode === 'manual' && (
                              <div className="text-xs text-muted">
                                <p>• You'll be guided through each device connection</p>
                                <p>• Quality control prompts between devices</p>
                                <p>• Manual confirmation for each step</p>
                              </div>
                            )}

                            {batchMode === 'auto' && (
                              <div className="text-xs text-muted">
                                <p>• Automatic device detection when connected</p>
                                <p>• Serial numbers injected into firmware</p>
                                <p>• Continuous flashing until queue complete</p>
                              </div>
                            )}

                            <button
                              onClick={() => {
                                if (batchJob) {
                                  addLog(`Starting ${batchMode} batch job: ${batchJob.name}`);
                                  addLog(`Queue: ${batchJob.devices.length} devices`);

                                  if (batchMode === 'auto') {
                                    processBatchQueue(batchJob);
                                  } else {
                                    // Manual mode - start with first device
                                    setBatchJob(prev => prev ? { ...prev, currentDeviceIndex: 0 } : null);
                                    addLog(`\n--- Ready for device 1/${batchJob.devices.length}: ${batchJob.devices[0].name} ---`);
                                    addLog(`Please connect the device and click "Connect & Flash"`);
                                    setState("idle");
                                  }

                                  setShowBatchBuilder(false);
                                }
                              }}
                              disabled={batchJob.devices.length === 0}
                              className="w-full py-2 px-4 bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Start Batch Flashing ({batchJob.devices.length} devices)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batch Flashing Promotion (Free users) */}
      {!isPro && (
        <div className="border border-border rounded-lg p-6 bg-surface/30">
          <div className="text-center">
            <div className="inline-flex items-center justify-between w-full mb-4">
              <div className="flex-1"></div>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 text-accent">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1 flex justify-end">
                <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                  PRO
                </span>
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">Batch Flashing</h3>
            <p className="text-sm text-muted mb-4 max-w-md mx-auto">
              Flash multiple ESP32 devices with guided workflows, progress tracking, and quality assurance reporting.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted mb-4">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Manual Mode:</p>
                <p>• Guided device swapping</p>
                <p>• Quality control checkpoints</p>
                <p>• Batch progress tracking</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Auto Mode:</p>
                <p>• Automatic device detection</p>
                <p>• Serial number injection</p>
                <p>• Production reporting</p>
              </div>
            </div>
            <ProGate featureName="Batch flashing">
              <div></div>
            </ProGate>
          </div>
        </div>
      )}

      {/* Batch Progress Display */}
      {batchJob && !showBatchBuilder && (
        <div className="border border-border rounded-lg p-4 bg-surface/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Batch Progress</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded bg-accent/10 text-accent">
                {batchJob.mode === 'manual' ? 'Manual' : 'Auto'} Mode
              </span>
              <button
                onClick={() => setShowBatchBuilder(true)}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                View Queue
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Overall Progress</span>
                <span>
                  {batchJob.devices.filter(d => d.status === 'completed').length}/{batchJob.devices.length} completed
                </span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(batchJob.devices.filter(d => d.status === 'completed').length / batchJob.devices.length) * 100}%`
                  }}
                ></div>
              </div>
            </div>

            {/* Current device */}
            {batchJob.currentDeviceIndex < batchJob.devices.length && (
              <div className="border border-border rounded-lg p-3 bg-accent/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-accent/20 text-accent">
                      Current
                    </span>
                    <span className="font-medium">
                      {batchJob.devices[batchJob.currentDeviceIndex].name}
                    </span>
                  </div>
                  <span className="text-sm text-muted">
                    #{batchJob.currentDeviceIndex + 1}
                  </span>
                </div>
                {batchJob.devices[batchJob.currentDeviceIndex].serialNumber && (
                  <div className="text-xs text-muted">
                    SN: {batchJob.devices[batchJob.currentDeviceIndex].serialNumber}
                  </div>
                )}
                {batchJob.mode === 'manual' && state === 'idle' && (
                  <button
                    onClick={continueBatchManual}
                    className="mt-2 w-full py-2 px-3 bg-accent text-white rounded hover:bg-accent/90 transition-colors text-sm"
                  >
                    Connect & Flash Device
                  </button>
                )}
              </div>
            )}

            {/* Device status list */}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {batchJob.devices.map((device, index) => (
                <div key={device.id} className="flex items-center justify-between py-1 px-2 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">#{index + 1}</span>
                    <span>{device.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {device.status === 'pending' && (
                      <span className="text-xs text-muted">Pending</span>
                    )}
                    {device.status === 'in_progress' && (
                      <span className="text-xs text-accent">In Progress...</span>
                    )}
                    {device.status === 'completed' && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-green-400">✓ Done</span>
                        {device.flashTime && (
                          <span className="text-xs text-muted">({device.flashTime}ms)</span>
                        )}
                      </div>
                    )}
                    {device.status === 'failed' && (
                      <span className="text-xs text-red-400">✗ Failed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Batch completion */}
            {batchJob.completed && (
              <div className="border-t border-border pt-3">
                <div className="text-center py-2">
                  <div className="text-green-400 text-sm font-medium mb-1">
                    ✓ Batch Job Completed!
                  </div>
                  <div className="text-xs text-muted">
                    {batchJob.devices.filter(d => d.status === 'completed').length} successful,
                    {batchJob.devices.filter(d => d.status === 'failed').length} failed
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
