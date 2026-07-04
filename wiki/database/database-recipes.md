---
type: database
updated: 2026-04-09
sources: [models/all_models.py, routers/recette_tco.py, routers/recette_lso.py, routers/recette_arrosage.py, routers/recette_fermentation.py, routers/recette_reamendement.py, routers/recette_engrais.py, routers/engrais.py]
---

# Database — Recipes & Fertilizers Domain

All recipes follow the same pattern: a header table + a line-items table (`*Ligne`) with one row per ingredient.

## ProduitEngrais (Fertilizer/Amendment Product)

The product catalog — what can be added to recipes.

| Column | Type | Notes |
|---|---|---|
| `id_produit` | PK | |
| `nom_produit` | String | Product name |
| `marque` | String (nullable) | Brand |
| `type_produit` | String | Category (engrais, amendement, etc.) |
| `conditionnement` | String | Packaging type |
| `volume_conditionnement` | Float | Package size |
| `unite_volume` | String | Unit (L, kg, g, etc.) |
| `prix_achat` | Float | |
| `date_achat` | Date (nullable) | |
| `date_peremption` | Date (nullable) | |
| `quantite_stock` | Float | Current stock |
| `unite_quantite` | String | Stock unit |
| `dosage_conseille` | String (nullable) | Recommended dosage |
| `notes` | Text (nullable) | |

**Relationship:** → many `AchatEngrais` (purchase history)

## AchatEngrais (Purchase History)

| Column | Type |
|---|---|
| `id_achat` | PK |
| `id_produit` | FK → ProduitEngrais |
| `date_achat` | Date |
| `volume_achat` | Float |
| `unite_volume` | String |
| `prix_achat` | Float |
| `date_peremption` | Date (nullable) |
| `conditionnement` | String (nullable) |
| `notes` | Text (nullable) |
| `created_at` | DateTime |

---

## Recipe Tables

### RecetteTCO (Tank Mix / Nutrient Tea)

Header:

| Column | Type | Notes |
|---|---|---|
| `id_recette_tco` | PK | |
| `nom_recette` | String | |
| `type_tco` | String | `Croissance` \| `Stretch` \| `Floraison` \| `Correctif` |
| `quantite_tco` | Float | Base volume |
| `unite_tco` | String | L, mL |
| `duree_oxygenation_h` | Float (nullable) | Oxygenation time |
| `notes` | Text (nullable) | |

Line items (`RecetteTCOLigne`): id_recette_tco, id_produit, quantite, unite, note_ligne, ordre

---

### RecetteLSO (Living Soil Mix)

Header:

| Column | Type | Notes |
|---|---|---|
| `id_recette_lso` | PK | |
| `nom_recette` | String | |
| `type_lso` | String | `Substrat de base` \| `Super soil` \| `Top dress` \| `Correctif` |
| `quantite_totale` | Float | Total volume |
| `unite_quantite` | String | L, kg |
| `notes` | Text (nullable) | |

Line items (`RecetteLSOLigne`): id_recette_lso, id_produit, quantite, unite, note_ligne, ordre

Used by: [[database/database-living-soil]] SuiviSolVivant, Plant.id_recette_sol, PreparationSubstrat

---

### RecetteReamendement (Top Dressing)

Header:

| Column | Type | Notes |
|---|---|---|
| `id_recette_reamend` | PK | |
| `nom_recette` | String | |
| `volume_pot` | Float | Target pot size |
| `unite_pot` | String | L |
| `notes` | Text (nullable) | |

Line items (`RecetteReamendementLigne`): id_recette_reamend, id_produit, quantite, unite, note_ligne, ordre

---

### RecetteArrosage (Watering Recipe)

Header:

| Column | Type | Notes |
|---|---|---|
| `id_recette_arrosage` | PK | |
| `nom_recette` | String | |
| `type_arrosage` | String | `Eau simple` \| `Eau+amendements` |
| `quantite_eau` | Float | |
| `unite_eau` | String | L, mL |
| `notes` | Text (nullable) | |

Line items (`RecetteArrosageLigne`): id_recette_arrosage, id_produit, quantite, unite, note_ligne, ordre

---

### RecetteFermentation (Fermentation Recipe)

Header:

| Column | Type | Notes |
|---|---|---|
| `id_recette_ferm` | PK | |
| `nom_recette` | String | |
| `type_fermentation` | String | `AACT` \| `Compost tea` \| `Lactofermentation` \| `Bokashi` \| `JADAM JLF` |
| `volume_total` | Float | |
| `unite_volume` | String | |
| `duree_fermentation` | Int (nullable) | Days |
| `notes` | Text (nullable) | |

Line items (`RecetteFermentationLigne`): id_recette_ferm, id_produit, quantite, unite, note_ligne, ordre

---

### RecetteEngrais (Nutrient Schedule Recipe)

Header:

| Column | Type | Notes |
|---|---|---|
| `id_recette` | PK | |
| `nom_recette` | String | |
| `type_recette` | String | |
| `periode` | String | Growth period |
| `semaine` | Int (nullable) | Week number |
| `ph_cible` | Float (nullable) | Target pH |
| `notes` | Text (nullable) | |

Line items (`RecetteEngraisLigne`): id_recette, id_produit, dosage, unite, ordre

---

## See Also

- [[api/api-recipes]] — CRUD endpoints for all recipe types
- [[database/database-living-soil]] — SuiviSolVivant uses RecetteLSO, RecetteReamendement, etc.
- [[features/living-soil-system]] — how recipes are applied
