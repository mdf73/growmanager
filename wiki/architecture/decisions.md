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

## ADR-009 — Valeurs verrouillées dans les listes paramétrables (2026-10-13)

**Context:** Pik veut que toutes les listes déroulantes soient paramétrables, y compris les catégories de matériel. Or le code s'appuie sur certaines valeurs : chaque catégorie de base a ses champs spécifiques (`CaractFields` dans `NouveauMaterielModal`), et `Bocaux` sert au lien stock / curing (`stock.py`, sessions de curing).

**Decision:** Les listes restent dans `ParametreListeValeur`, mais un dictionnaire `LISTES_VERROUILLEES` (miroir backend `routers/parametre.py` + frontend `api/parametres.ts`, utilisé aussi par le mode local) liste les valeurs protégées : renommage et suppression refusés (403), ré-insertion au seed si absentes, cadenas dans Paramétrage. L'ajout de valeurs libres reste possible (catégorie libre = champs communs seulement).

**Consequence:** Toute nouvelle valeur sur laquelle le code fait un test d'égalité doit être ajoutée à `LISTES_VERROUILLEES` des deux côtés (depuis le 2026-11-04, ADR-011 : `materiel_categories` et `types_stock` Fleur, Trim, WPFF, Hash, Rosin). Les écrans gardent affichable une valeur enregistrée qui aurait été retirée de sa liste (`SelectWithAdd`, filtres Matériel).

---

## ADR-010 : Multilingue i18n (brouillon 2026-10-23)

**Statut:** proposé, non validé. Étude complète : [[features/i18n]]. Les points ouverts sont listés en section 6 de cette page.

**Context:** L'app n'existe qu'en français, ce qui bloque le recrutement de testeurs étrangers pour le test fermé Google Play. Cibles : FR, EN, DE, ES.

**Decision (proposée):** `i18next` + `react-i18next`, JSON des 4 langues embarqués dans l'APK. Langue stockée par appareil (`localStorage gm_lang`), pas en base. Source FR, fallback EN. Listes paramétrables (tranché par Pik le 2026-10-23) : valeurs libres créées dans la langue choisie au premier lancement puis traitées comme des données utilisateur (jamais retraduites) ; valeurs verrouillées ou testées par le code conservées en code français en base et traduites uniquement à l'affichage. Erreurs backend renvoyées sous forme de codes traduits côté front. Formats date/nombre centralisés dans un helper basé sur la langue active.

**Consequence:** Plus aucune chaîne en dur dans l'UI : chaque nouveau texte doit avoir sa clé dans les 4 langues (contrôle de parité en CI). Ne jamais traduire une valeur stockée ou testée par égalité (complète l'ADR-009).

---

## ADR-011 : Données standard pré-remplies (2026-10-30)

**Statut:** validé par Pik le 2026-10-30, révisé le 2026-11-01 (démarrage vide), implémenté pour les listes le 2026-11-04 ; catalogue breeders abandonné le 2026-11-04. Plan : [[features/donnees-standard]].

**Context:** Les valeurs par défaut des listes paramétrables sont dupliquées (backend `parametre.py` + `frontend/src/local/seeds.ts`) et ne sont insérées que dans les listes vides : une mise à jour n'apporte rien aux installations existantes. Pik veut livrer à tous ses valeurs comme standard, puis un catalogue de breeders.

**Decision:** Standard décrit dans des JSON uniques partagés (serveur + APK). Aucune liste n'est remplie à l'installation : le standard est inséré uniquement à la demande via des boutons de Paramétrage (global + par section) qui insèrent toutes les valeurs absentes. Les valeurs testées par le code sont verrouillées (ADR-009 étendu aux types de stock Fleur, Trim, WPFF, Hash, Rosin) et toujours présentes. Uniquement des INSERT, jamais d'UPDATE ni de DELETE. Vérification avant insertion par nom normalisé (minuscules, sans accents, espaces rognés), doublon résiduel accepté. Pas de seed automatique à la mise à jour, pas de variétés.

**Consequence:** Toute évolution du standard passe par le JSON. Une installation (neuve ou existante) ne reçoit le standard que si l'utilisateur presse un bouton. Toute nouvelle valeur testée par égalité dans le code doit être verrouillée. Les données standard deviennent des données utilisateur ordinaires une fois insérées, sauf valeurs verrouillées de l'ADR-009 (toujours ré-insérées au démarrage).

---

*Add new ADRs here as architectural decisions are made.*
