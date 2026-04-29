---
type: api
updated: 2026-04-09
sources: [routers/graines.py, routers/breeders.py, routers/varietes.py, routers/fournisseurs.py, api/graines.ts]
---

# API — Seeds & Genetics

## Breeders

Router: `breeders.py` | Prefix: `/api/breeders`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/` | — | `list[BreederRead]` |
| GET | `/{id}` | — | `BreederRead` |
| POST | `/` | `BreederCreate` | `BreederRead` |
| PUT | `/{id}` | `BreederCreate` | `BreederRead` |
| DELETE | `/{id}` | — | `{message}` |

## Varietes

Router: `varietes.py` | Prefix: `/api/varietes`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/` | — | `list[VarieteRead]` |
| GET | `/{id}` | — | `VarieteRead` |
| POST | `/` | `VarieteCreate` | `VarieteRead` |
| PUT | `/{id}` | `VarieteCreate` | `VarieteRead` |
| DELETE | `/{id}` | — | `{message}` |

## Fournisseurs (Suppliers)

Router: `fournisseurs.py` | Prefix: `/api/fournisseurs`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/` | — | `list[FournisseurRead]` |
| GET | `/{id}` | — | `FournisseurRead` |
| POST | `/` | `FournisseurCreate` | `FournisseurRead` |
| PUT | `/{id}` | `FournisseurCreate` | `FournisseurRead` |
| DELETE | `/{id}` | — | `{message}` |

## Packs & Graines

Router: `graines.py` | Prefix: `/api`

### Seed Packs

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/packs` | — | `list[PackGraineRead]` | |
| GET | `/packs/{id}` | — | `PackGraineRead` | |
| GET | `/packs/{id}/graines` | — | `list[GraineSimple]` | Seeds in this pack |
| POST | `/packs` | `PackGraineCreate` | `PackGraineRead` | Pack header only |
| POST | `/packs/complet` | `PackGraineCompletCreate` | `PackGraineCompletRead` | Pack + all seeds in one call |
| PUT | `/packs/{id}/complet` | `PackGraineCompletUpdate` | `PackGraineCompletRead` | Update pack + seeds |
| DELETE | `/packs/{id}` | — | `{message}` | |

### Individual Seeds

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/graines` | — | `list[GraineRead]` | |
| GET | `/graines/{id}` | — | `GraineRead` | |
| POST | `/graines` | `GraineCreate` | `GraineRead` | |
| PUT | `/graines/{id}` | `GraineCreate` | `GraineRead` | |
| PATCH | `/graines/{id}/toggle` | — | `GraineSimple` | Toggle `utilisee` flag |
| DELETE | `/graines/{id}` | — | `{message}` | |

### Catalogue

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/catalogue` | `list[CatalogueItem]` | Denormalized: Graine + Variete + Breeder + Pack |

Used by: Graines page search, PlanCulture variety picker.

## Frontend Clients

- `frontend/src/api/graines.ts` — seeds and packs
- `frontend/src/api/breeders.ts` — breeders
- `frontend/src/api/varietes.ts` — varieties
- `frontend/src/api/fournisseurs.ts` — suppliers

## See Also

- [[database/graines]] — models
