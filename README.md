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

## Next Steps

- [ ] Wire contact form to backend endpoint
- [ ] Implement Web Serial flashing UI in ESP32 Web Flasher
- [ ] Add blog content system (MDX or CMS)
- [ ] Connect frontend to backend API for dynamic tools/projects
- [ ] Add JWT auth scaffolding (login/register endpoints)
- [ ] Docker Compose for local development
- [ ] CI/CD pipeline
- [ ] Production deployment config
