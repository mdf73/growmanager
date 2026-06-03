---
type: architecture
updated: 2026-04-09
sources: [Documentation/claude.md, Documentation/PHASE1_SUMMARY.txt]
---
# Architecture Decision Records

## ADR-001 — No Alembic for migrations

**Decision:** Use startup `run_migrations()` with raw `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` instead of Alembic.

**Rationale:** Simpler setup for a solo dev project running in Docker. Alembic adds complexity (revision files, upgrade/downgrade commands) that isn't needed when the schema evolves in a controlled single-dev environment.

**Consequence:** All schema changes must go through `run_migrations()` in `main.py`. Never ALTER tables manually in production without also updating this function.

---

## ADR-002 — Single `all_models.py` for all SQLAlchemy models

**Decision:** All models defined in one file (`backend/app/models/all_models.py`) rather than one file per domain.

**Rationale:** Avoids circular import issues between models that reference each other (e.g., Culture ↔ Plant ↔ Graine). With all models in one file, SQLAlchemy can resolve all relationships without import ordering issues.

**Consequence:** `all_models.py` is large (~600+ lines). When adding a new model, also update `models/__init__.py` exports.

---

## ADR-003 — ActionCalendrier.type_action as VARCHAR (not ENUM)

**Decision:** Converted from ENUM to VARCHAR at startup via migration.

**Rationale:** ENUM requires a schema change to add new action types. VARCHAR allows arbitrary types without migrations, which is important for an evolving action taxonomy.

**Consequence:** No database-level validation of action types. Validation must be done at the application layer if needed.

---

## ADR-004 — CORS open in development

**Decision:** FastAPI CORS middleware allows all origins/methods/headers.

**Rationale:** Dev-only setup. Frontend (Vite on 5173) and backend (FastAPI on 8000) run in separate containers; open CORS avoids friction during development.

**Consequence:** Must be locked down before any production deployment.

---

## ADR-005 — JSON columns for variable-structure data

**Decision:** Use MySQL JSON columns for: action parameters, extraction pass data, pot configurations, equipment characteristics.

**Rationale:** These structures vary significantly by type (e.g., action params differ per action type; equipment specs differ per category). Normalizing into additional tables would require many tables with mostly empty columns.

**Consequence:** No SQL-level querying of these fields. All parsing done in Python/TypeScript.

---

## ADR-006 — Recipe system with line items

**Decision:** All recipes (TCO, LSO, Arrosage, Fermentation, Réamendement, Engrais) use a header + line-items structure with a separate `*Ligne` table per recipe type.

**Rationale:** Recipes have variable numbers of ingredients. Line items allow full CRUD on individual ingredients without replacing the whole recipe.

**Consequence:** 12 tables for 6 recipe types. Each recipe type has its own router, schema, and API client file.

---

## ADR-007 — Plant origine enum

**Decision:** `Plant.origine` uses a string enum: `graine | bouture | clone`

**Rationale:** Distinguishes how the plant entered the culture — relevant for legal/genetic tracking and reporting.

**Consequence:** External plants (from cuttings/clones) can be added to a culture even if it started from seeds.

---

## ADR-008 — Images Docker versionnées via GitHub Container Registry (2026-06-03)

**Decision:** Publier des images Docker taguées (`vX.Y.Z`) sur `ghcr.io/mdf73/` via GitHub Actions.

**Rationale:** Le workflow `docker compose build` recompile tout localement à chaque mise à jour. Avec des images pré-buildées, une mise à jour se résume à `./update.sh v1.2.0` — plus rapide, plus fiable, reproductible sur n'importe quel serveur (Portainer, Unraid, VPS…).

**Fichiers ajoutés :**
- `backend/Dockerfile.prod` — multi-stage, `uvicorn --workers 2` sans `--reload`
- `frontend/Dockerfile.prod` — build Vite → nginx:alpine (SPA routing)
- `.github/workflows/docker-publish.yml` — build + push sur chaque tag `v*.*.*`
- `docker-compose.prod.yml` — déploiement depuis images (variable `GROWMANAGER_VERSION`)
- `update.sh` — script de mise à jour en une commande

**Les Dockerfiles de dev** (`Dockerfile` originaux avec hot-reload) sont conservés pour le développement local.

**Consequence:** Pour créer une release : `git tag v1.2.0 && git push --tags` → GitHub Actions publie automatiquement les images.

---

*Add new ADRs here as architectural decisions are made.*
