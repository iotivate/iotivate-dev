"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ESPLoader, Transport, type LoaderOptions } from "esptool-js";

type FlashState = "idle" | "connecting" | "connected" | "downloading" | "flashing" | "done" | "error";

interface ProjectWebFlasherProps {
  firmwareUrl: string;
}

interface FirmwareData {
  data: Uint8Array;
  size: number;
  filename: string;
}

/**
 * Specialized firmware flasher for project firmware that's already uploaded to R2.
 * Provides a streamlined experience compared to the generic WebFlasher tool:
 * - Auto-downloads firmware from R2 when device connects
 * - Pre-configured for single merged firmware file at 0x0
 * - Simplified UI focused on project firmware flashing workflow
 */
export default function ProjectWebFlasher({ firmwareUrl }: ProjectWebFlasherProps) {
  const [state, setState] = useState<FlashState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [chipInfo, setChipInfo] = useState<string | null>(null);
  const [firmware, setFirmware] = useState<FirmwareData | null>(null);

  const espLoaderRef = useRef<ESPLoader | null>(null);
  const transportRef = useRef<Transport | null>(null);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog((prev) => [...prev.slice(-50), `[${timestamp}] ${msg}`]);
  }, []);

  const isSupported = typeof navigator !== "undefined" && "serial" in navigator;

  // Auto-download firmware when device connects
  useEffect(() => {
    if (!firmwareUrl || firmware || state !== "connected") return;

    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    async function downloadFirmwareWithRetry(retryCount = 0) {
      setState("downloading");
      setDownloadProgress(0);
      addLog("Downloading firmware from server...");

      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      try {
        // Start download timeout (30 seconds)
        timeoutId = setTimeout(() => {
          cancelled = true;
          addLog("⚠ Download timeout after 30 seconds");
          if (reader) {
            reader.cancel().catch(() => {});
          }
        }, 30000);

        const response = await fetch(firmwareUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

        addLog(`Starting download${totalBytes > 0 ? ` (${(totalBytes / 1024).toFixed(1)} KB)` : " (size unknown)"}`);

        // Use ReadableStream for progress tracking
        reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;
        let chunkCount = 0;

        while (!cancelled) {
          const readResult = await reader.read();
          const { done, value } = readResult;

          if (done) {
            addLog(`✓ Stream completed after ${chunkCount} chunks`);
            break;
          }

          if (cancelled) {
            addLog("Download cancelled during processing");
            return;
          }

          chunks.push(value);
          receivedBytes += value.length;
          chunkCount++;

          // Update progress if we know the total size
          if (totalBytes > 0) {
            const percentage = Math.round((receivedBytes / totalBytes) * 100);
            setDownloadProgress(percentage);

            // Log progress every 25%
            if (percentage % 25 === 0) {
              addLog(`Download progress: ${percentage}% (${(receivedBytes / 1024).toFixed(1)} KB)`);
            }
          } else {
            // Unknown size - show bytes received and simulate progress
            const kbReceived = receivedBytes / 1024;

            // Simulate progress based on typical firmware sizes (estimate 1MB)
            const estimatedSize = 1024 * 1024; // 1MB estimate
            const estimatedPercentage = Math.min(Math.round((receivedBytes / estimatedSize) * 100), 95);
            setDownloadProgress(estimatedPercentage);

            // Log every 256KB received
            if (Math.floor(kbReceived / 256) > Math.floor((receivedBytes - value.length) / 1024 / 256)) {
              addLog(`Downloaded: ${kbReceived.toFixed(1)} KB`);
            }
          }
        }

        if (cancelled) return;

        // Clear timeout since we completed successfully
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        addLog(`Assembling firmware from ${chunkCount} chunks (${receivedBytes} bytes)`);

        // Combine all chunks into single Uint8Array
        const data = new Uint8Array(receivedBytes);
        let offset = 0;
        for (const chunk of chunks) {
          data.set(chunk, offset);
          offset += chunk.length;
        }

        const filename = firmwareUrl.split("/").pop() || "firmware.bin";
        const sizeKB = (data.length / 1024).toFixed(1);

        setFirmware({ data, size: data.length, filename });
        setDownloadProgress(100);
        setState("connected");
        addLog(`✓ Firmware ready: ${filename} (${sizeKB} KB)`);

      } catch (err) {
        if (cancelled) {
          addLog("Download cancelled");
          return;
        }

        const message = err instanceof Error ? err.message : "Failed to download firmware";
        addLog(`✗ Download error: ${message}`);

        // Retry once for network errors
        if (retryCount === 0 && (message.includes("fetch") || message.includes("network") || message.includes("timeout"))) {
          addLog("Retrying download in 2 seconds...");
          setTimeout(() => {
            if (!cancelled) {
              downloadFirmwareWithRetry(1);
            }
          }, 2000);
          return;
        }

        setError(`Download failed: ${message}`);
        setState("error");
        setDownloadProgress(0);
      } finally {
        // Clean up timeout and reader
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (reader) {
          try {
            await reader.cancel();
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }

    downloadFirmwareWithRetry();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [firmwareUrl, firmware, state, addLog]);

  const terminal = {
    clean: () => setLog([]),
    writeLine: (data: string) => addLog(data),
    write: (data: string) => addLog(data),
  };

  const connect = useCallback(async () => {
    if (!isSupported) {
      setError("Web Serial API not supported. Use Chrome, Edge, or Opera on desktop.");
      return;
    }

    setState("connecting");
    setError(null);
    setChipInfo(null);
    setFirmware(null);

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

      // Get MAC address for identification
      try {
        const macAddr = await espLoaderRef.current.chip.readMac(espLoaderRef.current);
        addLog(`MAC Address: ${macAddr}`);
      } catch {
        // MAC reading is optional, don't fail connection
        addLog("Could not read MAC address");
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setState("error");
      setError(message);
      addLog(`Connection error: ${message}`);
    }
  }, [isSupported, addLog]);

  const disconnect = useCallback(async () => {
    try {
      if (transportRef.current) {
        await transportRef.current.disconnect();
        await transportRef.current.waitForUnlock(1500);
      }
    } catch {
      // Ignore disconnect errors
    }

    espLoaderRef.current = null;
    transportRef.current = null;
    setState("idle");
    setChipInfo(null);
    setProgress(0);
    setDownloadProgress(0);
    setFirmware(null);
    addLog("Disconnected");
  }, [addLog]);

  const flash = useCallback(async () => {
    if (!espLoaderRef.current || !firmware) {
      setError("Device not connected or firmware not ready");
      return;
    }

    setState("flashing");
    setProgress(0);
    setError(null);

    try {
      addLog(`Flashing firmware: ${firmware.filename}`);
      addLog("Erasing and writing flash memory...");

      // Convert Uint8Array to string for esptool-js
      const firmwareString = Array.from(firmware.data)
        .map((byte) => String.fromCharCode(byte))
        .join("");

      await espLoaderRef.current.writeFlash({
        fileArray: [{
          address: 0x0, // Flash merged firmware at start of memory
          data: firmwareString,
        }],
        flashSize: "keep",
        flashMode: "keep",
        flashFreq: "keep",
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const percentage = Math.round((written / total) * 100);
          setProgress(percentage);

          if (percentage % 10 === 0 || percentage === 100) {
            addLog(`Progress: ${percentage}%`);
          }
        },
        calculateMD5Hash: (image: string) => {
          // Return first 32 chars as simple hash for display
          return image.slice(0, 32);
        },
      });

      setState("done");
      addLog("✓ Firmware flashed successfully!");
      addLog("You can now disconnect your device or reset it to run the new firmware.");

    } catch (err) {
      const message = err instanceof Error ? err.message : "Flash operation failed";
      setState("error");
      setError(message);
      addLog(`Flash error: ${message}`);
    }
  }, [firmware, addLog]);

  const getStatusColor = () => {
    switch (state) {
      case "connected":
      case "done":
        return "bg-green-500";
      case "connecting":
      case "downloading":
      case "flashing":
        return "bg-yellow-500 animate-pulse";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (state) {
      case "idle":
        return "Ready to connect";
      case "connecting":
        return "Connecting to device...";
      case "connected":
        return firmware ? `Ready to flash: ${chipInfo || "ESP32"}` : "Preparing firmware...";
      case "downloading":
        return downloadProgress > 0
          ? `Downloading firmware... ${downloadProgress}%`
          : "Downloading firmware...";
      case "flashing":
        return `Flashing firmware... ${progress}%`;
      case "done":
        return "Flash complete!";
      case "error":
        return error || "Error occurred";
      default:
        return "Unknown state";
    }
  };

  if (!isSupported) {
    return (
      <div className="p-6 border border-red-500/30 bg-red-500/5 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold text-red-500">Browser Not Supported</span>
        </div>
        <p className="text-sm text-muted">
          Web Serial API is required for firmware flashing. Please use Chrome, Edge, or Opera on desktop.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
        <span className="font-medium">{getStatusText()}</span>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-lg">
          <div className="flex items-center gap-2 text-red-500 text-sm font-medium mb-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Error
          </div>
          <p className="text-sm text-muted">{error}</p>
        </div>
      )}

      {/* Download Progress Bar */}
      {state === "downloading" && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted">
            <span>Downloading firmware...</span>
            <span>{downloadProgress > 0 ? `${downloadProgress}%` : "In progress..."}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            {downloadProgress > 0 ? (
              <div
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress}%` }}
              />
            ) : (
              // Indeterminate progress bar for unknown size
              <div className="h-full bg-blue-500/20 relative overflow-hidden">
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-full"
                  style={{
                    animation: 'shimmer 1.5s ease-in-out infinite',
                    transform: 'translateX(-100%)'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flash Progress Bar */}
      {state === "flashing" && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted">
            <span>Flashing firmware...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {state === "idle" || state === "error" ? (
          <button
            onClick={connect}
            className="px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            Connect Device
          </button>
        ) : state === "connected" && firmware ? (
          <>
            <button
              onClick={flash}
              className="px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors"
            >
              Flash Firmware
            </button>
            <button
              onClick={disconnect}
              className="px-6 py-2.5 border border-border font-medium rounded-lg hover:bg-surface transition-colors"
            >
              Disconnect
            </button>
          </>
        ) : state === "done" ? (
          <button
            onClick={disconnect}
            className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Done
          </button>
        ) : (
          <button
            onClick={disconnect}
            disabled={state === "connecting" || state === "downloading" || state === "flashing"}
            className="px-6 py-2.5 border border-border font-medium rounded-lg hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Console Log */}
      {log.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none flex items-center justify-between p-3 border border-border rounded-lg hover:bg-surface/50 transition-colors">
            <span className="text-sm font-medium">Console Output</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{log.length} messages</span>
              <svg className="w-4 h-4 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </summary>
          <div className="mt-2 border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
              <span className="text-xs font-medium text-muted">Flash Log</span>
              <button
                onClick={() => setLog([])}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
            <pre className="p-3 text-xs font-mono leading-relaxed max-h-48 overflow-y-auto bg-background text-muted">
              {log.join("\n")}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}