---
type: database
updated: 2026-04-24
sources: [models/all_models.py, models/__init__.py]
---

# Database Schema Overview

All models defined in `backend/app/models/all_models.py`.

## Domain Groups

### Seeds & Genetics
| Table | Description |
|---|---|
| `Breeder` | Seed producer/brand |
| `Variete` | Cannabis variety |
| `PackGraine` | Purchased seed pack |
| `Graine` | Individual seed (has breeder, variete, pack) |
| `Pollen` | Pollen stock (mâle ou femelle reversée STS) — quantité, stockage, date péremption auto |
| `Croisement` | Crossing record (mère × père) — type F1/F2/BX/S1/IBL, récolte de graines |

→ [[database/database-graines]]

### Cultures & Plants
| Table | Description |
|---|---|
| `Culture` | A grow cycle (active → sechage_curing → terminee) |
| `Plant` | Individual plant in a culture |
| `ActionCalendrier` | Calendar event/action for a plant or culture |
| M2M: `CultureGraine`, `CultureEngrais`, `CultureLampe`, `CulturePot`, `CultureIrrigation`, `CultureVentilation` | Equipment/seed assignments per culture |

→ [[database/culture]]

### Stock & Extractions
| Table | Description |
|---|---|
| `Stock` | Finished product inventory (fleur, hash, rosin, trim…) |
| `Recolte` | Harvest record (links culture + graines) |
| `RosinExtraction` | Rosin press session |
| `HashExtraction` | Hash extraction (Polinator / Ice-o-lator) |

→ [[database/stock]]

### Recipes
| Table | Description |
|---|---|
| `RecetteTCO` / `RecetteTCOLigne` | Water+nutrient tank mix recipe |
| `RecetteLSO` / `RecetteLSOLigne` | Living soil mix recipe |
| `RecetteReamendement` / `RecetteReamendementLigne` | Top-dressing recipe |
| `RecetteArrosage` / `RecetteArrosageLigne` | Watering recipe |
| `RecetteFermentation` / `RecetteFermentationLigne` | Fermentation recipe |
| `RecetteEngrais` / `RecetteEngraisLigne` | Nutrient schedule recipe |

→ [[database/database-recipes]]

### Fertilizers & Products
| Table | Description |
|---|---|
| `ProduitEngrais` | Fertilizer/amendment product (stock item) |
| `AchatEngrais` | Purchase history for a product |

→ [[database/database-recipes]]

### Equipment
| Table | Description |
|---|---|
| `Box` | Growing tent |
| `Lampe` | Light fixture |
| `Pot` | Growing pot |
| `Irrigation` | Irrigation system |
| `Ventilation` | Fan/ventilation |
| `Bocal` | Storage jar |
| `Press` | Rosin press |
| `RosinBag` | Rosin filter bag |
| `IceOBag` | Ice-o-lator filter bag |
| `Materiel` | General equipment inventory (unified, categorized) |
| `Vaporisateur` | Vaporizer (type chauffe, temp min/max, avec eau, S/N) |
| `VapoConsommable` | Consumable/accessory for a vaporizer (bol, terps ball — matière, diamètre) |

→ [[database/equipment]]

### Sensors
| Table | Description |
|---|---|
| `GoveeDevice` | Registered Govee smart sensor |
| `TemperatureLog` | Temperature/humidity/VPD reading |

→ [[database/sensors]]

### Growing Spaces
| Table | Description |
|---|---|
| `EspaceCulture` | Physical grow space (tent, room) |
| `EspaceMateriel` | Equipment assigned to a space |

→ [[database/spaces]]

### Living Soil Tracking
| Table | Description |
|---|---|
| `SuiviSolVivant` | A living soil pot record |
| `SuiviReamendement` | Amendment application event |
| `SuiviArrosage` | Watering event |
| `SuiviTCO` | Tank mix application event |
| `SuiviFermentation` | Fermentation application event |
| `SuiviCulture` | Culture usage record for a pot |

→ [[database/database-living-soil]]

### Planning
| Table | Description |
|---|---|
| `PlanCulture` | Culture blueprint (brouillon → pret → lance) |
| `PlanCultureVariete` | Variety line in a culture plan |
| `PreparationSubstrat` | Substrate preparation log |
| `HistoriqueCulture` | Archived past grow cycle |
| `HistoriquePlant` | Archived plant in a past grow |

→ [[database/database-planning]]

### Séchage & Curing
| Table | Description |
|---|---|
| `SessionSechage` | Drying session (espace, méthode, temp/hum cibles, statut active/terminee) |
| `PlantSechage` | Plant enrolled in a drying session (poids humide → poids sec) |
| `SessionCuring` | Curing session (contenant, volume, Boveda %RH, espace/bocal liés) |
| `PlantCuring` | Plant enrolled in a curing session (poids début → poids final) |

### Variété Scoring
| Table | Description |
|---|---|
| `NotationVariete` | Variety score: Culture /30 (vigueur, productivité, soif) + Conso /70 (apparence, arôme, saveur, effet) = note finale /100 |

### Reference
| Table | Description |
|---|---|
| `Marque` | Product brand |
| `Fournisseur` | Supplier / seed shop |
| `ParametreListeValeur` | Configurable dropdown values |
