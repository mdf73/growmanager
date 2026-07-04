---
type: feature
updated: 2026-06-03
sources: [routers/capteurs.py, routers/esphome.py, schemas/esphome.py, models/all_models.py, routers/app_settings.py]
---

# Feature — Sensor Integration (Govee + ESPHome)

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

---

## ESPHome Integration (2026-06-03)

ESPHome capteurs DIY qui poussent leurs données vers GrowManager via HTTP POST.

### Architecture

- Capteurs stockés dans `GoveeDevice` avec `modele="esphome"` — aucune table supplémentaire
- Relevés dans `TemperatureLog` avec `source="esphome"` — compatibles avec tous les graphiques existants
- Govee et ESPHome sont **totalement indépendants** : routes séparées, polling Govee non impacté

### Nouveaux fichiers

- `backend/app/schemas/esphome.py` — schémas Pydantic (ESPHomePushPayload, ESPHomePushResult, ESPHomeDeviceCreate, ESPHomeDeviceUpdate)
- `backend/app/routers/esphome.py` — router FastAPI (push + CRUD devices)

### Endpoints ESPHome

| Method | Path | Description |
|---|---|---|
| POST | `/api/capteurs/esphome/push` | Réception d'un relevé depuis ESPHome |
| GET | `/api/capteurs/esphome/devices` | Liste les capteurs ESPHome |
| POST | `/api/capteurs/esphome/devices` | Enregistre un nouveau capteur |
| PUT | `/api/capteurs/esphome/devices/{id}` | Modifie un capteur (nom, espace, actif) |
| DELETE | `/api/capteurs/esphome/devices/{id}` | Supprime un capteur (logs conservés) |

### Flux de données

1. ESPHome envoie `POST /api/capteurs/esphome/push` avec `{device_id, temperature, humidite, co2?, timestamp?}`
2. Backend vérifie que le `device_id` existe et est actif
3. Calcule le VPD (`compute_vpd` partagé avec Govee)
4. Récupère la culture active de l'espace lié (si configuré)
5. Insère un `TemperatureLog` avec `source="esphome"`

### Configuration ESPHome (YAML)

```yaml
interval:
  - interval: 60s
    then:
      - if:
          condition:
            lambda: |-
              return !isnan(id(MON_CAPTEUR_temperature).state) &&
                     !isnan(id(MON_CAPTEUR_humidite).state);
          then:
            - http_request.post:
                url: "http://IP_GROWMANAGER:8000/api/capteurs/esphome/push"
                request_headers:
                  Content-Type: application/json
                json: |-
                  root["device_id"] = "MON_CAPTEUR";
                  root["temperature"] = id(MON_CAPTEUR_temperature).state;
                  root["humidite"] = id(MON_CAPTEUR_humidite).state;
```

`device_id` dans le YAML doit correspondre exactement à celui enregistré dans Paramétrage > Capteurs ESPHome.

### UI — Paramétrage (onglet Capteurs)

3 accordéons dans cet ordre :
1. 🟣 **Paramètres capteurs** (violet, ouvert par défaut) — offset VPD foliaire
2. 🟢 **Capteurs Govee** — configuration API cloud + liste des capteurs + import Gmail
3. 🟠 **Capteurs ESPHome** — enregistrement + gestion des capteurs DIY

---

## Offset température foliaire VPD (2026-06-03)

La température des feuilles est généralement 2–3°C inférieure à la température de l'air.
Le VPD est calculé avec `T°feuille = T°air − offset` au lieu de la T° brute.

### Configuration

`AppSettings('vpd_leaf_offset')` — défaut `2.0`°C, seedé au démarrage.
Modifiable depuis **Paramétrage > Capteurs > Paramètres capteurs**.

### Formule

```
leaf_temp = temp_c - leaf_offset
VPD = 0.6108 × exp(17.27 × leaf_temp / (leaf_temp + 237.3)) × (1 - RH/100)
```

Appliqué à chaque calcul : Govee auto-poll, Govee poll manuel, ESPHome push, entrée manuelle.

### Implémentation

- `govee_poller.py` : `compute_vpd(temp, hum, leaf_offset)` + `_get_leaf_offset(db)`
- `govee_poller.py` : `poll_all_devices()` lit l'offset depuis la DB à chaque cycle
- `capteurs.py` : manual poll + entrée manuelle utilisent aussi `_get_leaf_offset(db)`
- `esphome.py` : push endpoint utilise `_get_leaf_offset(db)`

---

## Édition dates culture (2026-06-03)

Bouton **"Dates"** dans le header de `CultureDetail` → `DatesModal`.

Champs éditables :
- Date de démarrage (`date_debut`)
- Passage 12/12 (`date_passage_12_12`)
- Début floraison visible (`date_debut_floraison`)
- Récolte estimée (`date_recolte_estimee`)
- Date de fin (`date_fin`) — affiché si culture non active

Appelle `PUT /cultures/{id}` (endpoint existant). Recalcule la date de récolte estimée si `date_passage_12_12` est modifiée.

---

## See Also

- [[database/database-sensors]] — GoveeDevice, TemperatureLog models
- [[api/api-infrastructure]] — sensor CRUD + polling endpoints
- [[database/database-spaces]] — EspaceCulture (sensors assigned to spaces)
