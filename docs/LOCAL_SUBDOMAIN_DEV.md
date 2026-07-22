# Local cross-subdomain SSO dev setup

Phase 0 of the radar workstream (see `RADAR_PRODUCT_SPEC.md` §4) needs one
login to work across `iotivate.dev` and `radar.iotivate.dev`. That hinges on a
refresh cookie scoped to the shared parent domain. To exercise it locally the
browser must see the apps on real subdomains of a shared parent — `localhost`
alone can't reproduce it, because a host-only cookie on `localhost` is never
shared.

This mirrors production topology with a `.localhost` parent:

| Prod                     | Local dev                          |
| ------------------------ | ---------------------------------- |
| `iotivate.dev`           | `iotivate.localhost:3000`          |
| `radar.iotivate.dev`     | `radar.iotivate.localhost:3001`    |
| `api.iotivate.dev`       | `api.iotivate.localhost:8000`      |
| cookie `.iotivate.dev`   | cookie `iotivate.localhost`        |

The API lives on a subdomain of the cookie's parent so the shared refresh
cookie is sent with credentialed requests to it.

## 1. Host resolution

Chrome and Firefox already resolve any `*.localhost` name to `127.0.0.1`, so no
change is needed for them. Safari and non-browser tooling do **not**, so for a
reliable cross-browser setup add the names to `/etc/hosts` (needs sudo — run it
yourself; in this CLI you can prefix with `!`):

```
sudo sh -c 'printf "127.0.0.1 iotivate.localhost radar.iotivate.localhost api.iotivate.localhost\n" >> /etc/hosts'
```

## 2. Backend env (`backend/.env`)

```
CORS_ORIGINS=http://iotivate.localhost:3000,http://radar.iotivate.localhost:3001
COOKIE_DOMAIN=iotivate.localhost
FRONTEND_URL=http://iotivate.localhost:3000
```

`COOKIE_DOMAIN` stays without a leading dot here; RFC 6265 treats
`iotivate.localhost` and `.iotivate.localhost` identically. The cookie stays
non-`Secure` because `FRONTEND_URL` is `http://` (the `Secure` flag is gated on
HTTPS), which is what lets it work over plain-http localhost.

Run the API on the api host:

```
cd backend && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 3. Frontend env (`frontend/.env.local`)

```
NEXT_PUBLIC_API_URL=http://api.iotivate.localhost:8000
NEXT_PUBLIC_SITE_URL=http://iotivate.localhost:3000
```

Run the main site on its host and port:

```
cd frontend && next dev -H iotivate.localhost -p 3000
```

The radar app (Phase 1, not built yet) will run the same way on
`radar.iotivate.localhost:3001`.

## 4. Verify

Server-side behavior is covered by `tests/test_auth.py::TestRefreshCookieDomain`
and was confirmed against a live uvicorn: login from the radar origin returns
`Set-Cookie: refresh_token=…; Domain=iotivate.localhost; HttpOnly;
Path=/api/auth; SameSite=lax`, the credentialed CORS preflight passes for both
subdomain origins, an unlisted origin is refused, and `POST /api/auth/refresh`
with the shared cookie returns `200`.

The remaining check is the real browser round-trip, which needs the radar app
(Phase 1) to exist: log in on `iotivate.localhost:3000`, open
`radar.iotivate.localhost:3001`, and confirm it bootstraps a session via
`POST /api/auth/refresh` without a second login. Because `.localhost` shares the
`iotivate.localhost` registrable domain, those requests are same-site, so the
`SameSite=Lax` cookie is sent — the same property that holds in production under
`.iotivate.dev`.
