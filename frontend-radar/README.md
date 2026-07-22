# frontend-radar

The Next.js frontend for **radar.iotivate.dev** — the first cloud-connected
IoTivate product (mmWave radar → ESP32 → WebSocket → browser dashboard). It is a
separate app on its own subdomain that shares one IoTivate account with the main
site via cross-subdomain SSO. See `docs/RADAR_PRODUCT_SPEC.md`.

## Status: Phase 1 scaffold

This is the initial scaffold. It reuses the main site's auth context
(`src/lib/auth.tsx`, kept in sync with `frontend/src/lib/auth.tsx`) and ships a
single landing page that proves single sign-on: on load it exchanges the shared
`.iotivate.dev` refresh cookie for an access token and shows the signed-in user
with no separate login. The radar dashboard, device pairing, and WebSocket
telemetry land in later phases.

## Local dev

Full setup — hosts, backend env, ports — is in
`docs/LOCAL_SUBDOMAIN_DEV.md`. In short:

```
cp .env.example .env.local
npm install
npm run dev            # serves on port 3001
```

Then open `http://radar.iotivate.localhost:3001`. To exercise SSO, sign in
first on the main site at `http://iotivate.localhost:3000` and reload this app —
it should show you signed in without a second login.

The `dev` script binds the port only; you reach it via the
`radar.iotivate.localhost` hostname (resolved by Chrome/Firefox automatically,
or via `/etc/hosts` for other browsers — see the setup doc).
