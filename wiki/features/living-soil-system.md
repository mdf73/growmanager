---
type: feature
updated: 2026-04-09
sources: [models/all_models.py, routers/suivi_sol_vivant.py, routers/preparation_substrat.py]
---

# Feature — Living Soil System

## Overview

The living soil (LSO — Living Soil Organic) system tracks the full lifecycle of a living soil pot — from initial preparation through amendments, waterings, fermentation teas, and culture usage.

The system involves three interconnected areas:
1. **Recipe library** — define reusable formulas
2. **Substrate preparation** — log substrate mixing sessions
3. **Pot tracking** — track individual pots over time

## Recipe Library

Five recipe types are used in living soil management:

| Recipe Type | Table | Used For |
|---|---|---|
| LSO | `RecetteLSO` | Initial soil mix (substrate de base, super soil, top dress) |
| Réamendement | `RecetteReamendement` | Top-dressing between cycles |
| Arrosage | `RecetteArrosage` | Watering with amendments |
| TCO | `RecetteTCO` | Aerated compost tea / nutrient tea |
| Fermentation | `RecetteFermentation` | AACT, compost tea, lactofermentation, bokashi, JADAM JLF |

All recipes use header + `*Ligne` line items with `ProduitEngrais` references. → [[database/database-recipes]]

## Substrate Preparation (PreparationSubstrat)

When preparing a new batch of soil:

1. Open `/preparation-substrat` page
2. Select pot configuration (sizes + counts)
3. Select LSO recipe
4. Calculator computes ingredient quantities for total volume
5. Submit → logs a `PreparationSubstrat` record with `configuration_pots` (JSON) and `resultat` (JSON)

The result stores ingredient quantities so the batch can be reproduced exactly.

## Pot Tracking (SuiviSolVivant)

Each physical pot of living soil gets its own `SuiviSolVivant` record.

### Creating a Pot Record
```
POST /api/suivi-sol-vivant
{
  nom_pot: "Pot LSO 50L — Tente 1",
  id_materiel: 42,          // pot from equipment inventory
  id_recette_lso: 3,        // initial soil recipe used
  volume_pot_l: 50,
  date_preparation: "2026-01-15"
}
```

### Logging Events

As the pot ages, log each intervention:

| Event | Endpoint | Notes |
|---|---|---|
| Amendment applied | `POST /suivi-sol-vivant/{id}/reamendements` | Top-dressing between cultures |
| Watering logged | `POST /suivi-sol-vivant/{id}/arrosages` | With or without amendments |
| TCO applied | `POST /suivi-sol-vivant/{id}/tcos` | Aerated compost tea |
| Fermentation applied | `POST /suivi-sol-vivant/{id}/fermentations` | Bokashi, JADAM, etc. |
| Culture noted | `POST /suivi-sol-vivant/{id}/cultures` | Record which culture used the pot |

### Linking to Plants

When a plant uses a living soil pot:
- `Plant.id_recette_sol` — references the LSO recipe used for that plant's substrate
- `Plant.substrat` — text description

The `SuiviCulture` sub-record on the pot links back to the culture period.

## SuiviSolsVivants Page

Route: `/suivi-sols-vivants`

Displays:
- All pot records
- Preparation timeline
- Amendments applied per pot
- Costs (from recipe ingredient prices)
- Soil age (days since date_preparation)

## See Also

- [[database/database-living-soil]] — SuiviSolVivant + sub-tables models
- [[database/database-recipes]] — all recipe models
- [[api/api-living-soil]] — suivi-sol-vivant endpoints
- [[api/api-recipes]] — recipe CRUD endpoints
- [[api/api-planning]] — PreparationSubstrat endpoint
