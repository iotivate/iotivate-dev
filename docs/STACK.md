# Tech Stack — iotivate.dev

Reference for the technologies, services, and key libraries powering iotivate.
Versions reflect `frontend/package.json` and `backend/requirements.txt`.

---

## Frontend

- **Next.js 16.1.6** (App Router) + **React 19.2.3**
- **TypeScript 5**
- **Tailwind CSS 4** (`@tailwindcss/postcss`)
- **MDX** content pipeline — `@next/mdx`, `@mdx-js/react`, `next-mdx-remote`,
  `gray-matter` (frontmatter)
- **Three.js 0.183** (`@types/three`) — 3D visuals
- **esptool-js 0.5.7** + **js-md5** — in-browser ESP32 flashing (Web Serial API)
- **Testing:** Vitest 4, Testing Library (React/jest-dom/user-event), jsdom
- **Lint:** ESLint 9 + `eslint-config-next`
- Deployed on **Vercel**
- Falls back to static data when the backend is unreachable
- Web Serial API types declared in `src/types/web-serial.d.ts`

## Backend

- **FastAPI** (>=0.115) on **Uvicorn** (standard)
- **SQLModel** (>=0.0.22) ORM over **PostgreSQL** (prod) / **SQLite** (dev)
- **Pydantic v2** with `pydantic[email]` (EmailStr) + `pydantic-settings`
- **psycopg2-binary** Postgres driver
- **Alembic** migrations in `backend/migrations/versions/`
- **slowapi** rate limiting
- **bleach** HTML sanitization
- **python-json-logger** structured logging
- **Testing:** pytest 8, httpx
- API routes prefixed with `/api`
- List endpoints return paginated `{items, total, skip, limit}`

## Auth

- **JWT** via **python-jose** (`[cryptography]`)
- **bcrypt** (>=4.0) for password hashing — deliberately *not* passlib
- Login uses **OAuth2PasswordRequestForm** (form-based, not JSON)
- `python-multipart` for form handling

## Infrastructure & Services

- **Cloudflare R2** object storage via **boto3** — auto-cleanup on project
  delete (`app/services/r2_cleanup.py`)
- **Lemon Squeezy** billing/subscriptions (iotivate Pro); webhooks logged to
  the `WebhookEvent` table (processed/failed/ignored)
- **Cloudflare Web Analytics** — JS beacon in `layout.tsx` (site on Vercel,
  not proxied through the CF edge)
- DB backups via `backend/scripts/backup.sh` (pg_dump + gzip + retention)

## Product Surface

- **Serial Monitor** and **ESP32 WebFlasher** — browser tools built on the
  Web Serial API
- **iotivate Pro** subscription gating — `is_pro` computed property on the
  User model, `usePro()` hook (`src/lib/auth.tsx`), `ProGate` component
  (`src/components/ProGate.tsx`)

## Brand

- Teal: `#5BA8A0` (light) / `#6BB8B0` (dark)
