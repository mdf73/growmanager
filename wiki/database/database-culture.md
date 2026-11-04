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
| `id_espace` | FK → EspaceCulture (nullable) | Space if not using Box — always mirrors the current (open-ended) `CultureEmplacement` row, see [[database/database-spaces]] |
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

**Catégorie Training & Taille** (`category: 'training'`, 2026-10-28) : `mise_en_place_filet`, `mise_en_place_sog`, `mise_en_place_scrog`, `tucking_scrog`, `palissage`, `hst`, `super_cropping`, `mainlining`, `etetage`, `fim`, `pincage`, `defoliation`, `lollipopping`, `schwazzing`, `tuteurage`. Toutes sauf `mise_en_place_filet` ont `parametres.intensite` ∈ `legere` / `normale` / `forte` / `intense` (`INTENSITE_OPTIONS` dans `actionTypes.ts` ; valeur historique `lourde` sur d'anciennes défoliations, affichée « Forte »). Paramètres supplémentaires : `nb_plantes_m2` (SOG), `hauteur_filet_cm` + `maille_cm` (SCROG), `nb_attaches` (palissage), `nb_tiges` (super cropping), `nb_tetes` (mainlining). `mise_en_place_filet` reste distinct de `mise_en_place_scrog` (filet posé sans palissage). Actions informationnelles, sans effet de bord côté backend.

**Action `detection_carence`** (catégorie `mesure`, 2026-11-04) : `parametres.carences` = tableau de chaînes (sélection multiple) issues de la liste paramétrable `carences` (`ParametreListeValeur`, section « Suivi de culture » de Paramétrage ; défaut : N, P, K, Ca, Mg, S, Fe, Mn, Zn, Cu, B, Mo) + `parametres.intensite` (`INTENSITE_OPTIONS`). Rendu par le type de champ générique `multi_liste` (`FieldDef.listeNom`, composant `MultiListeField` dans `ActionModal.tsx`) ; `formatActionParams` joint les tableaux par virgule. Action informationnelle, sans effet de bord.

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

- [[api/api-cultures]] — CRUD + plant + action endpoints
- [[features/culture-lifecycle]] — status flow
- [[features/plant-lifecycle]] — plant status flow
- [[database/database-graines]] — Graine model
- [[database/database-equipment]] — Box, Lampe, Pot etc.
