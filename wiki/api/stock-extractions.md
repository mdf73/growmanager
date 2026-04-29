---
type: api
updated: 2026-04-09
sources: [routers/stock.py, routers/extractions.py, api/stock.ts]
---

# API — Stock & Extractions

## Stock

Router: `stock.py` | Prefix: `/api/stock`

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/` | — | `list[StockWithVariete]` | All stock entries |
| GET | `/{id}` | — | `StockWithVariete` | Single entry |
| GET | `/bocaux-disponibles` | query: `current_stock_id?` | `list[BocalDisponible]` | Available jars (not in use) |
| POST | `/` | `StockCreate` | `StockRead` | Add stock entry |
| PUT | `/{id}` | `StockCreate` | `StockRead` | Update stock |
| POST | `/{id}/sortie` | — | `StockWithVariete` | Mark as consumed (sets `date_fin_stock`) |
| DELETE | `/{id}` | — | 204 | Hard delete |

**Note:** `/bocaux-disponibles` is a static route — must be declared before `/{id}`. → [[architecture/patterns]]

`StockWithVariete` includes enriched variete name.

`POST /{id}/sortie` is the soft-delete — sets `date_fin_stock` to today. Used when a jar is finished.

## Rosin Extractions

Router: `extractions.py` | Prefix: `/api/rosin`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/rosin` | — | `list[RosinExtractionRead]` |
| GET | `/rosin/stats` | — | `ExtractionStats` |
| POST | `/rosin` | `RosinExtractionCreate` | `RosinExtractionRead` |
| DELETE | `/rosin/{id}` | — | 204 |

`ExtractionStats`: count, total input (g), total output (g), avg yield %.

## Hash Extractions

Router: `extractions.py` | Prefix: `/api/hash`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/hash` | — | `list[HashExtractionRead]` |
| GET | `/hash/stats` | — | `{nombre_extractions, total_entree_g, total_hash_g, ratio_moyen}` |
| POST | `/hash` | `HashExtractionCreate` | `HashExtractionRead` |
| DELETE | `/hash/{id}` | — | 204 |

## Dashboard

| Method | Path | Returns |
|---|---|---|
| GET | `/dashboard/stats` | `DashboardFullStats` |
| GET | `/dashboard/arrosage-boxes` | `list[BoxArrosageStats]` |

`DashboardFullStats` modules: cultures actives, en séchage, en curing, stock (fleur, hash, rosin), production stats, seeds inventory.

`BoxArrosageStats` (2026-04-27): pour chaque culture active → `id_culture`, `culture_nom`, `box_label` (dimensions), `derniere_arrosage` (date ISO), `jours_depuis_arrosage` (int). Trié par urgence (sans arrosage en premier, puis plus de jours en premier). Source : `ActionCalendrier` filtré sur `type_action IN ('arrosage_eau', 'arrosage_engrais')`.

Legacy: `GET /dashboard` → `DashboardStats` (older format, kept for compatibility).

## Frontend Clients

- `frontend/src/api/stock.ts`
- `frontend/src/api/dashboard.ts`

## See Also

- [[database/stock]] — Stock, RosinExtraction, HashExtraction models
