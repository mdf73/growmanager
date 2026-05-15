---
type: roadmap
updated: 2026-05-14
sources: [Documentation/claude.md, Documentation/Instructions de reprises v1.txt, Documentation/GrowManager_Specifications_v4.docx]
sprint1_completed: 2026-05-10
---

# Roadmap & Pending TODOs

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
