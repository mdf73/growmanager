---
type: database
updated: 2026-04-09
sources: [models/all_models.py, routers/stock.py, routers/extractions.py]
---

# Database — Stock & Extractions Domain

## Stock

Finished product inventory. Each record is a jar/container of a product.

| Column | Type | Notes |
|---|---|---|
| `id_stock` | PK | |
| `id_variete` | FK → Variete (nullable) | Source variety |
| `id_bocal` | FK → Bocal (nullable) | Storage jar (legacy) |
| `id_materiel_bocal` | FK → Materiel (nullable) | Storage jar (new Materiel system) |
| `type_stock` | String | `Fleur` \| `Trim` \| `WPFF` \| `Poussière` \| `Hash` \| `Rosin` \| `Engrais` \| `Lampe` \| etc. |
| `sous_type_stock` | String (nullable) | Sub-type |
| `lampe_type` | String (nullable) | If type = Lampe |
| `engrais_type` | String (nullable) | If type = Engrais |
| `maillage` | String (nullable) | Mesh size (for hash/rosin) |
| `type_hash` | String (nullable) | Hash-specific type |
| `type_rosin` | String (nullable) | Rosin-specific type |
| `date_stock` | Date | Entry date |
| `date_fin_stock` | Date (nullable) | Set when consumed (soft delete) |
| `quantite_stock` | Float | Weight/quantity |

**Relationships:** → `Variete`, → `Bocal`, → `Materiel`, → many `RosinExtraction`

`date_fin_stock` is the soft-delete field — set via `POST /stock/{id}/sortie`.

---

## Recolte

Harvest record linking a culture to its seed origins.

| Column | Type | Notes |
|---|---|---|
| `id_recolte` | PK | |
| `id_culture` | FK → Culture | |
| `date_recolte` | Date | |
| `quantite` | Float | Grams harvested |

**M2M:** `RecolteCulture` (id_recolte, id_culture), `RecolteGraine` (id_recolte, id_graine)

---

## RosinExtraction

Rosin press session record.

| Column | Type | Notes |
|---|---|---|
| `id_rosinextraction` | PK | |
| `id_bocal` | FK → Bocal | Output container |
| `id_rosinbag` | FK → RosinBag | Filter bag used |
| `id_press` | FK → Press | Press used |
| `id_stock_source` | FK → Stock | Input material |
| `nom_variete_extract` | String | Variety name (denormalized) |
| `date_rosinextraction` | Date | |
| `temperature_extraction` | Float | Plate temperature (°C) |
| `maillage` | String | Bag mesh size |
| `duree_preheat` | Int | Preheat time (sec) |
| `duree_extraction` | Int | Press time (sec) |
| `sac_1_poids` … `sac_4_poids` | Float | Bag weight per pass (g) |
| `quantite_utilisee` | Float | Input material (g) |
| `presse_1_poids` … `presse_4_poids` | Float | Rosin collected per pass (g) |
| `quantite_extraite` | Float | Total output (g) |
| `info_rosinextraction` | Text (nullable) | |

Yield % = `quantite_extraite / quantite_utilisee * 100`

---

## HashExtraction

Hash extraction session (Polinator or Ice-o-lator method).

| Column | Type | Notes |
|---|---|---|
| `id_hashextraction` | PK | |
| `id_variete` | FK → Variete (nullable) | |
| `id_iceobag` | FK → IceOBag (nullable) | For Ice-o-lator |
| `id_stock_source` | FK → Stock (nullable) | Input material |
| `nom_variete_hash` | String | Variety name (denormalized) |
| `date_hashextraction` | Date | |
| `type_extraction` | String | `Polinator` \| `Ice-o-lator` |
| `duree_polinator` | Int (nullable) | Polinator run time (min) |
| `maillage_polinator` | String(20) (nullable) | Mesh size selected for Polinator (e.g. '120µ') — paramétrable via `maillages_polinator` |
| `passages` | JSON | Pass records |
| `sacs` | JSON | Bag data |
| `quantite_utilisee` | Float | Input (g) |
| `quantite_extraite` | Float | Output (g) |
| `info_hashextraction` | Text (nullable) | |

---

## See Also

- [[api/stock-extractions]] — endpoints
- [[database/equipment]] — Bocal, Press, RosinBag, IceOBag models
- [[database/graines]] — Variete model
