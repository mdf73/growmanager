# Wiki Log

Append-only chronological record of all wiki operations.

Format: `## [YYYY-MM-DD] <operation> | <description>`

Operations: `bootstrap`, `ingest`, `query`, `lint`, `update`

---

## [2026-05-13] update | Tri alphabétique par défaut dans le catalogue graines

**Feature :** Le tableau `/graines` est désormais trié par défaut par breeder A→Z, puis variété A→Z à l'intérieur de chaque breeder.

**Changement :** Dans `Graines.tsx`, le `useMemo` `filtered` retournait `base` sans tri quand `sortCol === null`. Remplacé par un `.sort()` avec `localeCompare('fr', { sensitivity: 'base' })` sur breeder puis variété. Les colonnes cliquables ne sont pas affectées.

**Fichier modifié :** `frontend/src/pages/Graines.tsx`

---

## [2026-05-13] update | Bugfix — race condition création variété dans NouveauPackModal

**Bug corrigé :** Dans `NouveauPackModal.tsx`, l'ajout d'une nouvelle variété via le bouton `+` semblait ne pas fonctionner.

**Cause racine :** Race condition entre `queryClient.invalidateQueries` (async) et le rendu du `<select>`. Après création de la variété, `setShowNewVariete(false)` basculait immédiatement sur le select, mais le cache n'était pas encore mis à jour. Le select affichait "— Sélectionner —" car aucune option ne correspondait à l'ID retourné, donnant l'impression que la création avait échoué (alors que la variété était bien créée en DB).

**Fix appliqué :**
- `addVariete.onSuccess` : `invalidateQueries` → `setQueryData` pour mise à jour immédiate du cache
- Même fix appliqué sur `addBreeder` et `addFournisseur` (même pattern, même risque)
- Ajout d'un message d'erreur `addVariete.isError` sous le champ variété

**Fichier modifié :** `frontend/src/components/NouveauPackModal.tsx`

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

## [2026-05-10] update | Sprint 1 V4 — PPFD/DLI, timer flush, launch culture, déduction engrais

**Features validées :**

- **M — PPFD / DLI** : widget dans `StatsTab.tsx` — calcul PPFD (µmol/m²/s) et DLI (mol/m²/j) depuis puissance lampe + surface espace. Photopériode auto (18h veg / 12h floraison). Indicateurs colorés vs cibles. Fallback si données manquantes. Props `idEspace` + `phase` passés depuis `Culture.tsx`.

- **C — Timer de flush** : colonne `date_debut_flush DATE NULL` sur `Culture` (migration auto `main.py`). Exposée dans `CultureUpdate`, `CultureRead`, serializer `cultures.py`. Bouton toggle dans `Culture.tsx` (visible en phase floraison). Badge 🚿 J+X dans `Dashboard.tsx` via `BoxArrosageStats` enrichi.

- **Launch Culture** : `PlanCulture.tsx` appelle `planCultureAPI.update({ statut: 'lance' })` après création. Badge "Lancé" visible dans le sélecteur de plans.

- **J — Déduction stock engrais** : déjà implémentée dans `cultures.py` (arrosage_engrais via recette RecetteEngrais ou liste manuelle, `max(0, ...)`). Roadmap mise à jour (fausse ❌ → ✅).

**Fix** : `espaceAPI` → `espacesAPI` dans `StatsTab.tsx` (nom correct de l'export).

**Pages wiki mises à jour :** `roadmap.md` — Sprint 1 marqué complété, statuts M/C/J mis à jour.

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
