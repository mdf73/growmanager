---
type: database
updated: 2026-04-09
sources: [models/all_models.py, routers/plan_culture.py, routers/preparation_substrat.py, routers/historique_culture.py]
---

# Database — Planning & History Domain

## PlanCulture

A culture plan/blueprint — designed before launching an actual culture.

| Column | Type | Notes |
|---|---|---|
| `id_plan` | PK | |
| `nom` | String | Plan name |
| `id_espace` | FK → EspaceCulture (nullable) | Target space |
| `statut` | String | `brouillon` \| `pret` \| `lance` |
| `notes` | Text (nullable) | |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

**Relationship:** → many `PlanCultureVariete`

Status: `brouillon` (draft) → `pret` (ready) → `lance` (launched — culture created from this plan)

**TODO:** "Launch culture" button from PlanCulture page (pre-fills NouvellerCultureModal) — see [[roadmap]]

---

## PlanCultureVariete

A variety line within a culture plan — which pack of seeds, how many plants, what pot size.

| Column | Type | Notes |
|---|---|---|
| `id_plan_variete` | PK | |
| `id_plan` | FK → PlanCulture | |
| `id_packgraine` | FK → PackGraine | Seed pack to use |
| `nb_plantes` | Int | Number of plants |
| `taille_pot_l` | Float | Pot size in liters |
| `ordre` | Int | Display order |

Pot count per variety uses: `nb_pots = round(surface_m2 * 20.8 * volume_l ** -0.59)` — see [[architecture/patterns]]

---

## PreparationSubstrat

Log of a substrate preparation session.

| Column | Type | Notes |
|---|---|---|
| `id_preparation` | PK | |
| `date_preparation` | Date | |
| `volume_total_l` | Float | Total substrate volume |
| `type_sol` | String | Soil type |
| `id_recette_lso` | FK → RecetteLSO (nullable) | Recipe used |
| `nom_recette_lso` | String (nullable) | Denormalized name |
| `configuration_pots` | JSON | Pot sizes and counts used |
| `resultat` | JSON | Calculated ingredient quantities |
| `notes` | Text (nullable) | |
| `created_at` | DateTime | |

`configuration_pots` and `resultat` are JSON — the substrate calculator stores the full calculation result here for reproducibility.

---

## HistoriqueCulture

Archived record of a completed past grow cycle (created via `POST /cultures/{id}/close`).

| Column | Type | Notes |
|---|---|---|
| `id_historique_culture` | PK | |
| `date_debut` | Date | |
| `date_fin` | Date | |
| `tente` | String (nullable) | Tent name (denormalized) |
| `lampe` | String (nullable) | Lamp description |
| `puissance` | Int (nullable) | Lamp watts |
| `type_culture` | String (nullable) | |
| `engrais` | String (nullable) | Fertilizers used (denormalized) |
| `substrat` | String (nullable) | |
| `id_espace` | FK → EspaceCulture (nullable) | |
| `notes` | Text (nullable) | |

**Relationship:** → many `HistoriquePlant`

---

## HistoriquePlant

Archived plant record within a historical culture.

| Column | Type | Notes |
|---|---|---|
| `id_historique_plant` | PK | |
| `id_historique_culture` | FK → HistoriqueCulture | |
| `id_variete` | FK → Variete (nullable) | |
| `variete_nom` | String | Denormalized variety name |
| `numero_plant` | Int (nullable) | |
| `date_debut_plant` | Date (nullable) | |
| `date_fin_plant` | Date (nullable) | |
| `prix_graine` | Float (nullable) | |
| `quantite_recoltee` | Float (nullable) | Grams |
| `notes` | Text (nullable) | |

**Relationship:** → `HistoriqueCulture`, → `Variete`

---

## See Also

- [[api/planning]] — plan-culture + preparation-substrat endpoints
- [[database/graines]] — PackGraine (referenced in PlanCultureVariete)
- [[database/spaces]] — EspaceCulture (target space for plans)
- [[features/culture-lifecycle]] — how cultures get archived
