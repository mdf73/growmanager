---
type: architecture
updated: 2026-05-13
sources: [main.py, Documentation/claude.md, Documentation/PHASE1_SUMMARY.txt]
---

# GrowManager — Project Overview

Cannabis cultivation management application. Tracks grow cycles, plants, seeds, equipment, extractions, recipes, sensors, and living soil systems.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + React Query (TanStack v5) |
| Backend | FastAPI 0.111 + SQLAlchemy 2.0 + PyMySQL |
| Database | MySQL (Docker container) |
| Containerization | Docker Compose |

## Running Containers

| Container | Port | Purpose |
|---|---|---|
| `growmanager-backend-1` | 8000 | FastAPI API |
| `growmanager-frontend-1` | 5173 | Vite dev server |
| `growmanager-db-1` | 3306 | MySQL database |

## Launch Commands

### Développement (Windows)

```bash
# Start everything
docker-compose up -d

# Restart after backend changes
docker-compose restart backend

# Restart after frontend changes (usually not needed — Vite HMR handles it)
docker-compose restart frontend

# View backend logs
docker-compose logs -f backend

# Connect to MySQL
docker exec -it growmanager-db-1 mysql -u root -p growmanager
```

### Production (Linux)

Premier déploiement :
```bash
git clone <repo>
cp .env.example .env   # puis éditer les mots de passe
docker compose -f docker-compose.server.yml up -d --build
```

Mises à jour suivantes (après un push depuis Windows) :
```bash
./update.sh
```

> `update.sh` fait : `git pull` + `docker compose -f docker-compose.server.yml up -d --build` + vérification des conteneurs.

## Key File Paths

```
growmanager/
├── backend/app/
│   ├── models/all_models.py     ← ALL SQLAlchemy models
│   ├── models/__init__.py       ← model exports
│   ├── routers/                 ← 29 router files (one per domain)
│   ├── schemas/                 ← Pydantic schemas
│   ├── main.py                  ← startup, migrations, router registration
│   ├── database.py              ← DB engine, session
│   └── config.py                ← env config
├── frontend/src/
│   ├── api/                     ← 28 Axios client files
│   ├── pages/                   ← 25 page components
│   ├── components/              ← shared components + culture/ subdirectory
│   └── App.tsx                  ← route table
└── Documentation/
    ├── claude.md                ← dev rules (authoritative)
    └── PHASE1_SUMMARY.txt       ← phase achievements
```

## API Base URL

All endpoints: `/api/...`

Health check: `GET /health` → `{"status": "ok"}`

CORS: open (all origins/methods/headers — dev setup).

## Database

Name: `growmanager`
Engine: MySQL with SQLAlchemy ORM.
Migrations: no Alembic — startup `run_migrations()` in `main.py` runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via `INFORMATION_SCHEMA`.

## Versions

**Application : v3.1.0** (frontend `package.json` + backend `main.py` synchronisés)

| Composant | Version |
|---|---|
| Python | 3.11 |
| FastAPI | 0.111 |
| SQLAlchemy | 2.0.30 |
| React | 18.3.1 |
| Vite | 5.3.1 |
| React Router | 6.23.1 |
| TanStack Query | 5.40.0 |
| Axios | 1.7.2 |
| Tailwind | 3.4.4 |

> Règle : à chaque `bump-version.bat`, mettre à jour aussi `backend/app/main.py` (2 occurrences : `FastAPI(version=...)` et la route `GET /`).

## See Also

- [[architecture/stack]] — detailed architecture breakdown
- [[architecture/patterns]] — key development patterns
- [[database/database-overview]] — all DB tables
- [[frontend/frontend-overview]] — page routing and component structure
- [[roadmap]] — pending features and TODOs
