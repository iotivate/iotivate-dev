# IoTivate Radar — Firmware Integration Guide

This is the contract the ESP32 firmware must implement to work with the IoTivate
Radar backend. The cloud side (pairing, secure WebSocket transport, dashboard,
zones/rules, alarms, analytics) is complete and stable; this document is
everything the device side needs.

> **Reference implementation:** `backend/scripts/simulate_device.py` is a working
> device in ~100 lines of Python. When in doubt about the wire protocol, read it —
> it pairs, streams telemetry, and prints received commands exactly as the
> firmware should behave.

---

## 1. Overview

```
  HLK-LD2450 ──UART──▶ ESP32 ──WSS──▶ IoTivate backend ──▶ browser dashboard
   (X/Y targets)        (firmware)     (auth, fan-out,        (live tracking,
                                        rules, alarms)         zones, alerts)
```

The device does four things:

1. **Pair once** — exchange a dashboard-issued pairing code for a long-lived
   device token (HTTP POST).
2. **Connect** — open an authenticated WebSocket to the backend.
3. **Stream telemetry** — send radar target frames continuously.
4. **React to commands** — handle inbound commands (currently: alarm on/off).

---

## 2. Configuration the firmware needs

| Value | How | Notes |
|-------|-----|-------|
| API base URL | Provisioned or compiled in | e.g. `https://api.iotivate.dev` (the deployment's backend host). |
| WiFi credentials | Provisioning (captive portal) recommended | Standard ESP32 WiFi setup. |
| Pairing code | Entered during provisioning | 8 chars, shown in the dashboard when the user adds a device. |
| Device token | **Obtained at pairing, stored in NVS/flash** | Persist it; it's only returned once. |

A typical provisioning flow: device boots into an AP/captive portal → user enters
WiFi + the pairing code from the dashboard → device pairs and stores the token →
reboots into normal operation.

---

## 3. Step 1 — Pairing (HTTP, once)

The user creates a device in the dashboard (`/radar/devices`) and gets an 8-char
pairing code (valid 15 minutes). The device submits it:

**Request**
```
POST {API}/api/devices/pair
Content-Type: application/json

{ "pairing_code": "ABCD2345", "firmware_version": "1.0.0" }
```

**Response `200`**
```json
{
  "device_id": 42,
  "name": "Living Room",
  "device_type": "radar",
  "device_token": "did_42.xK9s...urlsafe-secret..."
}
```

- **Store `device_token` permanently** (NVS). It is returned exactly once. Format
  is `did_<device_id>.<secret>` — treat it as an opaque bearer credential.
- `firmware_version` is optional but recommended; it's shown in the dashboard.

**Errors**
- `400` `{"detail":"Invalid or expired pairing code"}` — wrong/expired code; prompt re-provision.
- `429` — rate limited (10 pair attempts/min per IP). Back off.

Skip this entire step on subsequent boots if a token is already stored.

---

## 4. Step 2 — Connect the WebSocket

```
{WS}/ws/radar/device
```

where `{WS}` is the API base with `https`→`wss` (`http`→`ws` for local dev).

**Authenticate** with the device token. Two options — **prefer the header**
(the ESP32 can set WebSocket headers, unlike browsers, and it keeps the token out
of URLs/logs):

```
Authorization: Bearer did_42.xK9s...
```

Fallback (only if your WS client can't set headers):
```
{WS}/ws/radar/device?token=did_42.xK9s...      (URL-encode the token)
```

**Connection rules**
- If the token is missing/invalid, the server **closes with code `1008`** before
  accepting — do not retry rapidly; re-check the token.
- Only **one** device connection is live at a time. If the device reconnects, the
  previous socket is closed with code **`1012`** (superseded). Don't treat `1012`
  on your *old* socket as an error.
- The server tracks online/offline and last-seen automatically — no heartbeat
  frame is required from the device (just keep the socket open and stream).
- **Reconnect** with capped exponential backoff on any drop; resume streaming.

Use TLS (`wss`) in production. Validate the server certificate.

---

## 5. Step 3 — Stream telemetry (device → server)

Send JSON **text** frames as targets update:

```json
{
  "type": "telemetry",
  "seq": 1234,
  "targets": [
    { "x": 1.52, "y": 3.10, "velocity": -0.4, "strength": 80 },
    { "x": -0.80, "y": 2.05 }
  ]
}
```

**Schema (strict — unknown keys are rejected):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | string | yes | Must be exactly `"telemetry"`. |
| `seq` | int ≥ 0 | no | Frame counter; useful for debugging/ordering. |
| `targets` | array | yes | **Max 64.** Empty array `[]` = area clear. |
| `targets[].x` | float | yes | Metres, lateral (see §7). |
| `targets[].y` | float | yes | Metres, forward distance from the sensor. |
| `targets[].velocity` | float | no | Metres/second (sign = toward/away). |
| `targets[].strength` | float | no | Optional signal strength/quality. |

- **Send an empty `targets: []` frame when the zone clears** — the rules engine
  needs it to detect Exit and to end Dwell/Occupancy episodes. Don't just stop
  sending.
- If a frame fails validation, the server replies
  `{"type":"error","detail":"invalid frame"}` and **keeps the connection open** —
  fix the frame; you don't need to reconnect.
- **Rate:** 5–10 Hz is a good default (matches the LD2450). Do not exceed ~20 Hz.

### Mapping the HLK-LD2450

The LD2450 reports up to 3 moving targets over UART (default **256000 baud**),
each with position in **millimetres** and speed in **cm/s**, where X is lateral
and Y is distance from the sensor. Convert to the telemetry schema:

```
x  = target_x_mm / 1000.0      // mm  → m
y  = target_y_mm / 1000.0      // mm  → m
velocity = target_speed_cms / 100.0   // cm/s → m/s  (optional)
```

Drop empty/zeroed target slots. Emit one frame per LD2450 report (or throttle to
your chosen rate). `strength` can be omitted (the LD2450 exposes a distance
resolution rather than an RSSI).

---

## 6. Step 4 — Handle commands (server → device)

Read inbound WebSocket text frames. Today there is one command type: **alarm**.

```json
{ "type": "command", "command": "alarm", "state": "on", "duration_ms": 10000 }
```

- `state: "on"` → activate the buzzer/relay.
- `state: "off"` → deactivate it.
- `duration_ms` (optional) → **auto-off after this many ms even if no `off`
  arrives.** Implement this device-side timeout; it's the safety net if the
  network drops before the `off` command.

The device may also receive `{"type":"error", ...}` frames (responses to invalid
telemetry) — log and ignore. Ignore unknown message types so future additions
don't break older firmware.

---

## 7. Coordinate system

The dashboard renders the sensor at the origin, looking **forward along +Y**:

```
              +Y (metres, away from sensor)
               │
   ─x ─────────●───────── +x   (metres, lateral: left −, right +)
            (sensor)
```

- `y` is distance in front of the sensor (always ≥ 0 for real targets).
- `x` is lateral offset: negative left, positive right.
- Units are **metres**. Mount the sensor upright with a clear view; keep its
  orientation consistent with this convention (coordinate normalization across
  mounting angles is a possible future firmware/config feature).

---

## 8. Security notes

- Store the device token in NVS; never log it or expose it over serial in
  production builds.
- Prefer the `Authorization` header over the `?token=` query param.
- One device = one token. Re-pairing (dashboard "Re-pair") issues a **new** token;
  the device should re-run §3 and replace the stored token.
- Use `wss://` with certificate validation.

---

## 9. MVP acceptance checklist

- [ ] Reads WiFi + pairing code via provisioning; pairs and persists the token.
- [ ] Reconnects on boot using the stored token (no re-pair needed).
- [ ] Opens `wss` with `Authorization: Bearer <token>`; reconnects with backoff.
- [ ] Streams LD2450 targets as `telemetry` frames (mm→m), incl. empty `[]` on clear.
- [ ] Respects the 64-target cap and ~≤20 Hz rate; keeps `seq` incrementing.
- [ ] Handles the `alarm` command (on/off) and the `duration_ms` device-side timeout.
- [ ] Reports `firmware_version` at pairing.

Validate against the running backend the same way the browser does: flash via
`/radar/flash`, pair via `/radar/devices`, and confirm live targets + a rule-fired
alarm on the device dashboard.
