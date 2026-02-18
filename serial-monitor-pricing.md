# IoTivate Serial Monitor – Free vs Pro

The IoTivate Serial Monitor is designed to scale with you — from quick debugging to serious product development.

---

## Free (Always Free)

**Best for:** Beginners, quick debugging, first-time users evaluating iotivate.dev

### Features
- Connect to **1 device** at a time
- Live serial text stream
- Baud rate selection (300–921600)
- Clear terminal
- Copy output to clipboard
- UTF-8 / plain text display
- Auto-scroll
- Manual connect / disconnect
- Command history (arrow keys)
- Color-coded log levels (INFO / WARN / ERROR auto-detection)
- Hex view (receive display)
- DTR / RTS signal control
- Line ending selection (None / CR / LF / CRLF)
- Timestamps (millisecond precision)

> Enough to debug. Not enough to scale.

---

## Pro — $7/month (yearly option TBD)

**Best for:** Active developers, product debugging, multi-device testing, anyone who values time

### Implementation Phases

#### Phase 1 — Gate Existing + Subscription Infrastructure
Features already built, moved behind Pro gate:
- **Export logs** (.txt download)
- **Filter & search** (real-time substring matching)
- **Plotter** (canvas-based, multi-channel, auto-scaling)
- **Split view** (console + plotter side-by-side)
- **Macros** (save/run command macros with localStorage persistence)
- **Hex send** (transmit raw hex bytes)

#### Phase 2 — Enhanced Pro Features
New features to build:
- **CSV & JSON export** (extend current .txt-only export)
- **Regex filtering** (extend current substring-only filter)
- **JSON auto-detection & pretty print** (collapsible objects in log stream)
- **Bookmarks & annotations** (mark + annotate important log lines, quick jump)
- **Shareable log links** (generate read-only URL of a captured session — web-native, no desktop tool can do this)
- **Connection profiles** (save device configs: baud rate, line ending, DTR/RTS, macros — one-click load)

#### Phase 3 — Advanced Pro Features
Substantial new development:
- **Multi-device monitoring** (connect N devices, tabbed/split layout, synced timestamps, side-by-side comparison)
- **Command sequences** (chained macros with delays + response matching — lightweight hardware test runner)
- **Triggered capture** (start/stop logging on conditions: keyword match, line count, timeout)
- **Session management** (save/resume sessions, cloud-synced, named per device/project)
- **Persistent logs** across browser refresh
- **Custom themes** (dark / light / custom)

#### Phase 4 — Differentiator Features
- **Protocol decoders** (auto-detect and pretty-print AT commands, NMEA GPS, Modbus RTU, JSON-over-serial)
- **Early access to new tools**

---

## What stays out of Free (on purpose)

These should never be in Free:
- Multi-device connections
- Saved/persistent logs
- Exporting (any format)
- Filtering / search
- JSON tools
- Plotting
- Cloud sync
- Shareable links

> If Free has these, Pro loses its value.

---

## What stays in Free (on purpose)

These should never be gated:
- Command history (standard terminal UX)
- Color-coded log levels (basic debugging aid)
- Hex view receive (baseline embedded debugging)
- DTR/RTS control (hardware necessity)
- Timestamps (expected baseline)

> Gating these would feel punitive, not premium.

---

## How this converts

A user becomes Pro when they:
1. Refresh the page and lose logs
2. Want to export data
3. Debug two boards at once
4. Work on a real project (not a tutorial)
5. Need structure, not just text
6. Want to share a debug session with a teammate

> These moments happen naturally.

---

## Upgrade Prompt (non-annoying)

> "This feature is available with iotivate Pro.
> Upgrade to save sessions, export logs, and monitor multiple devices."

No popups. No guilt. Just clarity.
