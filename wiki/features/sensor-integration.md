---
type: feature
updated: 2026-04-09
sources: [routers/capteurs.py, models/all_models.py, Documentation/PHASE1_SUMMARY.txt]
---

# Feature — Govee Sensor Integration

## Overview

GrowManager integrates with Govee smart sensors (model H5179) to automatically log temperature, humidity, and VPD readings per grow space.

## Setup Flow

1. **Configure API key:** `POST /api/govee/config` with `{api_key: "..."}`
   - API key obtained from Govee developer console
   - Stored server-side in `GoveeConfig`

2. **Register device:** `POST /api/capteurs` with `GoveeDeviceCreate`
   - `device_id`: Govee device identifier (from cloud API)
   - `modele`: device model (e.g. "H5179")
   - `ip_lan`: local IP address for LAN polling (optional)
   - `id_espace`: assign sensor to a growing space

3. **Start polling:** Background poller runs automatically at app startup (`start_poller(app)` in `main.py`)

4. **Manual sync:** `POST /api/govee/poll` to force immediate poll of all active devices

## Polling

The poller runs as a FastAPI background task. For each active `GoveeDevice`:
- Tries LAN polling first (if `ip_lan` is set) — faster, local
- Falls back to cloud API (requires internet + API key)
- Stores result in `TemperatureLog`

## Data Storage

Each reading creates a `TemperatureLog`:
```
{
  id_device: int,
  id_espace: int (nullable),
  id_culture: int (nullable),
  date_heure: datetime,
  temperature: float,   # °C
  humidite: float,      # % RH
  vpd: float,           # kPa (calculated)
  source: 'govee' | 'manual'
}
```

VPD formula: `SVP × (1 - RH/100)` where `SVP = 0.6108 × exp(17.27 × T / (T + 237.3))`

## Frontend (SuiviConstantes page)

Route: `/suivi-constantes`

- Charts for temperature, humidity, VPD over time
- Time window selector: 6h / 24h / 48h / 7j / 30j
- Per-device view or aggregate across spaces

Data fetched via `GET /api/temperature-logs` with optional `id_device` filter and time window.

## Composant SensorDayChart (2026-05-15)

Composant réutilisable `frontend/src/components/SensorDayChart.tsx` qui affiche les courbes d'une journée complète (00:00 → 23:59).

**Props :**
```ts
{ date: string, idEspace?: number }
// date = "YYYY-MM-DD" (date locale)
// idEspace = filtre optionnel par espace de culture
```

**Rendu :**
- Résumé min / moy / max en 3 tiles (Temp. / Hum. / VPD)
- 3 LineCharts Recharts empilés (hauteur 72px chacun), axe X = HH:MM, axe Y adaptatif avec domaine fixe (temp 10-40°C, hum 0-100%, vpd 0-3 kPa)
- État vide si aucune lecture : message discret

**Utilisation :**
- **CalendrierGlobal** : dans le modal "vue journée" (sans filtre espace → toutes les tentes)
- **CalendrierCulture** : dans le panneau jour sélectionné (filtré sur `idEspace` de la culture)

**API appelée :** `GET /api/temperature-logs?date_debut=YYYY-MM-DDT00:00:00&date_fin=YYYY-MM-DDT23:59:59[&id_espace=X]`
— retourne les données brutes (fenêtre ≤ 48h → pas d'agrégation horaire)

## Gmail Import (Alternative)

`POST /api/capteurs/govee/sync` — imports historical data from Gmail if Govee was sending email reports.

Used for bulk historical data import.

## Manual Entries

`POST /api/temperature-logs` with `source: 'manual'` — for logging readings manually when sensors are offline.

## See Also

- [[database/sensors]] — GoveeDevice, TemperatureLog models
- [[api/infrastructure]] — sensor CRUD + polling endpoints
- [[database/spaces]] — EspaceCulture (sensors assigned to spaces)
