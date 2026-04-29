---
type: database
updated: 2026-04-09
sources: [models/all_models.py, routers/suivi_sol_vivant.py]
---

# Database — Living Soil Tracking Domain

## SuiviSolVivant

A living soil pot record. Tracks the entire lifecycle of a pot of living soil.

| Column | Type | Notes |
|---|---|---|
| `id_suivi` | PK | |
| `nom_pot` | String | Pot identifier name |
| `id_materiel` | FK → Materiel (nullable) | The physical pot (from inventory) |
| `id_recette_lso` | FK → RecetteLSO (nullable) | Initial soil recipe used |
| `volume_pot_l` | Float | Pot volume in liters |
| `date_preparation` | Date | When the pot was prepared |
| `commentaires` | Text (nullable) | |

**Relationships:** → many `SuiviReamendement`, `SuiviArrosage`, `SuiviTCO`, `SuiviFermentation`, `SuiviCulture`

---

## Sub-tracking Tables

All follow the same pattern: foreign keys to `SuiviSolVivant` and to a recipe, plus date + notes.

### SuiviReamendement (Amendment Application)
| Column | Type |
|---|---|
| `id_suivi_reamend` | PK |
| `id_suivi` | FK → SuiviSolVivant |
| `id_recette_reamend` | FK → RecetteReamendement |
| `date_application` | Date |
| `notes` | Text (nullable) |

### SuiviArrosage (Watering Event)
| Column | Type | Notes |
|---|---|---|
| `id_suivi_arrosage` | PK | |
| `id_suivi` | FK → SuiviSolVivant | |
| `id_recette_engrais` | FK → RecetteEngrais (nullable) | Recipe used |
| `volume_eau_l` | Float | Water volume applied |
| `date_application` | Date | |
| `notes` | Text (nullable) | |

### SuiviTCO (Tank Mix Application)
| Column | Type | Notes |
|---|---|---|
| `id_suivi_tco` | PK | |
| `id_suivi` | FK → SuiviSolVivant | |
| `id_recette_tco` | FK → RecetteTCO (nullable) | |
| `volume_applique` | Float | Volume applied (L) |
| `date_application` | Date | |
| `notes` | Text (nullable) | |

### SuiviFermentation (Fermentation Application)
| Column | Type | Notes |
|---|---|---|
| `id_suivi_ferm` | PK | |
| `id_suivi` | FK → SuiviSolVivant | |
| `id_recette_ferm` | FK → RecetteFermentation (nullable) | |
| `volume_applique` | Float | |
| `date_application` | Date | |
| `notes` | Text (nullable) | |

### SuiviCulture (Culture Usage)
| Column | Type | Notes |
|---|---|---|
| `id_suivi_culture` | PK | |
| `id_suivi` | FK → SuiviSolVivant | |
| `description` | String | Culture description |
| `date_debut` | Date (nullable) | |
| `date_fin` | Date (nullable) | |
| `notes` | Text (nullable) | |

---

## See Also

- [[api/living-soil]] — endpoints
- [[database/recipes]] — RecetteLSO, RecetteReamendement, RecetteTCO, RecetteFermentation, RecetteEngrais
- [[features/living-soil-system]] — full workflow explanation
