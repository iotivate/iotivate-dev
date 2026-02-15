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
- Cloudflare Web Analytics gated on `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` env var
- Database backups via `backend/scripts/backup.sh` (pg_dump + gzip + retention)
- Alembic migrations in `backend/migrations/versions/`
