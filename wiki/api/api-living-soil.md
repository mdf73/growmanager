---
type: api
updated: 2026-04-09
sources: [routers/suivi_sol_vivant.py, api/suiviSolVivant.ts]
---

# API — Living Soil Tracking

Router: `suivi_sol_vivant.py` | Prefix: `/api/suivi-sol-vivant`

## Pot Records (SuiviSolVivant)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/` | — | `list[SuiviSolVivantRead]` |
| GET | `/{id}` | — | `SuiviSolVivantRead` (with all sub-events) |
| POST | `/` | `SuiviSolVivantCreate` | `SuiviSolVivantRead` |
| PUT | `/{id}` | `SuiviSolVivantUpdate` | `SuiviSolVivantRead` |
| DELETE | `/{id}` | — | 204 |

## Amendment Events

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/{id}/reamendements` | `SuiviReamendementCreate` | `SuiviReamendementRead` |
| DELETE | `/{id}/reamendements/{event_id}` | — | 204 |

## Watering Events

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/{id}/arrosages` | `SuiviArrosageCreate` | `SuiviArrosageRead` |
| DELETE | `/{id}/arrosages/{event_id}` | — | 204 |

## TCO Application Events

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/{id}/tcos` | `SuiviTCOCreate` | `SuiviTCORead` |
| DELETE | `/{id}/tcos/{event_id}` | — | 204 |

## Fermentation Application Events

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/{id}/fermentations` | `SuiviFermentationCreate` | `SuiviFermentationRead` |
| DELETE | `/{id}/fermentations/{event_id}` | — | 204 |

## Culture Usage Events

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/{id}/cultures` | `SuiviCultureCreate` | `SuiviCultureRead` |
| DELETE | `/{id}/cultures/{event_id}` | — | 204 |

## Frontend Client

`frontend/src/api/suiviSolVivant.ts`

## See Also

- [[database/database-living-soil]] — models
- [[api/api-recipes]] — recipes that can be applied to soil
- [[features/living-soil-system]] — full workflow
