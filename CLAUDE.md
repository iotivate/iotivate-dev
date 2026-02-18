# Project Guidelines — iotivate.dev

## Standards
- Always validate inputs properly (email fields use EmailStr, required fields enforced, etc.)
- Treat this as a production-grade startup codebase, not a tutorial
- Every endpoint must have proper validation, error handling, and appropriate HTTP status codes
- Use Pydantic models with strict types for all request/response schemas
- Never skip security basics: input validation, CORS, auth checks, SQL injection prevention

## Tech Stack
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS
- Backend: FastAPI, SQLModel, PostgreSQL (SQLite for dev)
- Auth: JWT via python-jose, bcrypt for password hashing (not passlib)
- Brand color: teal #5BA8A0 (light), #6BB8B0 (dark)

## Architecture Decisions
- Backend API routes prefixed with /api
- OAuth2PasswordRequestForm for login (form-based, not JSON)
- Frontend falls back to static data when backend is unreachable
- Web Serial API types declared in src/types/web-serial.d.ts
- All list endpoints return paginated `{items, total, skip, limit}` shape
- Frontend `PaginatedResponse<T>` interface in `src/lib/api.ts`
- Admin pages use reusable `Pagination` component from `src/components/admin/Pagination.tsx`
- Webhook events logged to `WebhookEvent` table (processed/failed/ignored)
- R2 file cleanup runs automatically on project delete via `app/services/r2_cleanup.py`
- Cloudflare Web Analytics via edge (automatic for proxied domains, no JS snippet needed)
- Database backups via `backend/scripts/backup.sh` (pg_dump + gzip + retention)
- Alembic migrations in `backend/migrations/versions/`

## Subscription System (iotivate Pro)
- Simple `is_pro` computed property on User model (not a separate tier table)
- Subscription fields: `lemon_subscription_id`, `subscription_status`, `subscription_ends_at`, `subscription_updated_at`
- `is_pro` returns True for `active`/`on_trial` status, or `cancelled` with future `subscription_ends_at` (grace period)
- Billing via Lemon Squeezy: `POST /api/subscribe` (monthly/yearly), webhooks extend existing handler
- Subscription webhooks: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_payment_failed`
- Customer portal: `POST /api/subscription/portal` fetches URL from LS API
- Frontend `usePro()` hook in `src/lib/auth.tsx`, `ProGate` component in `src/components/ProGate.tsx`
- Serial Monitor gated features (Phase 1): export, filter, plotter, split view, macros, hex send
- Serial Monitor free features: connect, console, baud rate, copy, auto-scroll, command history, hex view (receive), DTR/RTS, timestamps
- Pro pricing page at `/pro`, admin users page at `/admin/users`
