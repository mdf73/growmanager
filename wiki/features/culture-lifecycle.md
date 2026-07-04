---
type: feature
updated: 2026-04-09
sources: [models/all_models.py, routers/cultures.py, Documentation/Instructions de reprises v1.txt]
---

# Feature — Culture Lifecycle

## Status Flow

```
active → sechage_curing → terminee
```

Stored in `Culture.statut`.

## Status Descriptions

| Status | Meaning |
|---|---|
| `active` | Grow cycle in progress (germination through harvest) |
| `sechage_curing` | All plants harvested; drying + curing in progress |
| `terminee` | Culture complete; archived to HistoriqueCulture |

## Phase Tracking

Within `active` status, `Culture.phase` tracks the current growing phase:
- `germination`
- `croissance` (veg)
- `floraison`

Date fields on Culture track phase transitions:
- `date_germination`
- `date_debut_croissance`
- `date_passage_12_12` (light flip)
- `date_debut_floraison`

`duree_croissance` and `duree_stretch` (days) are calculated and stored.

## Culture Types

`Culture.but_culture` — comma-separated goals:
- `Récolte` — standard harvest for consumption
- `Hunt` — pheno hunting (selecting the best plant)
- `Reproduction` — keeping mothers for cloning

**TODO:** Multi-goal display parsing in Culture.tsx — currently shows raw comma-string — see [[roadmap]]

## External Plants Mode

A culture can accept external plants (boutures/clones from outside):
- External cultures set `origine = 'bouture'` or `'clone'` on plants
- External cultures may start in `sechage_curing` status if plants arrive post-harvest

## Closing a Culture

`POST /cultures/{id}/close` — archives the culture:
1. Sets `Culture.statut` → `terminee`
2. Creates `HistoriqueCulture` record with denormalized data
3. Creates `HistoriquePlant` records for each plant
4. Culture remains in DB (not deleted) for data integrity

## Creating a Culture

`POST /cultures/` with `CultureCreate`:
```typescript
{
  nom: string,
  id_box?: number,
  id_espace?: number,
  type_culture: string,
  type_eclairage: string,
  but_culture: string,        // comma-separated goals
  date_debut: string,
  date_recolte_estimee?: string,
}
```

Multiple goals are stored as a comma-separated string (e.g. `"Récolte,Hunt"`).

## From Plan to Culture

**TODO:** Implement "Launch culture" button in PlanCulture page that pre-fills `NouvellerCultureModal` with:
- `id_espace` from `PlanCulture.id_espace`
- Varieties + pot sizes from `PlanCultureVariete`

Sets `PlanCulture.statut` → `lance` when launched.

Full TODO context: → [[roadmap]]

## See Also

- [[database/culture]] — Culture model
- [[database/database-planning]] — HistoriqueCulture, PlanCulture
- [[features/plant-lifecycle]] — individual plant status
- [[api/cultures]] — close + transfer endpoints
- [[api/api-planning]] — historique-cultures endpoints
