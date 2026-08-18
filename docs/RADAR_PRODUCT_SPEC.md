# iotivate.dev/radar — Product & Architecture Specification

**Status:** Draft v3 (path-based)
**Owner:** IoTivate
**Supersedes:** `radar_iotivate_dev_Product_Specification_v2.docx`, Draft v2 (subdomain)

---

## 1. Purpose

IoTivate Radar is the **first cloud-connected product** in the IoTivate
ecosystem: mmWave radar sensors streaming live presence/motion data to a
browser dashboard, with a zones-and-rules engine for alerts and automation.

It ships as a **section of the existing site at `iotivate.dev/radar`** —
routes inside the current Next.js app, not a separate subdomain. Because it is
the same origin as the rest of the site, it shares the session, navigation, and
account natively: no cross-origin auth plumbing. The rest of `iotivate.dev`
(projects, tools, blog, docs, store) is unchanged; radar is simply new routes
alongside them.

> **One IoTivate account. Many products.** The shared account is the platform
> moat — and with radar as a path on the main site, that sharing is free.

> **Design note (v3):** an earlier draft shipped radar as a separate subdomain
> (`radar.iotivate.dev`) with a shared `.iotivate.dev` refresh cookie for
> cross-subdomain SSO. That was reversed in favor of a same-origin path, which
> removes the cookie-domain/CORS complexity entirely. If a future white-label /
> multi-domain play (see `PATH_TO_SCALE.md`) needs auth across *different*
> origins, revisit the subdomain approach then.

---

## 2. Guiding architecture decisions

These are the decisions that shape everything below. They intentionally favor
**shipping the shared-account platform fast** over premature abstraction.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend | **One shared FastAPI backend** (extend the existing app) | Shared accounts require a single source of truth for users. One DB, one `User` table = trivially correct auth. |
| API exposure | **Existing API host** (`NEXT_PUBLIC_API_URL`) | The one frontend calls the one backend, exactly as it does today. No new API subdomain required for radar. |
| Auth / SSO | **Native — same origin** | Radar routes live in the main app, so they share its session and auth context directly. Nothing to configure. |
| Billing | **Reuse `is_pro` + Lemon Squeezy** | One IoTivate Pro unlocks radar Pro features. Matches the "one account" promise. |
| Radar frontend | **Routes in the existing Next.js app** under `/radar`, same Vercel project | Reuses the site's auth, nav, and design system; no separate deploy or duplicated auth code. |
| Data models | **Concrete radar models now, extract generic core later** | `Device`/`User`/`Subscription` are shared; `RadarTelemetry`/`Zone`/`Rule` are radar-shaped. Don't force genericity before product #2 exists. |
| Ingest/WS layer | **Modular now, splittable later** (Redis-ready) | Long-lived ESP32 connections + high-frequency telemetry scale differently from CRUD. Keep it isolated so it can move to its own process without touching auth. |

---

## 3. System topology

```
              iotivate.dev  (existing Next.js, Vercel)
        /projects  /tools  /blog  /store        /radar   ← new routes
                              |
                   Authorization: Bearer (same site session)
                              v
                     existing FastAPI backend
                              |
        ┌──────────────┴───────────────┐
   shared platform                 radar module
   • users / auth                  • /api/radar/* REST
   • billing (is_pro)              • /ws/radar   WebSocket ingest + fan-out
   • device registry               • zones / rules / actions engine
   • notifications                 • telemetry storage
                              |
                  one Postgres  (+ Redis for WS pub/sub, added when needed)

Device path:  mmWave radar → ESP32 → WSS → backend → browser dashboard
```

The browser dashboard is served from `iotivate.dev/radar`. The ESP32
authenticates with a **per-device token** and holds **one persistent WebSocket**
connection to the backend.

---

## 4. Shared account (native, same-origin)

Because radar is a set of routes inside the existing site, it runs on the same
origin as the rest of `iotivate.dev` and reuses the app's auth context
directly. The existing two-token design is unchanged:

- **Access token** — short-lived JWT, returned in the response body, held in
  memory, sent as `Authorization: Bearer`.
- **Refresh token** — httponly cookie (`samesite=lax`, `path=/api/auth`), set
  host-only by the API exactly as it is today.

A user signed in anywhere on the site is signed in on `/radar` — there is no
second login and **no cross-origin cookie, CORS, or domain configuration** to
manage. Radar pages call `POST /api/auth/refresh` through the same
`authFetch`/`AuthProvider` the rest of the app uses.

> This is the payoff of the v3 path-based decision: the entire cross-subdomain
> SSO mechanism the v2 draft required simply doesn't exist here.

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
| 0 | **Radar section scaffold** — `/radar` routes in the existing app, reusing its auth context (same-origin, so SSO is native — no cookie/CORS work). |
| 1 | Radar landing + navigation entry; auth-gated `/radar` area wired to the shared session. |
| 2 | Device registration & pairing (QR / pairing code, device tokens). |
| 3 | ESP32 ⇄ backend secure WebSocket (auth, connection manager). |
| 4 | Live radar dashboard (XY tracking, single device). |
| 5 | Multi-device support + device health. |
| 6 | Zones & rules engine + notifications. |
| 7 | Remote alarm action (ESP32 trigger over WS). |
| 8 | Analytics & history (Pro-gated depth). |
| 9 | Public landing page + SEO for `iotivate.dev/radar`. |

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
