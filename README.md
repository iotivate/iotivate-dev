# iotivate.dev

**Simplifying IoT, One Module at a Time.**

A platform for web-based IoT tools, project showcases, and ESP32 development resources.

## Project Structure

```
iotivate.dev/
├── frontend/          # Next.js (React, Tailwind CSS, App Router)
├── backend/           # FastAPI (Python, SQLModel)
└── README.md
```

## Frontend

**Stack:** Next.js, TypeScript, Tailwind CSS, App Router

### Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Runs at `http://localhost:3000`.

### Pages

| Route | Description |
|-------|-------------|
| `/` | Homepage |
| `/tools` | Tools hub |
| `/tools/esp32-web-flasher` | ESP32 Web Flasher (placeholder) |
| `/tools/wirelessear-installer` | WirelessEar Installer (placeholder) |
| `/projects` | Project showcase |
| `/blog` | Blog (placeholder) |
| `/about` | About page |
| `/contact` | Contact form |

## Backend

**Stack:** FastAPI, SQLModel, SQLite (dev) / PostgreSQL (prod)

### Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### Run

```bash
uvicorn app.main:app --reload
```

Runs at `http://localhost:8000`. API docs at `/docs`.

### Seed Data

```bash
python -m app.seed
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/tools/` | List all tools |
| `GET` | `/api/tools/{slug}` | Get tool by slug |
| `GET` | `/api/projects/` | List all projects |
| `GET` | `/api/projects/{slug}` | Get project by slug |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./iotivate.db` | Database connection string |
| `SECRET_KEY` | `change-me-in-production` | JWT signing key |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |

### Deployment (Render)

The backend is one shared FastAPI app (site + radar) deployed as a single Render
Web Service. Migrations run automatically on startup, so a normal redeploy picks
up new tables (e.g. radar's) with no manual DB step.

**⚠️ Single worker / single instance.** Radar keeps WebSocket connections,
device presence, and the rules engine in process memory. Running more than one
worker or instance breaks cross-connection fan-out and rule-cache invalidation.
Keep the service at **one process** until a pub/sub layer (Postgres
`LISTEN`/`NOTIFY` or Redis) is added for horizontal scaling.

- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (no
  `--workers` flag → one process). Do **not** use `gunicorn -w N` / `--workers N>1`.
- **Scaling:** instance count = 1.
- **WebSockets:** supported by Render natively; `/ws/radar/*` needs no extra config.
- **Health check:** `/health`.

An optional [`render.yaml`](./render.yaml) Blueprint codifies the above. It is
**inert for existing manually-created services** — committing it does not change a
running deploy; it only applies if you adopt it as a Blueprint in the dashboard.

## Next Steps

- [ ] Wire contact form to backend endpoint
- [ ] Implement Web Serial flashing UI in ESP32 Web Flasher
- [ ] Add blog content system (MDX or CMS)
- [ ] Connect frontend to backend API for dynamic tools/projects
- [ ] Add JWT auth scaffolding (login/register endpoints)
- [ ] Docker Compose for local development
- [ ] CI/CD pipeline
- [x] Production deployment config (Render — see Deployment section)
