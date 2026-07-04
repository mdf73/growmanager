---
type: database
updated: 2026-04-09
sources: [models/all_models.py, routers/cultures.py]
---

# Database — Culture Domain

## Culture

Core entity representing a grow cycle.

| Column | Type | Notes |
|---|---|---|
| `id_culture` | PK | |
| `id_box` | FK → Box | Growing tent used |
| `id_espace` | FK → EspaceCulture (nullable) | Space if not using Box |
| `nom` | String | Culture name |
| `date_debut` | Date | Start date |
| `statut` | String | `active` \| `sechage_curing` \| `terminee` |
| `date_fin` | Date (nullable) | End date |
| `date_recolte_estimee` | Date (nullable) | Estimated harvest |
| `type_culture` | String | Indoor/outdoor/etc. |
| `type_eclairage` | String | Light type |
| `but_culture` | String | Goals (comma-separated: Récolte, Hunt, Reproduction) |
| `date_germination` | Date (nullable) | |
| `date_debut_croissance` | Date (nullable) | Veg start |
| `date_passage_12_12` | Date (nullable) | Light flip |
| `date_debut_floraison` | Date (nullable) | Flower start |
| `duree_croissance` | Int (nullable) | Days |
| `duree_stretch` | Int (nullable) | Days |
| `phase` | String | Current phase |
| `notes` | Text (nullable) | |

**Relationships (M2M):** `graines`, `engrais`, `lampes`, `pots`, `irrigations`, `ventilations`
**Relationships (1-many):** `plants`, `actions`

Status flow: → [[features/culture-lifecycle]]

---

## Plant

Individual plant within a culture.

| Column | Type | Notes |
|---|---|---|
| `id_plant` | PK | |
| `id_culture` | FK → Culture | |
| `id_graine` | FK → Graine (nullable) | Null for external plants |
| `nom_affichage` | String | Display name |
| `numero_plant` | Int | Position number |
| `origine` | Enum | `graine` \| `bouture` \| `clone` |
| `statut` | String | See lifecycle below |
| `date_germination` | Date (nullable) | |
| `date_debut_flo` | Date (nullable) | |
| `date_recolte` | Date (nullable) | |
| `date_fin_sechage` | Date (nullable) | |
| `poids_recolte_g` | Float (nullable) | Harvest weight in grams |
| `substrat` | String (nullable) | Substrate type |
| `id_recette_sol` | FK → RecetteLSO (nullable) | Living soil recipe used |
| `id_pot` | Int (nullable) | Pot size reference |
| `volume_pot_l` | Float (nullable) | Pot volume in liters |
| `notes` | Text (nullable) | |
| `id_plant_mere` | FK → Plant (nullable) | Plante source si clone |
| `date_prelevement` | Date (nullable) | Date de prise de bouture |
| `date_enracinement` | Date (nullable) | Date d'enracinement constatée |
| `statut_clone` | String (nullable) | `en_attente` \| `enracine` \| `rate` |

Status flow: `germination → veg → floraison → sechage → curing → prete | recolte | abandonne`

Full lifecycle: → [[features/plant-lifecycle]]

---

## ActionCalendrier

Calendar event/action tied to a plant or a whole culture.

| Column | Type | Notes |
|---|---|---|
| `id_action` | PK | |
| `id_plant` | FK → Plant (nullable) | Null if global_culture |
| `id_culture` | FK → Culture | |
| `date_action` | DateTime | |
| `type_action` | VARCHAR | Free text — see [[architecture/patterns]] ADR-003 |
| `parametres` | JSON (nullable) | Action-specific parameters |
| `note` | Text (nullable) | |
| `global_culture` | Boolean | True = applies to whole culture, not one plant |
| `created_at` | DateTime | |

Known `type_action` values: `graine_germee`, `debut_croissance`, `debut_floraison`, `passage_12_12`, `arrosage_eau`, `arrosage_engrais`, `taille`, `defoliation`, `recolte`, `observations`, `traitement`, `photo`

**Action `photo`** : catégorie dédiée (rose) dans `actionTypes.ts`. Quand sélectionnée dans `ActionModal`, affiche une drop zone — les fichiers sont uploadés via `POST /api/photos/upload` avec `date_prise = date_action`. Un enregistrement `ActionCalendrier` de type `photo` est aussi créé avec `parametres.nb_photos`. La note de l'action sert de légende à toutes les photos uploadées. La cible (`target`) de l'action détermine `id_plant` : si `global` → photo de culture (id_plant=null) ; si plante spécifique → photo associée à la culture ET à la plante.

Voir aussi → [[features/photos]]

---

## M2M Association Tables

| Table | Columns | Purpose |
|---|---|---|
| `CultureGraine` | id_culture, id_graine | Seeds used in culture |
| `CultureEngrais` | id_culture, id_engrais | Fertilizers used |
| `CultureLampe` | id_culture, id_lampe | Lights used |
| `CulturePot` | id_culture, id_pot | Pots used |
| `CultureIrrigation` | id_culture, id_irrigation | Irrigation used |
| `CultureVentilation` | id_culture, id_ventilation | Fans used |

## See Also

- [[api/cultures]] — CRUD + plant + action endpoints
- [[features/culture-lifecycle]] — status flow
- [[features/plant-lifecycle]] — plant status flow
- [[database/database-graines]] — Graine model
- [[database/equipment]] — Box, Lampe, Pot etc.
