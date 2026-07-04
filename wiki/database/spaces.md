---
type: database
updated: 2026-04-09
sources: [models/all_models.py, routers/espaces.py]
---

# Database — Growing Spaces Domain

## EspaceCulture

A physical growing space (tent, room, cupboard).

| Column | Type | Notes |
|---|---|---|
| `id_espace` | PK | |
| `nom` | String | Space name (e.g. "Tente 120×120") |
| `type_espace` | String | Space type (indoor, outdoor, etc.) |
| `id_materiel_principal` | FK → Materiel (nullable) | Main equipment item (e.g. the tent itself) |
| `dimensions` | String (nullable) | e.g. "120×120×200" |
| `surface_m2` | Float (nullable) | Floor area — used in pot count formula |
| `hauteur_cm` | Float (nullable) | Height |
| `statut` | String | `Actif` \| `Inactif` \| `Maintenance` |
| `notes` | Text (nullable) | |

**Relationships:** → many `EspaceMateriel` (equipment list), → many `Culture`, → many `GoveeDevice`, → many `PlanCulture`, → many `HistoriqueCulture`

`surface_m2` feeds the pot count formula: → [[architecture/patterns]] (pot count formula)

---

## EspaceMateriel

Assignment of a piece of equipment (`Materiel`) to a space.

| Column | Type | Notes |
|---|---|---|
| `id_espace_materiel` | PK | |
| `id_espace` | FK → EspaceCulture | |
| `id_materiel` | FK → Materiel | |
| `date_assignation` | Date (nullable) | When it was put in the space |
| `notes` | Text (nullable) | |

This is the mechanism for tracking which lamps, fans, irrigation systems are currently in which space.

---

## Import / Export

`EspaceCulture` supports CSV export/import via:
- `GET /api/espaces/export/csv` → download CSV
- `POST /api/espaces/import` → upload CSV file

Used in `ImportExportModal` component on the Espaces page.

---

## See Also

- [[api/infrastructure]] — espaces endpoints
- [[database/sensors]] — GoveeDevice linked to spaces
- [[database/equipment]] — Materiel (what gets assigned to spaces)
- [[database/database-planning]] — PlanCulture references EspaceCulture
