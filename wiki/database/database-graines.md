---
type: database
updated: 2026-04-09
sources: [models/all_models.py, routers/graines.py, routers/breeders.py, routers/varietes.py]
---

# Database — Seeds & Genetics Domain

## Breeder

Seed producer/brand.

| Column | Type | Notes |
|---|---|---|
| `id_breeder` | PK | |
| `nom_breeder` | String | |
| `origine_breeder` | String (nullable) | Country/region |
| `information_breeder` | Text (nullable) | |

**Relationship:** → many `Graine`

---

## Variete

A cannabis variety/strain.

| Column | Type | Notes |
|---|---|---|
| `id_variete` | PK | |
| `nom_variete` | String | |
| `croisement_variete` | String (nullable) | Genetics (e.g. "OG Kush × Durban") |
| `informations_variete` | Text (nullable) | |
| `lien_web` | String (nullable) | Breeder's website link |

**Relationships:** → many `Graine`, → many `Stock`, → many `HashExtraction`

---

## PackGraine

A purchased seed pack (may contain multiple individual seeds).

| Column | Type | Notes |
|---|---|---|
| `id_packgraine` | PK | |
| `id_fournisseur` | FK → Fournisseur (nullable) | Where it was bought |
| `nbr_graines` | Int | Seeds in the pack |
| `prix_achat` | Float (nullable) | Pack price |
| `date_achat` | Date (nullable) | |
| `duree_conservation_mois` | Int (nullable) | Shelf life in months |

**Relationship:** → many `Graine`, → FK from `PlanCultureVariete`

---

## Graine

Individual seed (one per plant that will ever be germinated).

| Column | Type | Notes |
|---|---|---|
| `id_graine` | PK | |
| `id_breeder` | FK → Breeder | |
| `id_variete` | FK → Variete | |
| `id_packgraine` | FK → PackGraine (nullable) | |
| `duree_flo_min` | Int (nullable) | Min flowering days |
| `duree_flo_max` | Int (nullable) | Max flowering days |
| `types_graines` | String | `Regular` \| `Féminisée` \| `Auto` |
| `prix_achat` | Float (nullable) | Per-seed price |
| `edition_limite` | Boolean | Limited edition flag |
| `date_achat` | Date (nullable) | |
| `utilisee` | Boolean | True once germinated (planted) |

**Relationships:** → many `Culture` (M2M), → many `Plant`, → many `Recolte` (M2M)

Toggle `utilisee` via `PATCH /graines/{id}/toggle`.

---

## Fournisseur

Supplier / seed shop.

| Column | Type | Notes |
|---|---|---|
| `id_fournisseur` | PK | |
| `nom_fournisseur` | String | |
| `site_web` | String (nullable) | |

**Relationships:** → many `PackGraine`, `Box`, `Lampe`, `Pot`, `Irrigation`, `Ventilation`, `Bocal`, `Press`, `RosinBag`, `IceOBag`, `Engrais`

---

## Catalogue View

`GET /catalogue` returns a denormalized view joining Graine + Variete + Breeder + PackGraine — used in the seed browser on the Graines page and in PlanCulture variety selection.

## See Also

- [[api/api-graines]] — endpoints
- [[database/database-culture]] — Culture/Plant models
- [[database/database-planning]] — PlanCultureVariete references PackGraine
