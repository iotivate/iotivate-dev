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
