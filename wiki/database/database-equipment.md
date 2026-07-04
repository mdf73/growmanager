---
type: database
updated: 2026-04-09
sources: [models/all_models.py, routers/materiel.py]
---

# Database — Equipment Domain

Two parallel equipment systems exist:
1. **Old system:** Dedicated tables per equipment type (Box, Lampe, Pot, etc.) — used in Culture M2M relationships
2. **New system:** `Materiel` — unified inventory table with `categorie` + JSON `caracteristiques`

Both are active. The old system tracks what's *used in a culture*; the new system tracks the physical inventory.

---

## Old Equipment Tables (Culture-linked)

All share a common pattern: id (PK), id_fournisseur (FK), id_marque (FK), date_achat, prix, etat, nbr_culture (times used).

### Box (Growing Tent)
| Column | Notes |
|---|---|
| largeur_tente, profondeur_tente, hauteur_tente | Dimensions (cm) |
| nbr_etage | Number of tiers |

### Lampe (Light Fixture)
| Column | Notes |
|---|---|
| largeur_lampe, profondeur_lampe, hauteur_lampe | Dimensions (cm) |
| puissance_lampe | Watts |

### Pot
| Column | Notes |
|---|---|
| taille_pot | Volume label (1L, 5.5L, etc.) |
| dimension_pot | Physical dimensions |

### Irrigation
| Column | Notes |
|---|---|
| type_irrigation | Type (goutte à goutte, etc.) |
| debit_irrigation | Flow rate (L/h) |
| diametre_irrigation | Pipe diameter |

### Ventilation (Fan)
| Column | Notes |
|---|---|
| type_ventilation | Type (extracteur, brasseur, etc.) |
| debit_ventilation | Airflow (m³/h) |
| diametre_ventilation | Duct diameter |
| longueur_ventilation | Duct length |

### Bocal (Storage Jar) — also used in Stock
| Column | Notes |
|---|---|
| taille_bocal | Volume (1L, 0.5L, etc.) |

### Press (Rosin Press)
| Column | Notes |
|---|---|
| largeur_plate, profondeur_plate | Plate dimensions (cm) |
| pression_press | Max pressure (ton) |

### RosinBag (Filter Bag)
| Column | Notes |
|---|---|
| dimensions_rosinbag | Bag size |
| maillage | Mesh size (µm) |
| nombre_rosinbag | Quantity owned |

### IceOBag (Ice-o-lator Bag)
| Column | Notes |
|---|---|
| maillage_iceobag | Mesh size (µm) |

---

## Materiel (Unified Inventory — New System)

General equipment inventory, replaces the old per-type tables for tracking physical items.

| Column | Type | Notes |
|---|---|---|
| `id_materiel` | PK | |
| `categorie` | String | `Pots` \| `Bocaux` \| `Lampes` \| `Ventilateurs` \| `Irrigations` \| `Outils` \| etc. |
| `nom` | String | Item name |
| `marque` | String (nullable) | |
| `code_barre_serial` | String (nullable) | Serial/barcode |
| `date_achat` | Date (nullable) | |
| `prix_achat` | Float (nullable) | |
| `site_achat` | String (nullable) | |
| `etat` | String | `Neuf` \| `Bon état` \| `Usagé` \| `Hors service` |
| `date_sortie_stock` | Date (nullable) | Soft delete — retired date |
| `notes` | Text (nullable) | |
| `caracteristiques` | JSON (nullable) | Category-specific specs |

**Relationships:** ← `EspaceMateriel` (assigned to spaces), ← `SuiviSolVivant` (pot records), ← `Stock.id_materiel_bocal`

`caracteristiques` JSON structure varies by category (e.g., lampes have wattage; bocaux have volume).

---

## Marque (Brand)

Reference table. Linked to almost all old equipment tables.

| Column | Type |
|---|---|
| `id_marque` | PK |
| `nom_marque` | String |
| `siteweb_marque` | String (nullable) |
| `contact_marque` | String (nullable) |

---

## ParametreListeValeur (Configurable Dropdowns)

Stores all dropdown/select values used in the UI.

| Column | Type | Notes |
|---|---|---|
| `id_parametre` | PK | |
| `liste_nom` | String | Name of the list (e.g. "types_lampe") |
| `valeur` | String | The option value |
| `ordre` | Int | Display order |

Managed via `Parametrage` page and `/api/parametres/{liste_nom}` endpoints.

**Listes maillages disponibles :**
- `maillages_polinator` — Maillages Polinator (µ). Fallback : `['120µ']`
- `maillages_iceolator` — Maillages Ice-O-Lator (µ). Fallback : `['15µ', '25µ', '45µ', '73µ', '90µ', '160µ', '190µ', '220µ']`
- `maillages_rosin` — Maillages Rosin bags (µ)

---

## See Also

- [[api/api-infrastructure]] — materiel + parametres endpoints
- [[database/database-spaces]] — EspaceMateriel (equipment assigned to spaces)
- [[database/database-stock]] — Bocal, Press, RosinBag used in extraction records
