"use client";

import { useState, useCallback, useEffect } from "react";

interface BinaryFile {
  name: string;
  offset: string;
  file: File | null;
  data: Uint8Array | null;
  defaultOffset: string;
  description: string;
}

const DEFAULT_FILES: BinaryFile[] = [
  {
    name: "Bootloader",
    offset: "0x0",
    file: null,
    data: null,
    defaultOffset: "0x0",
    description: "First-stage bootloader (typically 32KB)",
  },
  {
    name: "Partition Table",
    offset: "0x8000",
    file: null,
    data: null,
    defaultOffset: "0x8000",
    description: "Flash memory layout definition",
  },
  {
    name: "Application",
    offset: "0x10000",
    file: null,
    data: null,
    defaultOffset: "0x10000",
    description: "Main application firmware",
  },
];

export default function FirmwareMerger() {
  const [files, setFiles] = useState<BinaryFile[]>(DEFAULT_FILES);
  const [mergedSize, setMergedSize] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLog = useCallback((msg: string) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
  }, []);

  const handleFileSelect = useCallback(async (index: number, file: File | null) => {
    if (!file) {
      setFiles(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], file: null, data: null };
        return updated;
      });
      return;
    }

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.bin')) {
      setError(`Invalid file type: ${file.name}. Only .bin files are allowed.`);
      return;
    }

    // Validate file size (reasonable limits)
    const maxSize = 8 * 1024 * 1024; // 8MB max per file
    if (file.size > maxSize) {
      setError(`File too large: ${file.name}. Maximum size is ${maxSize / (1024 * 1024)}MB.`);
      return;
    }

    setError(null);
    addLog(`Loading: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      setFiles(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], file, data };
        return updated;
      });

      addLog(`Loaded: ${file.name} successfully`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to read file";
      setError(msg);
      addLog(`Error loading ${file.name}: ${msg}`);
    }
  }, [addLog]);

  const handleOffsetChange = useCallback((index: number, offset: string) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], offset };
      return updated;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setFiles(prev => prev.map(file => ({
      ...file,
      offset: file.defaultOffset
    })));
  }, []);

  const validateConfiguration = useCallback(() => {
    const validFiles = files.filter(f => f.data && f.offset);
    if (validFiles.length === 0) {
      throw new Error("No firmware files selected");
    }

    // Parse and validate offsets
    const parsedFiles = validFiles.map(f => {
      const address = parseInt(f.offset, 16);
      if (isNaN(address) || address < 0) {
        throw new Error(`Invalid offset: ${f.offset}`);
      }
      return { ...f, address, endAddress: address + f.data!.length };
    });

    // Check for overlaps
    parsedFiles.sort((a, b) => a.address - b.address);
    for (let i = 0; i < parsedFiles.length - 1; i++) {
      const current = parsedFiles[i];
      const next = parsedFiles[i + 1];
      if (current.endAddress > next.address) {
        throw new Error(`Overlap detected: ${current.name} (ends at 0x${current.endAddress.toString(16)}) overlaps with ${next.name} (starts at 0x${next.address.toString(16)})`);
      }
    }

    return parsedFiles;
  }, [files]);

  const calculateMergedSize = useCallback(() => {
    // Clear any existing error when calculating size (don't show errors during normal interaction)
    setError(null);

    const validFiles = files.filter(f => f.data && f.offset);
    if (validFiles.length === 0) {
      setMergedSize(0);
      return;
    }

    try {
      // Parse and validate offsets for size calculation only
      const parsedFiles = validFiles.map(f => {
        const address = parseInt(f.offset, 16);
        if (isNaN(address) || address < 0) {
          throw new Error(`Invalid offset: ${f.offset}`);
        }
        return { ...f, address, endAddress: address + f.data!.length };
      });

      // Check for overlaps
      parsedFiles.sort((a, b) => a.address - b.address);
      for (let i = 0; i < parsedFiles.length - 1; i++) {
        const current = parsedFiles[i];
        const next = parsedFiles[i + 1];
        if (current.endAddress > next.address) {
          throw new Error(`Overlap detected: ${current.name} (ends at 0x${current.endAddress.toString(16)}) overlaps with ${next.name} (starts at 0x${next.address.toString(16)})`);
        }
      }

      // Calculate total size needed (highest end address)
      const maxEndAddress = Math.max(...parsedFiles.map(f => f.endAddress));
      setMergedSize(maxEndAddress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Configuration error";
      setError(msg);
      setMergedSize(0);
    }
  }, [files]);

  // Recalculate size when files or offsets change
  useEffect(() => {
    calculateMergedSize();
  }, [calculateMergedSize]);

  const mergeFirmware = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    addLog("Starting firmware merge process...");

    try {
      const validFiles = validateConfiguration();
      addLog(`Merging ${validFiles.length} firmware files...`);

      // Calculate total size needed
      const maxEndAddress = Math.max(...validFiles.map(f => f.endAddress));
      addLog(`Creating merged binary (${(maxEndAddress / 1024).toFixed(1)} KB)...`);

      // Create output buffer filled with 0xFF (flash default state)
      const mergedData = new Uint8Array(maxEndAddress);
      mergedData.fill(0xFF);

      // Copy each file to its designated offset
      for (const file of validFiles) {
        addLog(`Writing ${file.name} at offset 0x${file.address.toString(16).toUpperCase()}`);
        mergedData.set(file.data!, file.address);
      }

      // Create download blob
      const blob = new Blob([mergedData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `esp32-merged-firmware-${timestamp}.bin`;

      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog(`Merged firmware saved as: ${filename}`);
      addLog("Merge complete! Ready for flashing with: esptool.py write_flash 0x0 merged-firmware.bin");

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Merge failed";
      setError(msg);
      addLog(`Error: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  }, [validateConfiguration, addLog]);

  return (
    <div className="space-y-6">
      {/* Documentation */}
      <details className="group border border-border rounded-lg">
        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none text-sm font-medium hover:bg-surface/50 transition-colors">
          <span>About ESP32 Firmware Merging</span>
          <svg className="w-4 h-4 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 text-sm text-muted space-y-3 border-t border-border pt-3">
          <p>
            This tool merges separate ESP32 firmware binaries into a single file for production flashing.
            Instead of flashing three separate <code className="text-foreground bg-surface px-1 py-0.5 rounded text-xs">.bin</code> files
            at different offsets, you can flash one merged file at offset 0x0.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-1.5 pr-4 font-semibold text-foreground">Component</th>
                  <th className="py-1.5 pr-4 font-semibold text-foreground">Default Offset</th>
                  <th className="py-1.5 font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 pr-4">bootloader.bin</td>
                  <td className="py-1.5 pr-4 text-accent">0x0</td>
                  <td className="py-1.5">First-stage bootloader</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 pr-4">partitions.bin</td>
                  <td className="py-1.5 pr-4 text-accent">0x8000</td>
                  <td className="py-1.5">Partition table layout</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4">firmware.bin</td>
                  <td className="py-1.5 pr-4 text-accent">0x10000</td>
                  <td className="py-1.5">Application firmware</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs">
            <strong>Usage:</strong> Flash the merged binary with <code className="text-foreground bg-surface px-1 py-0.5 rounded">esptool.py write_flash 0x0 merged-firmware.bin</code>
          </p>
        </div>
      </details>

      {/* Error display */}
      {error && (
        <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-lg text-sm">
          <p className="font-semibold text-red-400">Error</p>
          <p className="text-red-300 mt-1">{error}</p>
        </div>
      )}

      {/* Firmware files configuration */}
      <div className="p-6 border border-border rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Firmware Files</h3>
          <button
            onClick={resetToDefaults}
            className="text-sm text-accent hover:underline"
            type="button"
          >
            Reset to defaults
          </button>
        </div>

        <div className="space-y-3">
          {files.map((entry, index) => (
            <div key={index} className="space-y-2">
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={entry.offset}
                  onChange={(e) => handleOffsetChange(index, e.target.value)}
                  placeholder="0x0"
                  className="w-24 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <input
                  type="file"
                  accept=".bin"
                  onChange={(e) => handleFileSelect(index, e.target.files?.[0] || null)}
                  className="flex-1 text-sm text-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-border file:text-sm file:font-medium file:bg-surface file:text-foreground hover:file:bg-border file:cursor-pointer file:transition-colors"
                />
              </div>
              <div className="ml-28 text-xs text-muted">
                <strong className="text-foreground">{entry.name}:</strong> {entry.description}
                {entry.file && (
                  <span className="ml-2 text-accent">
                    ({(entry.file.size / 1024).toFixed(1)} KB loaded)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Merged size info */}
        {mergedSize > 0 && (
          <div className="text-sm text-muted border-t border-border pt-3">
            <strong className="text-foreground">Merged size:</strong> {(mergedSize / 1024).toFixed(1)} KB ({mergedSize} bytes)
          </div>
        )}

        {/* Merge button */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={mergeFirmware}
            disabled={isProcessing || mergedSize === 0}
            className="px-5 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {isProcessing ? "Merging..." : "Merge Firmware"}
          </button>
        </div>

        <p className="text-xs text-muted">
          Select the three .bin files and click "Merge Firmware" to create a single binary for production flashing.
          The merged file can be flashed at offset 0x0 with any ESP32 flashing tool.
        </p>
      </div>
    </div>
  );
}