---
type: roadmap
updated: 2026-04-24
sources: [Documentation/claude.md, Documentation/Instructions de reprises v1.txt]
---

# Roadmap & Pending TODOs

## High Priority (From Active Session Checkpoint)

### 1. "Launch Culture" Button from PlanCulture
**Where:** `PlanCulture` page (`/plan-culture`)
**What:** Button that converts a `PlanCulture` (statut: `pret`) into an actual `Culture` by pre-filling `NouvellerCultureModal` with:
- `id_espace` from `PlanCulture.id_espace`
- Varieties + pot sizes from `PlanCultureVariete` records

**Backend:** `POST /plans-culture/{id}/launch` endpoint (to be created)
**Sets:** `PlanCulture.statut` → `lance`

---

### 2. Multi-Goal Display in Culture.tsx
**Where:** `Culture.tsx` page
**What:** `Culture.but_culture` is stored as a comma-separated string (e.g. `"Récolte,Hunt"`). The UI currently shows the raw string. Should parse and display as badges/chips.

**Fix:** Split on comma in `Culture.tsx`, render each goal as a `<span>` badge.

---

### 3. Verify ActionModal for Global Culture Harvest
**Where:** `components/culture/ActionModal.tsx`
**What:** When `global_culture = true` and `type_action = 'recolte'`, all active plants in the culture should be harvested simultaneously. Verify this is handled correctly — update all plant statuses + create individual harvest action records.

---

### 4. Export CSV for Plan de Culture
**Where:** `PlanCulture` page
**What:** Add CSV export of the current plan (variety name, breeder, nb_plantes, taille_pot_l, estimated nb_pots).

**Backend:** Add `GET /plans-culture/{id}/export/csv`
**Frontend:** Add export button + `importExport.ts` call

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
