---
type: api
updated: 2026-04-09
sources: [routers/plan_culture.py, routers/preparation_substrat.py, routers/historique_culture.py, api/planCulture.ts, api/preparationSubstrat.ts, api/historiqueCulture.ts]
---

# API — Planning & History

## Culture Plans

Router: `plan_culture.py` | Prefix: `/api/plans-culture`

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/` | — | `list[PlanCultureRead]` | |
| GET | `/{id}` | — | `PlanCultureRead` | With varieties |
| GET | `/{id}/varietes` | — | `list[PlanVarieteRead]` | |
| POST | `/` | `PlanCultureCreate` | `PlanCultureRead` | |
| PUT | `/{id}` | `PlanCultureUpdate` | `PlanCultureRead` | |
| DELETE | `/{id}` | — | 204 | |

### Utility Endpoints (declared before `/{id}`)

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/utils/nb-pots` | `surface_m2`, `volume_l` | `NbPotsResult` |
| GET | `/utils/catalogue` | — | Seed catalogue for plan variety picker |

`NbPotsResult`: `{nb_pots: int}` — from formula `round(surface_m2 * 20.8 * volume_l ** -0.59)`

## Substrate Preparation

Router: `preparation_substrat.py` | Prefix: `/api/preparation-substrat`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/` | — | `list[PreparationSubstratRead]` |
| GET | `/{id}` | — | `PreparationSubstratRead` |
| POST | `/` | `PreparationSubstratCreate` | `PreparationSubstratRead` |

The POST calculates ingredient quantities from the pot configuration and stores the result as JSON.

## Historical Cultures

Router: `historique_culture.py` | Prefix: `/api/historique-cultures`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/` | — | `list[HistoriqueCultureRead]` |
| GET | `/{id}` | — | `HistoriqueCultureRead` (with plants) |
| POST | `/` | `HistoriqueCultureCreate` | `HistoriqueCultureRead` |
| DELETE | `/{id}` | — | 204 |

Historical cultures are also created automatically when `POST /cultures/{id}/close` is called.

## Frontend Clients

- `frontend/src/api/planCulture.ts`
- `frontend/src/api/preparationSubstrat.ts`
- `frontend/src/api/historiqueCulture.ts`

## See Also

- [[database/planning]] — PlanCulture, PlanCultureVariete, PreparationSubstrat, HistoriqueCulture models
- [[features/culture-lifecycle]] — how cultures get closed and archived
- [[roadmap]] — TODO: "Launch culture" button from PlanCulture
