---
type: api
updated: 2026-04-09
sources: [routers/cultures.py, api/cultures.ts]
---

# API — Cultures

Router: `backend/app/routers/cultures.py` | Prefix: `/api/cultures`

## Culture CRUD

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/` | — | `list[CultureWithDetails]` | All cultures |
| GET | `/actives` | — | `list[CultureWithDetails]` | Active only |
| GET | `/{id}` | — | `CultureWithDetails` | Single culture |
| POST | `/` | `CultureCreate` | `CultureRead` | Create culture |
| PUT | `/{id}` | `CultureUpdate` | `CultureRead` | Update culture |
| DELETE | `/{id}` | — | `{message}` | Delete culture |
| GET | `/{id}/recap` | — | detailed summary | Full culture recap |
| POST | `/{id}/close` | — | — | Archive culture → HistoriqueCulture |
| POST | `/{id}/transfer` | `PlantTransferPayload` | — | Move plant to another culture |

**Note:** `/actives` is a static route — must be declared before `/{id}` in router file. → [[architecture/patterns]]

`CultureWithDetails` includes enriched data: plant list, associated equipment names, action counts.

## Plants

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/{id}/plants` | — | `list[enriched plant data]` |
| POST | `/{id}/plants` | `PlantCreate` | `PlantRead` |
| PUT | `/{id}/plants/{plant_id}` | `PlantUpdate` | `PlantRead` |
| DELETE | `/{id}/plants/{plant_id}` | — | `{message}` |

Plant data is enriched: includes `variete_nom`, `breeder_nom` from related records. → [[architecture/patterns]] (enrichment pattern)

## Actions (Calendar)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/{id}/actions` | — | `list[ActionRead]` |
| POST | `/{id}/actions` | `ActionCreate` | `ActionRead` |
| PUT | `/{id}/actions/{action_id}` | `ActionCreate` | `ActionRead` |
| DELETE | `/{id}/actions/{action_id}` | — | `{message}` |

`ActionCreate` fields: `id_plant` (nullable), `date_action`, `type_action`, `parametres` (JSON), `note`, `global_culture` (bool).

## Frontend Client

`frontend/src/api/cultures.ts` — all culture operations.

## See Also

- [[database/culture]] — Culture, Plant, ActionCalendrier models
- [[features/culture-lifecycle]] — status transitions
- [[features/plant-lifecycle]] — plant status flow
