# radar.iotivate.dev — Product & Architecture Specification

**Status:** Draft v2 (revised)
**Owner:** IoTivate
**Supersedes:** `radar_iotivate_dev_Product_Specification_v2.docx`

---

## 1. Purpose

`radar.iotivate.dev` is the **first cloud-connected product** in the IoTivate
ecosystem: mmWave radar sensors streaming live presence/motion data to a
browser dashboard, with a zones-and-rules engine for alerts and automation.

`iotivate.dev` stays exactly as it is — projects, tools, blog, docs, store.
Radar is **not** folded into the main site; it ships as its **own subdomain
and its own frontend**, but every IoTivate account works across both products.

> **One IoTivate account. Many products.** That shared account is the platform
> moat — not any single product.

---

## 2. Guiding architecture decisions

These are the decisions that shape everything below. They intentionally favor
**shipping the shared-account platform fast** over premature abstraction.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend | **One shared FastAPI backend** (extend the existing app) | Shared accounts require a single source of truth for users. One DB, one `User` table = trivially correct auth. |
| API exposure | **Dedicated `api.iotivate.dev`** | Both frontends (main + radar) call one clean API host. Cleanest CORS + cookie story for a multi-product platform. |
| Auth / SSO | **Shared refresh cookie on `.iotivate.dev`** | Reuses the existing access/refresh token design. One login works on every subdomain. No central auth service needed (yet). |
| Billing | **Reuse `is_pro` + Lemon Squeezy** | One IoTivate Pro unlocks radar Pro features. Matches the "one account" promise. |
| Radar frontend | **New Next.js app, separate Vercel project** at `radar.iotivate.dev` | Independent deploys and business logic; shares nothing but the API + design language. |
| Data models | **Concrete radar models now, extract generic core later** | `Device`/`User`/`Subscription` are shared; `RadarTelemetry`/`Zone`/`Rule` are radar-shaped. Don't force genericity before product #2 exists. |
| Ingest/WS layer | **Modular now, splittable later** (Redis-ready) | Long-lived ESP32 connections + high-frequency telemetry scale differently from CRUD. Keep it isolated so it can move to its own process without touching auth. |

---

## 3. System topology

```
iotivate.dev                 radar.iotivate.dev
(existing Next.js, Vercel)    (NEW Next.js, separate Vercel project)
        \                            /
         \   Authorization: Bearer  /
          \  + shared .iotivate.dev refresh cookie
           v                        v
                api.iotivate.dev
              (ONE FastAPI backend)
                       |
        ┌──────────────┴───────────────┐
   shared platform                 radar module
   • users / auth                  • /api/radar/* REST
   • billing (is_pro)              • /ws/radar   WebSocket ingest + fan-out
   • device registry               • zones / rules / actions engine
   • notifications                 • telemetry storage
                       |
                  one Postgres  (+ Redis for WS pub/sub, added when needed)

Device path:  mmWave radar → ESP32 → WSS → api.iotivate.dev → browser dashboard
```

The ESP32 authenticates with a **per-device token** and holds **one persistent
WebSocket** connection to `api.iotivate.dev`.

---

## 4. Shared account & SSO (the key mechanism)

The existing auth already issues two tokens:

- **Access token** — short-lived JWT, returned in the response body, held in
  memory per-app, sent as `Authorization: Bearer`.
- **Refresh token** — httponly cookie (`samesite=lax`, `path=/api/auth`).

**The only change required for cross-subdomain SSO:** set the refresh cookie's
domain to the parent.

```python
# backend/app/api/auth.py  →  _set_refresh_cookie()
kwargs["domain"] = ".iotivate.dev"   # leading dot → shared across all subdomains
```

Resulting flow:

1. User logs in on either `iotivate.dev` or `radar.iotivate.dev`.
2. Refresh cookie is written to `.iotivate.dev`.
3. The other subdomain loads → calls `POST /api/auth/refresh` → the shared
   cookie is sent automatically → it receives its own access token.
4. **One login, both products.**

**Supporting changes:**
- CORS: allow both `https://iotivate.dev` and `https://radar.iotivate.dev`
  origins, `allow_credentials=True`.
- Cookie must be `Secure` in production (already gated on HTTPS).
- Local dev: use a shared parent host (e.g. `iotivate.localhost` /
  `radar.iotivate.localhost`) so the `.iotivate.localhost` cookie behaves the
  same as production.

---

## 5. Accounts, users & devices

- **One user → many devices.**
- **One device → many users**, governed by a permission/role join
  (`owner` / `admin` / `viewer`).
- **Organizations / teams:** deferred (post-MVP), but the device↔user join is
  modeled so an `org_id` can slot in later.

**Device pairing:**
- Device is claimed to an IoTivate account via **QR code or short pairing code**.
- Pairing mints a **device token** the ESP32 uses to authenticate its WS
  connection. Tokens are revocable per device.

---

## 6. Dashboard features

- Live radar view
- XY target tracking
- Motion trails
- Heatmap
- Device health (RSSI, uptime, firmware, last-seen)
- Multi-device overview
- Floor-plan mode (upload/overlay a plan, place devices)
- Event timeline

---

## 7. Zones & rules engine (the differentiator)

Users **draw zones** on the radar map. Rules evaluate telemetry against zones.

**Rule triggers:** Enter · Exit · Dwell time · Occupancy threshold · Direction
· Armed schedule.

**Actions:**
- Dashboard alert
- Push notification
- Email / SMS
- Webhook
- MQTT publish
- **Trigger a remote ESP32 alarm** back over its WebSocket
- Database logging (event history)

---

## 8. Data model (radar module)

Concrete now; the generic core (`Device`, `Telemetry`, `Zone`, `Rule`,
`Action`) can be extracted when a second product needs it.

| Model | Notes |
|-------|-------|
| `User` | **Shared** — existing table, unchanged. |
| `Subscription` / `is_pro` | **Shared** — existing Lemon Squeezy integration. |
| `Device` | Device registry: id, owner, pairing state, device-token hash, type (`radar` now, extensible), health fields. Lives in shared platform layer. |
| `DeviceUser` | Many-to-many join with role/permission (`owner`/`admin`/`viewer`). |
| `RadarTelemetry` | Time-series target/point data. High write volume → partitioned/retention-managed; Pro unlocks history depth. |
| `Zone` | Polygon geometry on a device's coordinate space. |
| `Rule` | Trigger type + params, linked to a `Zone`, armed schedule. |
| `Action` | What fires when a rule matches (notification/webhook/mqtt/alarm/log). |
| `Event` | Log of fired rules for the event timeline. |

---

## 9. Monetization (reuses IoTivate Pro)

| Tier | Includes |
|------|----------|
| **Free** | Limited devices, live dashboard. |
| **Pro** (`is_pro`) | Zones, notifications, event history, analytics, multi-user sharing. |
| **Enterprise** | API access, white-label, on-premise, custom integrations. |

Radar Pro features gate on the **existing `is_pro`** flag (Lemon Squeezy).
One subscription, all products. Enterprise is a later, sales-led motion.

---

## 10. Development roadmap

Ordered so the **shared platform is proven first**, then radar-specific value.

| Phase | Deliverable |
|-------|-------------|
| 0 | **Cross-subdomain SSO** — `.iotivate.dev` refresh cookie, `api.iotivate.dev`, CORS. Prove one login works on a stub `radar.iotivate.dev`. |
| 1 | Radar Next.js app scaffold + shared auth/session hooks reused from main site. |
| 2 | Device registration & pairing (QR / pairing code, device tokens). |
| 3 | ESP32 ⇄ backend secure WebSocket (auth, connection manager). |
| 4 | Live radar dashboard (XY tracking, single device). |
| 5 | Multi-device support + device health. |
| 6 | Zones & rules engine + notifications. |
| 7 | Remote alarm action (ESP32 trigger over WS). |
| 8 | Analytics & history (Pro-gated depth). |
| 9 | Public landing page + SEO for `radar.iotivate.dev`. |

**Scaling checkpoint:** introduce **Redis pub/sub** for WS fan-out (and
consider splitting the ingest layer into its own process) when concurrent
device connections or telemetry throughput demand it — not before.

---

## 11. Open questions / to decide later

- Telemetry retention policy per tier (how much history is Free vs Pro?).
- Coordinate normalization across different radar modules/mounting.
- Org/team model timing (multi-tenant billing implications).
- MQTT: hosted broker vs. bring-your-own for the action target.
- Firmware/OTA path for the radar ESP32 (reuse a shared OTA service later).
