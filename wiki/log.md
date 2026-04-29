# Wiki Log

Append-only chronological record of all wiki operations.

Format: `## [YYYY-MM-DD] <operation> | <description>`

Operations: `bootstrap`, `ingest`, `query`, `lint`, `update`

---

## [2026-04-29] update | Setup Git + workflow CI

Mise en place du versioning Git et du workflow de commit.

**Actions réalisées :**
- `git init` + premier commit sur `https://github.com/mdf73/growmanager` (repo privé)
- `.gitignore` créé — exclut `node_modules/`, `__pycache__/`, `.env`, `mysql_data/`
- `.env.example` créé — template des variables d'environnement sans secrets
- `push.bat` créé — script Windows pour committer et pusher en un double-clic

**Workflow de commit :**
1. Claude fait les modifications code + wiki + écrit `_commit_msg.txt`
2. L'utilisateur double-clique sur `push.bat` → git add + commit + push automatique

---

## [2026-04-28] update | Bugfix — nommage des plantes

**Bug corrigé :** `_build_plant_name()` dans `routers/cultures.py` utilisait `plant_counter` (compteur incrémental de la boucle de création) au lieu de `graine.id_graine`.

**Comportement corrigé :** Le nom d'une plante est désormais `<variété> #<id_graine>`, reflétant le numéro réel de la graine utilisée.

**Page mise à jour :** `features/plant-lifecycle.md` — section "Naming Convention" ajoutée.

---

## [2026-04-25] update | Feature — simulateur de récolte sur PlanCulture

Ajout du simulateur de dates de récolte sur la page `/plan-culture` (UI-only, pas de backend).
- `frontend/pages.md` — section PlanCulture mise à jour avec description du simulateur
- `roadmap.md` — feature ajoutée dans Completed (2026-04-25)

---

## [2026-04-24] update | Wiki sync — 5 new routers, 2 new pages, 8 new DB models

Compared wiki state (2026-04-09) against actual codebase. Gaps identified and patched.

**New routers (not documented):**
- `sechage.py` `/api/sechage` + `curing.py` `/api/curing` — séchage/curing refactorisés en sessions indépendantes
- `notation_variete.py` `/api/notations` — système de notation variétés /100
- `vaporisateur.py` `/api/vaporisateurs` — inventaire vaporisateurs + consommables
- `croisement.py` `/api/croisements` — génétique : pollen + croisements (était placeholder)

**New pages (not documented):**
- `ClassementVarietes` `/classement-varietes` — ranking variétés avec scores Culture/Conso
- `Croisement` `/croisement` — génétique complètement implémentée (était "coming soon")
- `RecettesSchemas` `/recettes/schemas-engrais` — schémas engrais par période (était placeholder)

**New DB models:**
- `SessionSechage`, `PlantSechage`, `SessionCuring`, `PlantCuring` — refacto séchage/curing
- `NotationVariete` — scoring variétés
- `Vaporisateur`, `VapoConsommable` — inventaire vaporisateurs
- `Pollen`, `Croisement` — génétique

**Files updated:** `api/overview.md`, `frontend/pages.md`, `database/schema-overview.md`, `roadmap.md`, `overview.md`

---

## [2026-04-09] bootstrap | Initial wiki creation from full codebase exploration

Explored entire GrowManager codebase (backend + frontend + docs) and bootstrapped the wiki from scratch.

**Coverage:**
- 24+ SQLAlchemy models across 10 domain groups
- 23 FastAPI routers with all endpoints documented
- 24 frontend pages + routing table
- 4 cross-cutting feature flows
- Architecture patterns and dev rules
- Consolidated roadmap from existing docs

**Pages created:** 28 pages across 6 sections + index + log + overview
