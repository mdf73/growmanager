---
type: api
updated: 2026-04-09
sources: [routers/capteurs.py, routers/espaces.py, routers/materiel.py, routers/parametre.py, api/capteurs.ts, api/espaces.ts]
---

# API — Infrastructure

## Sensors (Govee)

Router: `capteurs.py` | Prefix: `/api`

### Device Management

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/capteurs` | — | `list[GoveeDeviceRead]` |
| GET | `/capteurs/{id}` | — | `GoveeDeviceRead` |
| POST | `/capteurs` | `GoveeDeviceCreate` | `GoveeDeviceRead` |
| PUT | `/capteurs/{id}` | `GoveeDeviceUpdate` | `GoveeDeviceRead` |
| DELETE | `/capteurs/{id}` | — | 204 |

### Temperature Logs

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/temperature-logs` | `id_device?`, `id_culture?`, `limit?`, `offset?` | `list[TemperatureLogRead]` |
| GET | `/temperature-logs/last` | — | Last reading per device |
| POST | `/temperature-logs` | `TemperatureLogCreate` | `TemperatureLogRead` |
| DELETE | `/temperature-logs/{id}` | — | 204 |

### Govee API Integration

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/govee/config` | — | `GoveeConfigRead` |
| POST | `/govee/config` | `{api_key}` | — |
| POST | `/govee/poll` | — | `PollResult` |
| POST | `/capteurs/govee/sync` | — | `GmailImportResult` |

## Growing Spaces

Router: `espaces.py` | Prefix: `/api/espaces`

**Note:** `/materiel-en-use` and `/export/csv` are static — declared before `/{id}`.

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/` | — | `list[EspaceCultureRead]` | |
| GET | `/materiel-en-use` | — | list of assigned materials | Equipment in use across all spaces |
| GET | `/{id}` | — | `EspaceCultureRead` | |
| POST | `/` | `EspaceCultureCreate` | `EspaceCultureRead` | |
| PUT | `/{id}` | `EspaceCultureUpdate` | `EspaceCultureRead` | |
| DELETE | `/{id}` | — | 204 | |
| GET | `/export/csv` | — | CSV file | |
| POST | `/import` | UploadFile (CSV) | `{imported: count}` | |

## Equipment (Materiel)

Router: `materiel.py` | Prefix: `/api/materiel`

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `` | — | `list[MaterielRead]` | |
| GET | `/{id}` | — | `MaterielRead` | |
| POST | `` | `MaterielCreate` | `MaterielRead` | |
| PATCH | `/{id}` | `MaterielUpdate` | `MaterielRead` | Partial update |
| DELETE | `/{id}` | — | 204 | |
| GET | `/export/csv` | — | CSV file | |

## Configurable Parameters

Router: `parametre.py` | Prefix: `/api/parametres`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/{liste_nom}` | — | `list[ParametreRead]` |
| POST | `/{liste_nom}` | `ParametreCreate` | `ParametreRead` |
| PATCH | `/{id}` | `ParametreUpdate` | `ParametreRead` |
| DELETE | `/{id}` | — | 204 |

`liste_nom` examples: `types_lampe`, `materiaux_pot`, `types_bocal`, `categories_materiel`, `types_extraction`, etc.

## Import/Export (Batch)

Router: `import_export.py` | Prefix: `/api/import-export`

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/import-export` | CSV + entity type | `{imported: count}` |
| GET | `/export` | query: entity type | CSV file |

## Frontend Clients

- `frontend/src/api/capteurs.ts`
- `frontend/src/api/espaces.ts`
- `frontend/src/api/materiel.ts`
- `frontend/src/api/parametres.ts`
- `frontend/src/api/importExport.ts`

## See Also

- [[database/sensors]] — GoveeDevice, TemperatureLog models
- [[database/spaces]] — EspaceCulture, EspaceMateriel models
- [[database/equipment]] — Materiel model
- [[features/sensor-integration]] — Govee setup workflow
