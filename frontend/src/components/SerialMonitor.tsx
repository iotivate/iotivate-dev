"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";

type ConnectionState = "disconnected" | "connecting" | "connected";

interface LogEntry {
  id: number;
  timestamp: Date;
  direction: "rx" | "tx";
  text: string;
  type: "normal" | "error" | "warning" | "info";
}

const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600];
const LINE_ENDINGS = [
  { label: "None", value: "" },
  { label: "CR", value: "\r" },
  { label: "LF", value: "\n" },
  { label: "CRLF", value: "\r\n" },
];

export default function SerialMonitor() {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [baudRate, setBaudRate] = useState(115200);
  const [lineEnding, setLineEnding] = useState("\n");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [hexView, setHexView] = useState(false);
  const [filter, setFilter] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [hexSend, setHexSend] = useState(false);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const logIdRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSupported = typeof navigator !== "undefined" && "serial" in navigator;

  const addLog = useCallback((direction: "rx" | "tx", text: string) => {
    const type = detectLogType(text);
    const entry: LogEntry = {
      id: logIdRef.current++,
      timestamp: new Date(),
      direction,
      text,
      type,
    };
    setLogs((prev) => [...prev.slice(-1000), entry]);
  }, []);

  function detectLogType(text: string): LogEntry["type"] {
    const lower = text.toLowerCase();
    if (lower.includes("error") || lower.includes("fail") || lower.includes("exception")) {
      return "error";
    }
    if (lower.includes("warn") || lower.includes("warning")) {
      return "warning";
    }
    if (lower.includes("info") || lower.includes("[i]")) {
      return "info";
    }
    return "normal";
  }

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  async function connect() {
    if (!isSupported) return;
    setState("connecting");

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      setState("connected");
      addLog("rx", `Connected at ${baudRate} baud`);

      // Start reading
      readLoop(port);
    } catch (err) {
      setState("disconnected");
      if (err instanceof Error && err.name !== "NotFoundError") {
        addLog("rx", `Error: ${err.message}`);
      }
    }
  }

  async function readLoop(port: SerialPort) {
    const decoder = new TextDecoder();
    let buffer = "";
    let flushTimeout: NodeJS.Timeout | null = null;

    const flushBuffer = () => {
      if (buffer.trim()) {
        addLog("rx", buffer);
        buffer = "";
      }
    };

    while (port.readable) {
      const reader = port.readable.getReader();
      readerRef.current = reader;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          // Clear pending flush since we got new data
          if (flushTimeout) {
            clearTimeout(flushTimeout);
            flushTimeout = null;
          }

          const text = decoder.decode(value, { stream: true });
          buffer += text;

          // Check if we have complete lines
          if (buffer.includes("\n") || buffer.includes("\r")) {
            const lines = buffer.split(/\r?\n|\r/);
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.length > 0) {
                addLog("rx", line);
              }
            }
          }

          // Flush partial data after 100ms of no new data
          if (buffer.length > 0) {
            flushTimeout = setTimeout(flushBuffer, 100);
          }
        }
      } catch (err) {
        // Flush remaining buffer on error/disconnect
        flushBuffer();
        if (err instanceof Error && err.name !== "NetworkError") {
          addLog("rx", `Read error: ${err.message}`);
        }
      } finally {
        if (flushTimeout) {
          clearTimeout(flushTimeout);
        }
        flushBuffer();
        reader.releaseLock();
      }
    }
  }

  async function disconnect() {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch {
      // Ignore close errors
    }
    setState("disconnected");
    addLog("rx", "Disconnected");
  }

  function parseHexInput(hexStr: string): Uint8Array | null {
    // Remove common separators and prefixes
    const cleaned = hexStr
      .replace(/0x/gi, "")
      .replace(/[,\s]+/g, " ")
      .trim();

    if (!cleaned) return null;

    const parts = cleaned.split(" ").filter(Boolean);
    const bytes: number[] = [];

    for (const part of parts) {
      // Handle pairs of hex digits
      const hex = part.replace(/[^0-9a-fA-F]/g, "");
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.slice(i, i + 2), 16);
        if (isNaN(byte)) return null;
        bytes.push(byte);
      }
    }

    return bytes.length > 0 ? new Uint8Array(bytes) : null;
  }

  async function send() {
    if (!portRef.current?.writable || !input.trim()) return;

    const writer = portRef.current.writable.getWriter();

    try {
      let data: Uint8Array;
      let logText: string;

      if (hexSend) {
        const hexData = parseHexInput(input);
        if (!hexData) {
          addLog("rx", "Invalid hex input. Use format: 48 65 6C 6C 6F or 0x48 0x65");
          writer.releaseLock();
          return;
        }
        data = hexData;
        logText = `[HEX] ${Array.from(hexData).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join(" ")}`;
      } else {
        const text = input + lineEnding;
        data = new TextEncoder().encode(text);
        logText = input;
      }

      await writer.write(data);
      addLog("tx", logText);

      // Add to history
      if (input.trim() && (commandHistory.length === 0 || commandHistory[0] !== input)) {
        setCommandHistory((prev) => [input, ...prev.slice(0, 49)]);
      }
      setHistoryIndex(-1);
      setInput("");
    } catch (err) {
      addLog("rx", `Send error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      writer.releaseLock();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  }

  function clearLogs() {
    setLogs([]);
    logIdRef.current = 0;
  }

  function exportLogs() {
    const text = logs
      .map((log) => {
        const ts = showTimestamps ? `[${formatTime(log.timestamp)}] ` : "";
        const dir = log.direction === "tx" ? ">> " : "<< ";
        return ts + dir + log.text;
      })
      .join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `serial-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyLogs() {
    const text = logs.map((log) => log.text).join("\n");
    navigator.clipboard.writeText(text);
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString("en-US", { hour12: false }) + "." + date.getMilliseconds().toString().padStart(3, "0");
  }

  function toHex(text: string): string {
    return Array.from(text)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase())
      .join(" ");
  }

  const filteredLogs = filter
    ? logs.filter((log) => log.text.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div className="space-y-4">
      {/* Browser support */}
      {!isSupported && (
        <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-lg text-sm">
          <p className="font-semibold">Web Serial API not supported</p>
          <p className="text-muted mt-1">Use Chrome, Edge, or Opera on desktop.</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {state === "disconnected" ? (
          <>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {BAUD_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate} baud
                </option>
              ))}
            </select>
            <button
              onClick={connect}
              disabled={!isSupported}
              className="px-4 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Connect
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-muted">{baudRate} baud</span>
            </div>
            <button
              onClick={disconnect}
              className="px-4 py-2 border border-border font-medium rounded-lg hover:bg-surface transition-colors text-sm"
            >
              Disconnect
            </button>
          </>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg border transition-colors ${showSettings ? "border-accent bg-accent/10" : "border-border hover:bg-surface"}`}
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="p-4 border border-border rounded-lg bg-surface/50 space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showTimestamps}
                onChange={(e) => setShowTimestamps(e.target.checked)}
                className="rounded border-border"
              />
              Timestamps
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-border"
              />
              Auto-scroll
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hexView}
                onChange={(e) => setHexView(e.target.checked)}
                className="rounded border-border"
              />
              Hex view
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hexSend}
                onChange={(e) => setHexSend(e.target.checked)}
                className="rounded border-border"
              />
              Hex send
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Line ending:</span>
              <select
                value={lineEnding}
                onChange={(e) => setLineEnding(e.target.value)}
                className="px-2 py-1 bg-background border border-border rounded text-sm"
              >
                {LINE_ENDINGS.map((le) => (
                  <option key={le.label} value={le.value}>
                    {le.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Filter and actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter logs..."
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button
          onClick={copyLogs}
          className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-surface transition-colors"
          title="Copy to clipboard"
        >
          Copy
        </button>
        <button
          onClick={exportLogs}
          className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-surface transition-colors"
          title="Download logs"
        >
          Export
        </button>
        <button
          onClick={clearLogs}
          className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-surface transition-colors"
          title="Clear console"
        >
          Clear
        </button>
      </div>

      {/* Console output */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
          <span className="text-xs font-medium text-muted">
            Console {filter && `(${filteredLogs.length}/${logs.length})`}
          </span>
          <span className="text-xs text-muted">{logs.length} lines</span>
        </div>
        <div className="h-80 overflow-y-auto bg-background font-mono text-sm">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted text-sm">
              {logs.length === 0 ? "No data yet. Connect to a device to start." : "No matches found."}
            </div>
          ) : (
            <div className="p-3 space-y-0.5">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex gap-2 py-0.5 ${
                    log.type === "error"
                      ? "text-red-400"
                      : log.type === "warning"
                      ? "text-yellow-400"
                      : log.type === "info"
                      ? "text-blue-400"
                      : log.direction === "tx"
                      ? "text-green-400"
                      : "text-foreground"
                  }`}
                >
                  {showTimestamps && (
                    <span className="text-muted text-xs shrink-0">[{formatTime(log.timestamp)}]</span>
                  )}
                  <span className="text-muted shrink-0">{log.direction === "tx" ? ">>" : "<<"}</span>
                  <span className="break-all">{hexView ? toHex(log.text) : log.text}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={state !== "connected" ? "Connect to send commands" : hexSend ? "Enter hex bytes: 48 65 6C 6C 6F or 0x48 0x65..." : "Type a command and press Enter..."}
          disabled={state !== "connected"}
          className="flex-1 px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={state !== "connected" || !input.trim()}
          className="px-5 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </div>

      {/* Help text */}
      <p className="text-xs text-muted">
        Tip: Use <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-xs">↑</kbd> and <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-xs">↓</kbd> to navigate command history.
      </p>
    </div>
  );
}
