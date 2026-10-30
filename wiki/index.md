---
updated: 2026-09-12
---

# Wiki Index

Content catalog for the GrowManager development wiki. Read this first when starting a new session.

---

## 🌿 Vue métier

- [[domains/metier-index]] — navigation par fonctionnalité (cultures, graines, recettes, capteurs, stock, photos...) plutôt que par couche technique

---

## Meta

- [[overview]] — Project summary, stack, Docker containers, ports, launch commands
- [[log]] — Chronological log of all wiki operations
- [[roadmap]] — Pending TODOs and feature backlog

---

## Architecture

- [[architecture/stack]] — Tech stack details, Docker services, startup sequence, pre-seeded data
- [[architecture/patterns]] — Key dev patterns: migrations, enrichment, static-before-dynamic routes, M2M tables, JSON columns, pot formula
- [[architecture/decisions]] — Architecture Decision Records (ADR-001 through ADR-008)
- [[architecture/infrastructure-prod]] — Serveur de production (PC atelier) : specs Ubuntu, accès SSH, ports, services colocalisés (Home Assistant, Pi-hole), pièges d'encodage export/import

---

## Database

- [[database/database-overview]] — All tables grouped by domain with one-liners and cross-links
- [[database/database-culture]] — Culture, Plant, ActionCalendrier, M2M association tables
- [[database/database-graines]] — Breeder, Variete, Graine, PackGraine, Fournisseur, Catalogue
- [[database/database-stock]] — Stock, Recolte, RosinExtraction, HashExtraction
- [[database/database-recipes]] — All 6 recipe types (TCO, LSO, Réamendement, Arrosage, Fermentation, Engrais) + ProduitEngrais
- [[database/database-equipment]] — Box, Lampe, Pot, Irrigation, Ventilation, Bocal, Press, RosinBag, IceOBag, Materiel, Marque, ParametreListeValeur
- [[database/database-sensors]] — GoveeDevice, TemperatureLog, VPD calculation
- [[database/database-spaces]] — EspaceCulture, EspaceMateriel
- [[database/database-living-soil]] — SuiviSolVivant + all sub-tracking tables (Réamendement, Arrosage, TCO, Fermentation, Culture)
- [[database/database-planning]] — PlanCulture, PlanCultureVariete, PreparationSubstrat, HistoriqueCulture, HistoriquePlant

---

## API

- [[api/api-overview]] — All 23 routers listed with prefixes
- [[api/api-cultures]] — Culture CRUD, plant management, action calendar
- [[api/api-graines]] — Breeders, varietes, fournisseurs, packs, individual seeds, catalogue
- [[api/api-stock-extractions]] — Stock, rosin extractions, hash extractions, dashboard stats
- [[api/api-recipes]] — All recipe types CRUD + fertilizer product management
- [[api/api-living-soil]] — SuiviSolVivant + all sub-event endpoints
- [[api/api-calendrier]] — Calendrier global : events par mois, cultures-actives, export plage de dates
- [[api/api-infrastructure]] — Govee sensors, growing spaces, materiel, parametres, import/export
- [[api/api-planning]] — Plan culture, substrate preparation, historical cultures

---

## Frontend

- [[frontend/frontend-overview]] — Full route table (23 routes), component hierarchy, Layout structure
- [[frontend/pages]] — All 24 pages with route, purpose, and key components
- [[frontend/conventions]] — React Query patterns, Tailwind brand color, hook rules, Axios client

---

## Features

- [[features/plant-lifecycle]] — Plant status flow: germination → veg → floraison → sechage → curing → prete/recolte/abandonne
- [[features/culture-lifecycle]] — Culture status flow: active → sechage_curing → terminee; closing/archiving
- [[features/sensor-integration]] — Govee H5179 setup, polling, VPD, manual entries
- [[features/living-soil-system]] — LSO recipe library, substrate preparation, pot tracking workflow
- [[features/photos]] — Galerie photos : photo globale culture vs photo de plante spécifique, upload, filtres, badges
- [[features/mobile-app]] — App Android Capacitor : config, build APK CI, écran premier lancement, accès distant Tailscale
- [[features/mobile-standalone]] — Mode autonome (Phase B) : SQLite embarqué, backend local TS, dual-mode, sauvegarde .zip, limites
- [[features/i18n]] : Multilingue FR/EN/DE/ES : étude, inventaire, architecture et plan par sprints (planifié, non lancé)
- [[features/donnees-standard]] : Données standard pré-remplies (listes Paramétrage, breeders) : première installation + bouton « Compléter », sans écrasement (plan validé, non lancé)

---

## Bugs

- [[bugs/drawer-decale-space-y]] — drawers Origine stock / bocal décalés de 24 px par la marge space-y du parent (corrigé 2026-10-23)
- [[bugs/tapoconfig-migration-race]] — race `create_all()` entre les 2 workers uvicorn (corrigé 2026-10-23)
- [[bugs/version-bump-lockfile-deps]] — bump de version et lockfile
- [[bugs/parametres-doublons-seed-workers]] — doublons des listes paramétrables après la 3.8.0 (corrigé 2026-10-13)
