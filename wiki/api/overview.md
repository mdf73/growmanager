---
type: api
updated: 2026-04-24
sources: [main.py]
---

# API Overview

**Base URL:** `/api` (proxied from frontend port 5173 → backend port 8000)

**Auth:** None (dev setup — open)

**CORS:** Open (all origins/methods/headers)

**Format:** JSON request/response bodies

**Health check:** `GET /health` → `{"status": "ok"}`

---

## All Registered Routers

| Router File | Prefix | Domain |
|---|---|---|
| `breeders.py` | `/api/breeders` | Seed producers |
| `varietes.py` | `/api/varietes` | Cannabis varieties |
| `graines.py` | `/api` | Seeds, packs, catalogue |
| `fournisseurs.py` | `/api/fournisseurs` | Suppliers |
| `cultures.py` | `/api/cultures` | Cultures, plants, actions |
| `stock.py` | `/api/stock` | Finished product stock |
| `extractions.py` | `/api` | Rosin + hash extractions |
| `dashboard.py` | `/api` | Dashboard stats |
| `materiel.py` | `/api/materiel` | Equipment inventory |
| `parametre.py` | `/api/parametres` | Configurable dropdown values |
| `engrais.py` | `/api/engrais` | Fertilizer products |
| `recette_engrais.py` | `/api/recettes/engrais` | Nutrient schedule recipes |
| `recette_tco.py` | `/api/recettes/tco` | Tank mix recipes |
| `recette_lso.py` | `/api/recettes/lso` | Living soil recipes |
| `recette_reamendement.py` | `/api/recettes/reamendement` | Top-dressing recipes |
| `recette_arrosage.py` | `/api/recettes/arrosage` | Watering recipes |
| `recette_fermentation.py` | `/api/recettes/fermentation` | Fermentation recipes |
| `suivi_sol_vivant.py` | `/api/suivi-sol-vivant` | Living soil pot tracking |
| `espaces.py` | `/api/espaces` | Growing spaces |
| `capteurs.py` | `/api` | Govee sensors + temperature logs |
| `plan_culture.py` | `/api/plans-culture` | Culture planning |
| `preparation_substrat.py` | `/api/preparation-substrat` | Substrate preparation |
| `historique_culture.py` | `/api/historique-cultures` | Past culture archives |
| `import_export.py` | `/api/import-export` | CSV batch import/export |
| `sechage.py` | `/api/sechage` | Drying sessions (SessionSechage + PlantSechage) |
| `curing.py` | `/api/curing` | Curing sessions (SessionCuring + PlantCuring) |
| `notation_variete.py` | `/api/notations` | Variety scoring/ranking system |
| `vaporisateur.py` | `/api/vaporisateurs` | Vaporizer inventory + consumables |
| `croisement.py` | `/api/croisements` | Genetics crossing (Pollen + Croisement) |
| `calendrier.py` | `/api/calendrier` | Global calendar view — all events all cultures |

---

## Detailed Documentation

- [[api/cultures]] — culture, plant, action endpoints
- [[api/graines]] — seeds, packs, catalogue
- [[api/stock-extractions]] — stock + rosin + hash
- [[api/recipes]] — all recipe types
- [[api/living-soil]] — suivi-sol-vivant
- [[api/infrastructure]] — sensors, espaces, materiel, parametres, fournisseurs
- [[api/planning]] — plan-culture, preparation-substrat, historique
