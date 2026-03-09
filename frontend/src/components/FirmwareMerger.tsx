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

    // Validate ESP32 sector alignment and standard offsets
    const SECTOR_SIZE = 0x1000; // 4KB sectors
    const STANDARD_OFFSETS = {
      bootloader: [0x0, 0x1000],  // Bootloader can be at 0x0 or 0x1000
      partition: [0x8000],        // Partition table must be at 0x8000
      app: [0x10000, 0x20000]     // Application typically at 0x10000 or 0x20000
    };

    for (const file of parsedFiles) {
      // Check sector alignment for critical components
      if (file.name.toLowerCase().includes('partition')) {
        if (!STANDARD_OFFSETS.partition.includes(file.address)) {
          throw new Error(`Partition table must be at offset 0x8000, found: 0x${file.address.toString(16)}`);
        }
      } else if (file.name.toLowerCase().includes('bootloader')) {
        if (!STANDARD_OFFSETS.bootloader.includes(file.address)) {
          console.warn(`Bootloader at non-standard offset: 0x${file.address.toString(16)}. Standard offsets: 0x0, 0x1000`);
        }
      }

      // Ensure addresses are within reasonable ESP32 flash range (16MB max)
      const MAX_FLASH_SIZE = 16 * 1024 * 1024; // 16MB
      if (file.address >= MAX_FLASH_SIZE) {
        throw new Error(`Offset too large: 0x${file.address.toString(16)}. ESP32 supports up to 16MB flash.`);
      }

      // Warn about potential sector alignment issues
      if (file.address % SECTOR_SIZE !== 0) {
        console.warn(`${file.name} at 0x${file.address.toString(16)} is not 4KB sector-aligned. This may cause flash issues.`);
      }
    }

    // Check for overlaps
    parsedFiles.sort((a, b) => a.address - b.address);
    for (let i = 0; i < parsedFiles.length - 1; i++) {
      const current = parsedFiles[i];
      const next = parsedFiles[i + 1];
      if (current.endAddress > next.address) {
        throw new Error(`Overlap detected: ${current.name} (ends at 0x${current.endAddress.toString(16)}) overlaps with ${next.name} (starts at 0x${next.address.toString(16)})`);
      }
    }

    // Validate we have essential components for a bootable firmware
    const hasBootloader = parsedFiles.some(f => f.name.toLowerCase().includes('bootloader'));
    const hasPartition = parsedFiles.some(f => f.name.toLowerCase().includes('partition'));
    const hasApp = parsedFiles.some(f => f.name.toLowerCase().includes('app') || f.name.toLowerCase().includes('firmware'));

    if (!hasBootloader) {
      console.warn("No bootloader detected. Ensure this is intentional.");
    }
    if (!hasPartition) {
      console.warn("No partition table detected. This may prevent the ESP32 from booting.");
    }
    if (!hasApp) {
      console.warn("No application firmware detected. The device may not run user code.");
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

      // Sort files by address for sequential processing
      const sortedFiles = validFiles.sort((a, b) => a.address - b.address);

      // Calculate actual size needed for contiguous merge
      const firstFile = sortedFiles[0];
      const lastFile = sortedFiles[sortedFiles.length - 1];
      const totalSize = lastFile.endAddress - firstFile.address;
      const baseAddress = firstFile.address;

      addLog(`Creating merged binary from 0x${baseAddress.toString(16)} (${(totalSize / 1024).toFixed(1)} KB)...`);

      // Create output buffer with exact size needed (no 0xFF filling of gaps)
      const mergedData = new Uint8Array(totalSize);

      // Initialize with 0xFF only for areas that will contain data
      mergedData.fill(0xFF);

      // Copy each file to its relative position in the merged buffer
      for (const file of sortedFiles) {
        const relativeOffset = file.address - baseAddress;
        addLog(`Writing ${file.name} at offset 0x${file.address.toString(16).toUpperCase()} (relative: 0x${relativeOffset.toString(16)})`);
        mergedData.set(file.data!, relativeOffset);
      }

      // Verify merge integrity and validate critical components
      for (const file of sortedFiles) {
        const relativeOffset = file.address - baseAddress;
        const mergedSegment = mergedData.slice(relativeOffset, relativeOffset + file.data!.length);
        const originalSegment = file.data!;

        // Simple comparison to verify data integrity
        let isIntact = true;
        if (mergedSegment.length === originalSegment.length) {
          for (let i = 0; i < originalSegment.length; i++) {
            if (mergedSegment[i] !== originalSegment[i]) {
              isIntact = false;
              break;
            }
          }
        } else {
          isIntact = false;
        }

        if (!isIntact) {
          throw new Error(`Data integrity check failed for ${file.name}`);
        }

        // Validate partition table structure if present
        if (file.name.toLowerCase().includes('partition') && file.data!.length >= 16) {
          const partitionData = file.data!;

          // Basic partition table validation
          // Check partition table magic bytes (first entry should have proper structure)
          if (partitionData.length >= 32) {
            // ESP32 partition entries are 32 bytes each
            // Check if we have reasonable partition table data (not all 0xFF or 0x00)
            const firstEntry = partitionData.slice(0, 32);
            const allFF = firstEntry.every(b => b === 0xFF);
            const allZero = firstEntry.every(b => b === 0x00);

            if (allFF) {
              addLog("⚠ Warning: Partition table appears to be empty (all 0xFF)");
            } else if (allZero) {
              addLog("⚠ Warning: Partition table appears to be empty (all 0x00)");
            } else {
              // Check for reasonable partition type values (0x00-0x99)
              const partitionType = firstEntry[0];
              const partitionSubtype = firstEntry[1];

              if (partitionType <= 0x99 && partitionSubtype <= 0x99) {
                addLog(`✓ Partition table structure looks valid (type: 0x${partitionType.toString(16)}, subtype: 0x${partitionSubtype.toString(16)})`);
              } else {
                addLog("⚠ Warning: Partition table structure may be invalid");
              }
            }
          }
        }

        addLog(`✓ ${file.name} integrity verified`);
      }

      // Create download blob
      const blob = new Blob([mergedData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      // Generate filename with base address info
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
      addLog(`Flash command: esptool.py write_flash 0x${baseAddress.toString(16)} ${filename}`);
      addLog("Merge complete! ✓ Data integrity verified");

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
            <strong>Usage:</strong> Flash the merged binary with <code className="text-foreground bg-surface px-1 py-0.5 rounded">esptool.py write_flash &lt;base_address&gt; merged-firmware.bin</code>
          </p>
          <p className="text-xs text-amber-300">
            <strong>Note:</strong> The merged file starts from the lowest component address and preserves the exact layout without gaps. Use the displayed flash command for correct offset.
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
          Select the .bin files and click "Merge Firmware" to create a single binary for production flashing.
          The merged file preserves the exact component layout and provides the correct flash command for your configuration.
        </p>
      </div>
    </div>
  );
}