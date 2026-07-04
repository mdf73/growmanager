---
type: architecture
updated: 2026-04-09
sources: [main.py, database.py, config.py, Documentation/PHASE1_SUMMARY.txt]
---

# Architecture — Stack

## Backend

**FastAPI** serves the REST API on port 8000 inside Docker.

Entry point: `backend/app/main.py`
- `run_migrations()` runs at startup — creates tables via SQLAlchemy metadata, then patches schema via raw SQL
- `seed_parametres()` runs at startup — populates reference dropdown lists
- `start_poller(app)` starts the Govee sensor background polling loop
- 23 routers registered with `app.include_router()`

**SQLAlchemy 2.0** with PyMySQL driver. Session managed per-request via dependency injection.

**Database connection:** `backend/app/database.py`
- Engine with connection pooling
- `SessionLocal` = `sessionmaker`
- `get_db()` dependency yielded per request

**Config:** `backend/app/config.py` reads from `.env`

## Frontend

**Vite + React 18 + TypeScript** dev server on port 5173.

**Tailwind CSS** with custom `grow-600` brand color.

**React Router v6** — all routes defined in `App.tsx`, wrapped in `<Layout>`.

**TanStack Query v5** (`@tanstack/react-query`) for all server state:
- `useQuery` for reads
- `useMutation` for writes, followed by `qc.invalidateQueries()` to refresh

**Axios** clients in `frontend/src/api/` — one file per domain, all using base URL `/api`.

## Docker Compose

Three services:
- `backend` → Python/FastAPI, port 8000
- `frontend` → Node/Vite, port 5173
- `db` → MySQL, port 3306, named `growmanager-db-1`

Frontend proxies `/api` requests to backend via Vite config (so no CORS issues in dev).

## Pre-seeded Data

At startup, `seed_parametres()` populates `ParametreListeValeur` with dropdown options for: lamp types, pot materials, jar types, equipment categories, substrate types, extraction types, etc.

8 default brands pre-inserted: LeParfait, Miron VioletGlass, Aptus, Hesi, Graveda, Qnubu, KP4, Jcase.

## See Also

- [[overview]] — quick reference
- [[architecture/patterns]] — migration and enrichment patterns
- [[database/database-overview]] — all DB tables
