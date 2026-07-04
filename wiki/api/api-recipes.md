---
type: api
updated: 2026-04-09
sources: [routers/recette_tco.py, routers/recette_lso.py, routers/recette_arrosage.py, routers/recette_fermentation.py, routers/recette_reamendement.py, routers/recette_engrais.py, routers/engrais.py]
---

# API — Recipes & Fertilizers

All recipe endpoints follow standard CRUD. Line items are included in the response.

## Fertilizer Products (Engrais)

Router: `engrais.py` | Prefix: `/api/engrais`

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/` | — | `list[ProduitEngraisRead]` | |
| GET | `/{id}` | — | `ProduitEngraisRead` | |
| GET | `/{id}/achats` | — | `list[AchatEngraisRead]` | Purchase history |
| POST | `/` | `ProduitEngraisCreate` | `ProduitEngraisRead` | |
| PUT | `/{id}` | `ProduitEngraisUpdate` | `ProduitEngraisRead` | |
| POST | `/{id}/recharger` | `RechargePayload` | `ProduitEngraisRead` | Add to stock |
| POST | `/{id}/vider-stock` | — | `ProduitEngraisRead` | Set stock to 0 |
| DELETE | `/{id}` | — | 204 | |

## TCO Recipes (Tank Mix)

Prefix: `/api/recettes/tco`

Types: `Croissance` | `Stretch` | `Floraison` | `Correctif`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/` | — | `list[RecetteTCORead]` (with lines) |
| POST | `/` | `RecetteTCOCreate` | `RecetteTCORead` |
| PUT | `/{id}` | `RecetteTCOUpdate` | `RecetteTCORead` |
| DELETE | `/{id}` | — | 204 |

## LSO Recipes (Living Soil Mix)

Prefix: `/api/recettes/lso`

Types: `Substrat de base` | `Super soil` | `Top dress` | `Correctif`

Standard CRUD — same pattern as TCO.

## Réamendement Recipes (Top Dressing)

Prefix: `/api/recettes/reamendement`

Standard CRUD.

## Arrosage Recipes (Watering)

Prefix: `/api/recettes/arrosage`

Types: `Eau simple` | `Eau+amendements`

Standard CRUD.

## Fermentation Recipes

Prefix: `/api/recettes/fermentation`

Types: `AACT` | `Compost tea` | `Lactofermentation` | `Bokashi` | `JADAM JLF`

Standard CRUD.

## Engrais Recipes (Nutrient Schedule)

Prefix: `/api/recettes/engrais`

Standard CRUD.

---

## Frontend Clients

- `frontend/src/api/recetteTCO.ts`
- `frontend/src/api/recetteLSO.ts`
- `frontend/src/api/recetteArrosage.ts`
- `frontend/src/api/recetteFermentation.ts`
- `frontend/src/api/recetteReamendement.ts`
- `frontend/src/api/recetteEngrais.ts`
- `frontend/src/api/engrais.ts`

## See Also

- [[database/database-recipes]] — models
- [[api/api-living-soil]] — how recipes are applied to soil pots
