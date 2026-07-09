---
type: roadmap
updated: 2026-07-05
sources: [Documentation/claude.md, Documentation/Instructions de reprises v1.txt, Documentation/GrowManager_Specifications_v4.docx]
sprint1_completed: 2026-05-10
---

# Roadmap & Pending TODOs

---

## Phase Mobile — Plan A puis B (validé 2026-07-04)

**Vision** : app mobile Android, données personnelles chez chaque utilisateur (rien de centralisé).
**Stratégie** : Phase A = app connectée au serveur auto-hébergé (Capacitor) → Phase B (plus tard) = version 100% autonome (réécriture couche API en TS + SQLite embarqué, frontend réutilisé).
**Contrainte** : zéro changement de rendu/comportement desktop — responsive via breakpoints Tailwind uniquement. Backend non touché.

### Sprints Phase A

| Sprint | Contenu | État |
|--------|---------|------|
| A1 | Bottom nav mobile refaite (4 raccourcis + Plus) · modals mobile OK · safe-area | ✅ validé 2026-07-04 |
| A2 | Pages responsive (28 pages : tables → scroll/cartes, grilles, formulaires) | ✅ validé 2026-07-04 (batch 1 : 4 pages principales · batch 2 : Croisement, SuiviConstantes, Consommation corrigées, le reste déjà conforme) |
| A3 | URL serveur configurable (client Axios) + manifest PWA (installable Chrome) | ✅ validé 2026-07-04 |
| A4 | Capacitor init + APK Android + icône/splash + doc Tailscale accès distant | ✅ validé 2026-07-04 — **Phase A complète** (voir [[features/mobile-app]]) |

**Audit A1 (2026-07-04)** : Layout mobile déjà en place (header, sidebar hamburger) · 12 pages avec tables dont 6 sans scroll horizontal · peu de breakpoints dans les pages · client Axios `baseURL: '/api'` en dur (à rendre configurable en A3).

### Phase B — Mode standalone (plan validé 2026-07-05, non démarré)

**Principe clé — dual-mode** : la Phase B **s'ajoute** au mode serveur, elle ne le remplace pas. L'app Android propose 2 modes :
1. **Standalone** : données 100% locales sur le téléphone (SQLite embarqué), aucun serveur requis.
2. **Serveur** : connexion à un serveur GrowManager local/distant (comportement Phase A actuel, inchangé).

**Décisions (2026-07-05)** :
- Choix du mode au **premier lancement** (écran remplaçant `ServerSetup.tsx`) + **modifiable dans Paramétrage → Général**.
- **Modes indépendants** : pas de sync entre base locale et serveur. Base vide au passage en standalone. L'import/export JSON existant sert de passerelle manuelle si besoin.
- Architecture : les ~35 fichiers `src/api/*.ts` restent le contrat. Un **backend local TypeScript** réimplémente les routes REST derrière un adapter Axios — zéro changement dans les pages. SQLite via `@capacitor-community/sqlite`, photos via `@capacitor/filesystem`.
- Backend Python et mode web/desktop **non touchés**.

**Sprints Phase B** :

| Sprint | Contenu | État |
|--------|---------|------|
| B0 | Fondations : écran choix de mode (1er lancement + Paramétrage) · plugin SQLite + schéma DB (portage modèles SQLAlchemy → DDL) · adapter Axios → backend local · `/health` local | ✅ validé 2026-07-05 — ModeSetup.tsx (remplace ServerSetup) · gm_mode + rétro-compat · src/local/ (schema 78 tables générées, db, router, adapter) · 501 sur routes non portées |
| B1 | Référentiels : varietes, breeders, fournisseurs, graines, espaces, engrais, materiel, app_settings, parametres | ✅ validé 2026-07-05 — handlers src/local/handlers/ (referentiels, parametres, espaces, engrais, materiel, graines) · seeds auto (AppSettings + ~35 listes) · fix axios global → adapter aussi sur axios.defaults (passthrough URLs absolues) · smoke test SQL sur schéma réel |
| B2 | Cœur culture : cultures, plants, arrosages, actions, plan_culture | ✅ validé 2026-07-05 — handlers cultures + cultures-helpers + plan-culture · effets d'actions complets (floraison→prévisions récolte, fin_curing→Stock auto, déduction engrais/TCO) · coûts complets (élec dimmer/phase, engrais, graines) · archivage HistoriqueCulture · photos reportées en fin de phase (Filesystem + URLs images) |
| B3 | Post-récolte : sechage, curing, stock, stock_alert_seuils, extractions, vaporisateur | ✅ validé 2026-07-05 — handlers sechage-curing (+ WPFF, eligible, sechage/plants, stock-info, bocal-timeline), stock (+ origine, bocaux-disponibles, sortie, alertes+seed Fleur), extractions rosin/hash (multi-sources, stocks produits, synchro édition), vaporisateurs (+ sessions déduction stock) |
| B4 | Recettes & sol : 6 recette_*, preparation_substrat, suivi_sol_vivant, open_field, croisement, notation_variete | ✅ validé 2026-07-06 — recettes.ts (factory générique 6 types + lignes), sol-vivant.ts (préparation + suivi avec coûts estimés + déduction stock arrosage), croisement.ts (pollen péremption auto + récolte→variété/pack/graines), open-field.ts (récolte mère → variété OF + pack), notation.ts (scores + extraction-stats) |
| B5 | Transverses : dashboard, calendrier, search, comparaison, consommation, historique_culture | ✅ validé 2026-07-06 — dashboard.ts (stats 6 modules, arrosage-boxes, burping, IPM), transverses.ts (calendrier global + export, search, cultures/compare complet, historique + prix-graine), consommation.ts (CRUD + stats/projection) · capteurs → null en standalone · import/export CSV → B6 |
| B6 | Limitations & polish : capteurs masqués, photos, doc | ✅ validé 2026-07-06 — photos standalone (@capacitor/filesystem, photos-fs.ts, photoUrl convertFileSrc, sans compression/thumbnail v1) · capteurs masqués (Dashboard, nav Constantes, onglets Paramétrage Capteurs/Sauvegarde) · doc [[features/mobile-standalone]] · exports PDF/CSV et imports CSV restent en 501 — **Phase B complète**, test APK réel à faire |

**Limites connues du mode standalone** :
- Capteurs Govee/esphome inopérants (nécessitent le serveur) — UI masquée en standalone.
- Exports PDF (étiquettes, fiche culture) générés côté backend Python → à réimplémenter en JS (jsPDF) ou désactivés en v1 standalone.
- Distribution Play Store possible (aucune donnée embarquée dans l'app).

---

## V4 Backlog — Bilan & Plan d'action (review 2026-05-10)

Source : `Documentation/GrowManager_Specifications_v4.docx` + `Documentation/growmanager_roadmap_v4_review.html`

### Statut par feature

| Feature | Titre | État | Notes |
|---------|-------|------|-------|
| A | pH & EC par arrosage | ✅ DONE | Colonnes DB + ArrosageModal + graphiques StatsTab |
| B | IPM / traitements | ✅ DONE | Champs produit/dose/méthode/delai_recolte_j · endpoint ipm-warnings · ModuleIPM Dashboard (conditionnel, badge 🔴 <7j) · validé 2026-05-13 |
| C | Timer de flush | ✅ DONE | `date_debut_flush` sur Culture (migration + schema + router) · bouton Culture.tsx · badge 🚿 J+X Dashboard |
| D | Vue calendrier global | ✅ DONE | `GET /api/calendrier` · `CalendrierGlobal.tsx` · route `/calendrier` · nav groupe Culture · validé 2026-05-14 |
| E | Comparaison inter-cultures | ✅ DONE | `GET /cultures/compare` · tableau + courbes · volumes arrosage corrigés (volume_par_plante_l) · détail coût/recette · validé 2026-05-14 |
| F | Traçabilité bocal → graine | ✅ DONE | `GET /api/materiel/{id}/bocal-timeline` · `BocalTimelineDrawer.tsx` · bouton "🔍 Origine" SechageCuring · `GET /api/stock/{id}/origine` · `StockOriginDrawer.tsx` · clic ligne Stock → drawer · `id_plant` FK sur Stock · `GET /api/cultures/plants-by-variete/{id}` · plant picker dans NouveauStockModal · validé 2026-05-13 |
| G | Alertes stock bas | ✅ DONE | `StockAlertSeuil` table · `quantite_initiale` sur Stock · `/api/stock-alert-seuils` CRUD+check · badge Dashboard · bandeau Stock.tsx · onglet Paramétrage · validé 2026-05-11 · bugfix 2026-05-13 : colonne `quantite_initiale` absente du modèle + migration SQL + `s.variete.nom` → `s.variete.nom_variete` |
| H | Rappels bocaux / burping | ✅ DONE | `GET /api/dashboard/burping-reminders` · `ModuleBurping` Dashboard · fréquences alignées sur SechageCuring.tsx (1j/3j/7j/14j) · conditionnel si aucune session |
| I | QR codes / étiquettes | ✅ DONE | `qrcode[pil]` + `fpdf2` · `GET /api/stock/{id}/label` → PDF 100×60 mm (QR + variété + type/LSO + engrais + quantité + date + bocal) · bouton 🖨️ par ligne Stock.tsx · QR encode `http://growmanager/stock?id={id}` · URL locale via hosts + nginx + `GROWMANAGER_URL` env · `vite.config.ts` allowedHosts · validé 2026-05-14 |
| J | Déduction stock engrais | ✅ DONE | Déjà implémenté dans cultures.py (lignes 455–489) — recette + liste manuelle |
| K | Recherche globale | ✅ DONE | `GET /api/search` · `GlobalSearch.tsx` · Ctrl+K · validé 2026-05-13 |
| L | Export PDF fiche culture | ✅ DONE | fpdf2 · `GET /api/cultures/{id}/export/pdf` · bouton 📄 PDF CultureDetail · fiche A4 : header, infos, plantes, actions, coûts, notes · validé 2026-05-14 |
| M | PPFD / DLI | ✅ DONE | Widget StatsTab — PPFD + DLI + photopériode auto · cibles veg/floraison · alerte si surface manquante |

### Plan d'action — sprints par ratio valeur/effort

**Sprint 1 — Quick wins ✅ COMPLÉTÉ 2026-05-10**
1. ✅ **M** PPFD / DLI — widget StatsTab, efficacité 2.5 µmol/J, cibles veg/floraison, 0 migration
2. ✅ **C** Timer de flush — colonne `date_debut_flush` Culture + bouton Culture.tsx + badge 🚿 J+X Dashboard
3. ✅ **J** Déduction stock engrais — déjà implémentée (arrosage_engrais via recette ou liste manuelle)
4. ✅ **Launch Culture** depuis PlanCulture — `planCultureAPI.update({ statut: 'lance' })` post-création + badge "Lancé"

**Sprint 2 — Alertes & UX**
4. ✅ **H** Rappels bocaux / burping — `GET /api/dashboard/burping-reminders` · ModuleBurping Dashboard · fréquences 1j/3j/7j/14j · validé 2026-05-11
5. ✅ **G** Alertes stock bas — `StockAlertSeuil` table · `quantite_initiale` Stock · CRUD+check endpoint · badge Dashboard · bandeau Stock · onglet Paramétrage · validé 2026-05-11
6. ✅ **B** IPM / traitements — champs produit/dose/méthode/delai_recolte_j sur `traitement` · endpoint `GET /api/dashboard/ipm-warnings` · ModuleIPM Dashboard conditionnel · badge 🔴 si <7j restants · validé 2026-05-13

**Sprint 3 — Features riches**
7. ✅ **F** Traçabilité bocal → graine — `GET /api/materiel/{id}/bocal-timeline` · `BocalTimelineDrawer.tsx` · bouton "🔍 Origine" SechageCuring · `GET /api/stock/{id}/origine` · `StockOriginDrawer.tsx` · clic ligne Stock · `id_plant` FK + plant picker NouveauStockModal · `GET /api/cultures/plants-by-variete/{id}` · validé 2026-05-13
8. ✅ **K** Recherche globale — `GET /api/search?q=` (cultures, plantes, variétés, breeders, stock) · `GlobalSearch.tsx` palette · Ctrl+K shortcut · bouton sidebar desktop + header mobile · navigation clavier ↑↓↵ · validé 2026-05-13
9. ✅ **D** Vue calendrier global — `GET /api/calendrier` · `CalendrierGlobal.tsx` · grille mensuelle color-codée par culture · filtre · drawer detail · stats rapides · validé 2026-05-14

**Sprint 4 — Features lourdes**
10. ✅ **E** Comparaison inter-cultures — sélecteur 2-3 cultures · tableau (espace/lampe/TCO/coûts/volumes) · graphiques hauteurs+arrosages · fix double-comptage volume global · détail coût/recette · validé 2026-05-14
11. ✅ **I** QR codes / étiquettes — `qrcode[pil]` + `fpdf2` · endpoint `/api/stock/{id}/label` · PDF 100×60 mm · bouton 🖨️ Stock.tsx · validé 2026-05-14
12. ✅ **L** Export PDF fiche culture — fpdf2 · endpoint `/api/cultures/{id}/export/pdf` · bouton 📄 PDF dans CultureDetail · fiche A4 complète · validé 2026-05-14

### Protocole de review specs (à réutiliser pour V5+)

Pour refaire ce type d'analyse :
1. Lire `wiki/index.md` → état général
2. Lire `wiki/roadmap.md` → TODOs ouverts pré-V4
3. Extraire `Documentation/GrowManager_Specifications_vX.docx` avec python-docx
4. Lire `Documentation/growmanager_roadmap_vX_review.html` → synthèse visuelle
5. Vérifier le code réel : `backend/app/models/all_models.py`, `backend/app/routers/`, `frontend/src/pages/`, `frontend/src/components/`, `requirements.txt`, `package.json`
6. Produire : tableau bilan (✅/⚠️/❌) + plan en sprints valeur/effort

---

## High Priority (From Active Session Checkpoint)

### 1. "Launch Culture" Button from PlanCulture ✅ DONE — validé 2026-05-15
`NouvellerCultureModal` avec prop `initialData` (pré-remplit espace + variétés depuis le plan) · `planCultureAPI.update({ statut: 'lance' })` post-création · badge "Lancé" sur la carte plan.

### 2. Multi-Goal Display in Culture.tsx ✅ DONE — validé 2026-05-15
`but_culture.split(',')` avec rendu badge `<span>` — implémenté aux lignes 68 et 389 de `Culture.tsx`.

### 3. ActionModal for Global Culture Harvest ✅ VÉRIFIÉ — 2026-05-15
Backend `cultures.py` lignes 1906-1970 : `is_global=True` → expand en 1 action par plante active (exclut recolte/curing/prete/abandonne/wpff) → `_handle_action_effects` par plante. Comportement correct.

### 4. Export CSV for Plan de Culture ✅ DONE — validé 2026-05-15
Backend `GET /plans-culture/{id}/export/csv` (plan_culture.py ligne 206) · bouton frontend PlanCulture.tsx ligne 968.

### 5. Export PDF Calendrier Global ✅ DONE — validé 2026-05-15
Bouton "Export PDF" dans le header de `/calendrier` · modal date début + date fin · `GET /api/calendrier/export` · génération HTML jour par jour (1 page/jour, cover page) · `window.print()` → PDF · zéro dépendance externe.

---

## Completed (Post-Sprint 4)

### Courbes capteurs dans les calendriers ✅ DONE — validé 2026-05-15
`SensorDayChart.tsx` · moyennes horaires (1 pt/heure) · 1 ligne par capteur · tiles min/moy/max · intégré dans `DayModal` CalendrierGlobal + panneau jour CalendrierCulture (filtré sur `id_espace`).

### Courbes capteurs dans l'export PDF calendrier ✅ DONE — validé 2026-05-15
`buildSensorSVGCharts()` dans `CalendrierGlobal.tsx` · SVG inline par jour · T°/Hum/VPD · moyennes horaires · 1 polyline par capteur · légende si multi-capteurs · fetch logs en parallèle des events dans `ExportPDFModal`.

---

### Maillages Polinator paramétrables ✅ DONE — validé 2026-05-15
`maillages_polinator` ajouté dans `ParametreListeValeur` (section "Stock — Maillages" de Parametrage.tsx). `NouvelleHashModal.tsx` : le champ maillage Polinator (anciennement fixe à 120µ) est désormais un `<select>` dynamique chargé depuis `useParametreListe('maillages_polinator')` (fallback `['120µ']`). Colonne `maillage_polinator VARCHAR(20) NULL` ajoutée à `HashExtraction` (migration automatique dans `run_migrations()`, `main.py`).

### Clonage / Suivi bouture ✅ DONE — en attente validation (v2 : sélection espace)

Champs DB ajoutés sur Plant : `id_plant_mere` (FK self), `date_prelevement`, `date_enracinement`, `statut_clone` (en_attente | enracine | rate). Migration auto dans `run_migrations()`. Endpoints : `POST .../clone` (accepte `id_espace` ou `id_box` — auto-crée une culture "Boutures" si aucune culture active dans l'espace), `PATCH .../enraciner`, `PATCH .../clone-rate`, `GET /utils/espaces-clone`. Frontend : `ClonageModal.tsx` (bouton ✂️ sur PlantCard) — sélection par espace physique avec indication si culture active ou création auto + badges mère/clone inline + panel enracinement/raté. Voir → [[features/plant-lifecycle#clonage--suivi-bouture]]

### PDF fiche culture = journal jour-par-jour (même format que Calendrier Global) ✅ DONE — validé 2026-05-17
Bouton PDF dans Culture.tsx génère maintenant un journal HTML jour-par-jour (même moteur que CalendrierGlobal). Dates auto : `date_debut` → `date_fin` (ou aujourd'hui si encore active). Events filtrés par culture via `GET /api/calendrier/export?id_culture=`. Capteurs filtrés par `id_espace`. Cover page avec nom de la culture. `generateCalendarPDF` + `buildSensorSVGCharts` extraits dans `src/utils/calendarPdfExport.ts`, CalendrierGlobal délègue à ce module. `photo` ajouté dans `ACTION_META` + `ACTION_COLORS_PDF` du module partagé.

### Action "Photo" dans le calendrier de culture ✅ DONE — validé 2026-05-17
Nouvelle catégorie `photo` (rose, 📷) dans `actionTypes.ts`. `ActionModal.tsx` : quand type=photo, affiche drop zone + aperçu miniatures + bouton "Uploader N photo(s)". Au submit : upload via `POST /api/photos/upload` (date_prise=date_action, note=légende), puis enregistrement `ActionCalendrier` type=photo avec `parametres.nb_photos`. Pas de saisie de date (héritée de l'action).

### Photos datées dans le suivi de culture ✅ DONE — validé 2026-05-17
`date_prise` accepté en Form param dans `POST /api/photos/upload` (format YYYY-MM-DD ou ISO datetime, fallback utcnow). `PhotoGallery.tsx` : date picker initialisé à aujourd'hui, note + date appliquées à toutes les photos de la session d'upload. Miniatures : date affichée en bas. Export PDF fiche culture : grille 4 colonnes de miniatures par jour (`/uploads/{thumbnail_path}`), note sous chaque image — `photosAPI.list({ id_culture })` fetchées en parallèle dans `Culture.tsx` et passées à `generateCalendarPDF`. `nginx.conf` : `client_max_body_size 20M`. Bugfixes : `cultureId` manquant dans la destructuration de props `ActionModal`, overlay input remplacé par `<label>` wrapping pour compatibilité modale.

---

## Other Known Gaps

### Placeholder Pages to Implement
*(all previous placeholders are now implemented — see Completed section)*

### Govee Sensor
- LAN polling fallback reliability (needs testing with actual H5179 hardware)
- Email import from Gmail (`POST /capteurs/govee/sync`) — verify still works

### Stock
- Bulk stock entry creation (currently one at a time)

### Statistics Page
- Verify all aggregations include archived (terminee) cultures

---

## Réalisé — Session 2026-06-03

### Croisement Open Field ✅ — validé 2026-06-03

Nouvelle entité `ProjetOpenField` (N mères, pères identifiés ou inconnus, lien culture optionnel) séparée du croisement indoor.

**Backend**
- `ProjetOpenField` + `PlanteMereOpenField` dans `all_models.py` (tables créées via `create_all`)
- `backend/app/schemas/open_field.py` — schemas Pydantic
- `backend/app/routers/open_field.py` — CRUD projets + mères, endpoint `POST .../recolte` (crée PackGraine auto)
- Enregistré dans `main.py`

**Frontend**
- `frontend/src/api/openField.ts` — API client
- 3ème onglet "Open Field" dans `Croisement.tsx`
- `OpenFieldProjetCard` — carte projet avec liste des mères + statut pollinisation/récolte
- `NouveauProjetOpenFieldModal` — créer/modifier un projet
- `AddMereModal` — ajouter/modifier une mère (variété catalogue ou phénotype libre, père stock pollen / libre / inconnu)
- `RecolteOpenFieldModal` — récolter une mère + création PackGraine optionnelle
- **Mâles du projet** (`PlantePereOpenField`) — section dédiée par carte, checkboxes dans AddMereModal
- `id_peres` JSON sur `PlanteMereOpenField` — pères probables cochés par mère
- Récolte crée une **nouvelle `Variete`** (nom auto-généré `♀ × ♂`, éditable) + `PackGraine` + `Graine` individuelles dans le catalogue

### Archivage forcé à la clôture manuelle ✅ — validé 2026-06-03
- `_maybe_archive_culture` accepte `force=False` (défaut) — comportement auto inchangé
- `close_culture` appelle `_maybe_archive_culture(culture, db, force=True)` — toute clôture manuelle crée une entrée `HistoriqueCulture` quels que soient les statuts des plantes
- Fix : cultures clôturées de force étaient absentes des Statistiques

### ESPHome Integration ✅
- `backend/app/schemas/esphome.py` + `backend/app/routers/esphome.py`
- Stockage dans `GoveeDevice` (`modele="esphome"`) + `TemperatureLog` (`source="esphome"`)
- Poller Govee exclu des capteurs ESPHome (`modele != "esphome"`)
- Section UI accordéon dans Paramétrage → onglet Capteurs (Govee + ESPHome côte à côte)

### Offset VPD foliaire configurable ✅
- `AppSettings('vpd_leaf_offset')` — défaut 2.0°C
- `compute_vpd(temp, hum, leaf_offset)` — utilisé partout (Govee poller, manual poll, ESPHome push, entrée manuelle)
- Champ éditable dans Paramétrage → onglet Capteurs

### Édition dates culture ✅
- Composant `DatesModal` dans `Culture.tsx`
- Bouton "Dates" dans le header de `CultureDetail`
- Champs : démarrage, passage 12/12, début floraison, récolte estimée, date de fin

### Images Docker avec versioning ✅
- `backend/Dockerfile.prod` + `frontend/Dockerfile.prod` (multi-stage, production-ready)
- `.github/workflows/docker-publish.yml` — build + push sur `ghcr.io/mdf73/` à chaque tag `vX.Y.Z`
- `docker-compose.prod.yml` — déploiement depuis les images pré-buildées
- `update.sh` — script de mise à jour en une ligne : `./update.sh v1.2.0`

---

## Completed (Phase 1 Achievements)

Completed in Phase 1 (per `Documentation/PHASE1_SUMMARY.txt`):
- Full seed catalogue (Breeder → Variete → PackGraine → Graine)
- Culture lifecycle with plant tracking
- Stock management (fleur, hash, rosin)
- Rosin + hash extraction tracking
- Dashboard with 7 modules
- Govee sensor integration (cloud + LAN)
- Equipment inventory (Materiel)
- Growing spaces (EspaceCulture)
- Full recipe library (TCO, LSO, Arrosage, Fermentation, Réamendement, Engrais)
- Living soil tracking (SuiviSolVivant)
- Culture planning (PlanCulture + PlanCultureVariete)
- Substrate preparation calculator
- Historical culture archive
- Sensors monitoring page (charts with time windows)
- Import/Export (CSV)
- Parametrage (configurable dropdown management)
- Drying & curing tracking (SechageCuring page)

Completed since Phase 1 (wiki update 2026-04-25):
- PlanCulture harvest simulator — date picker (start) + veg duration (weeks) → fourchette récolte estimée calculée depuis `duree_flo_min`/`duree_flo_max` des variétés du plan

Completed since Phase 1 (wiki update 2026-04-24):
- `/croisement` — Genetics/breeding fully implemented: Pollen stock + Croisement (F1/F2/BX/S1/IBL), pollen expiry auto-calc, graines harvest
- `/recettes/schemas-engrais` — Nutrient schedule recipes fully implemented (RecetteEngrais + RecetteEngraisLigne par période)
- `/classement-varietes` — Variété scoring system: 2 dimensions (Culture /30 + Consommation /70), note finale /100, export CSV
- `/amendements` — Fertilizer/amendment product management (ProduitEngrais + AchatEngrais)
- Séchage/Curing refactored — dedicated sessions model (SessionSechage, PlantSechage, SessionCuring, PlantCuring)
- Vaporisateur inventory — `/api/vaporisateurs` (Vaporisateur + VapoConsommable, type chauffe, temp, consommables)

---

## Adding New TODOs

When a new pending item is identified:
1. Add it here under the appropriate priority section
2. Include: location (file/page), what needs to happen, any backend/frontend split
3. Mark as **Completed** and move to the bottom section once done
