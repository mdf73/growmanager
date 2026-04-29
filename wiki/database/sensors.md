---
type: database
updated: 2026-04-09
sources: [models/all_models.py, routers/capteurs.py]
---

# Database — Sensors Domain

## GoveeDevice

A registered Govee smart sensor (model H5179 or similar).

| Column | Type | Notes |
|---|---|---|
| `id_device` | PK | |
| `nom` | String | Display name (e.g. "Tente 1") |
| `device_id` | String | Govee device ID (from cloud API) |
| `modele` | String (nullable) | Device model |
| `ip_lan` | String (nullable) | Local IP for LAN polling |
| `id_espace` | FK → EspaceCulture (nullable) | Which space this sensor monitors |
| `actif` | Boolean | Whether polling is active |
| `notes` | Text (nullable) | |

**Relationship:** → many `TemperatureLog`

---

## TemperatureLog

A single sensor reading (temperature + humidity + VPD).

| Column | Type | Notes |
|---|---|---|
| `id_log` | PK | |
| `id_device` | FK → GoveeDevice (nullable) | Source sensor |
| `id_culture` | FK → Culture (nullable) | Associated culture (if any) |
| `id_espace` | FK → EspaceCulture (nullable) | Associated space |
| `date_heure` | DateTime | Reading timestamp |
| `temperature` | Float | °C |
| `humidite` | Float | % RH |
| `vpd` | Float (nullable) | Calculated VPD (kPa) |
| `source` | String | `govee` \| `manual` |

`id_culture` was made nullable via startup migration (was NOT NULL originally).

---

## Polling Architecture

The Govee poller (`start_poller(app)` in `main.py`) runs as a FastAPI background task:
- Polls all active `GoveeDevice` records on a schedule
- Supports both cloud API and LAN UDP polling (`ip_lan`)
- Stores results in `TemperatureLog`
- Can be manually triggered via `POST /api/govee/poll`
- API key configured via `POST /api/govee/config` (stored in `GoveeConfig`)

---

## VPD Calculation

VPD (Vapor Pressure Deficit) is computed from temperature and humidity at read time:

```
VPD = SVP × (1 - RH/100)
SVP = 0.6108 × exp(17.27 × T / (T + 237.3))
```

Where T is temperature in °C and RH is relative humidity %.

---

## See Also

- [[api/infrastructure]] — capteur CRUD + Govee polling endpoints
- [[database/spaces]] — EspaceCulture (sensors assigned to spaces)
- [[features/sensor-integration]] — full sensor setup and workflow
