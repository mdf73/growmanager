---
type: feature
updated: 2026-06-03
sources: [routers/capteurs.py, routers/esphome.py, schemas/esphome.py, models/all_models.py, routers/app_settings.py]
---

# Feature — Sensor Integration (Govee + Tapo + ESPHome)

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
  source: 'govee' | 'tapo' | 'esphome' | 'manual'
}
```

VPD formula: `SVP × (1 - RH/100)` where `SVP = 0.6108 × exp(17.27 × T / (T + 237.3))`

## Frontend (SuiviConstantes page)

Route: `/suivi-constantes`

- Charts for temperature, humidity, VPD over time
- Time window selector: 6h / 24h / 48h / 72h / 7j / 30j (72h ajouté 2026-11-08 ; > 48h = moyennes horaires côté backend)
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
- 3 LineCharts Recharts empilés (hauteur 72px chacun), axe X = HH:MM, axe Y automatique (voir fix 2026-11-03 ci-dessous ; avant : domaine fixe temp 10-40°C, hum 0-100%, vpd 0-3 kPa)
- État vide si aucune lecture : message discret

**Utilisation :**
- **CalendrierGlobal** : dans le modal "vue journée" (sans filtre espace → toutes les tentes)
- **CalendrierCulture** : dans le panneau jour sélectionné (filtré sur `idEspace` de la culture)

**API appelée :** `GET /api/temperature-logs?date_debut=YYYY-MM-DDT00:00:00&date_fin=YYYY-MM-DDT23:59:59[&id_espace=X]`
— retourne les données brutes (fenêtre ≤ 48h → pas d'agrégation horaire)

**Fix (2026-09-16) — axe Y invisible ("Constantes du jour" dans Suivi de culture) :**
L'axe Y utilisait une marge gauche négative (`margin.left: -12`) combinée à une largeur d'axe trop étroite (`width={30}`). Les libellés de tick (ex. "23.5°C") débordaient dans la zone négative du SVG, qui rogne tout contenu hors de son viewport — seuls les caractères d'unité en fin de libellé restaient visibles ("°C", "%", "Pa" au lieu de "kPa"). Les données étaient correctes, seul l'affichage de l'axe était cassé. Corrigé en alignant sur les valeurs déjà utilisées dans `SuiviConstantes.tsx` : `margin.left: -12 → 0`, `width` de l'axe Y `30 → 38`.

**Fix (2026-11-03) — échelle Y automatique (courbes plates) :**
Avec le domaine fixe, une journée à 23-26 °C n'occupait que 10 % de la hauteur. `computeDomain()` calcule désormais le domaine de chaque graphique à partir des valeurs horaires affichées (tous capteurs confondus, pour garder une échelle commune) : min/max + marge 10 %, écart minimum `minSpan` (2 °C, 5 %, 0,2 kPa) centré sur la moyenne si les données varient moins, arrondi au pas `step` (1 °C, 5 %, 0,1 kPa), bornes `bounds` (humidité 0-100, VPD ≥ 0). Configuration dans `METRICS`. S'applique à la modale jour du calendrier global et au panneau jour du calendrier de culture (même composant). Les tiles min/moy/max ne changent pas.

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

4 accordéons dans cet ordre :
1. 🟣 **Paramètres capteurs** (violet, ouvert par défaut) — offset VPD foliaire
2. 🟢 **Capteurs Govee** — configuration API cloud + liste des capteurs + import Gmail
3. 🟣 **Capteurs Tapo** — configuration H100 local + découverte T310/T315
4. 🟠 **Capteurs ESPHome** — enregistrement + gestion des capteurs DIY

---

## Intégration Tapo locale (2026-09-01)

Les capteurs Tapo T310/T315 sont lus localement via un hub H100. Les sondes
étant reliées au H100 par radio, seule l’adresse IP du hub est configurée.

### Configuration

Depuis **Paramétrage > Capteurs > Capteurs Tapo** :

1. saisir l’IP du H100, l’identifiant TP-Link/Tapo et le mot de passe ;
2. sauvegarder puis tester la connexion ;
3. découvrir les enfants T310/T315 ;
4. sélectionner une sonde, lui donner un nom GrowManager et l’associer à un espace ;
5. activer le polling automatique.

Le mot de passe est chiffré côté backend et n’est jamais retourné au frontend.
L’application utilise `tapo==0.9.0` et ses appels locaux `ApiClient.h100()` /
`HubHandler.get_child_device_list()`. Aucun endpoint cloud Tapo n’est appelé.

### Endpoints

- `GET/PUT /api/tapo/config` — configuration H100 sans exposer le mot de passe
- `POST /api/tapo/test-connection` — test de connexion locale
- `GET /api/tapo/discover` — découverte des T310/T315 appairés au H100
- `GET/POST /api/tapo/devices` — liste et enregistrement des sondes
- `PUT/DELETE /api/tapo/devices/{id}` — gestion d’une sonde enregistrée
- `POST /api/tapo/poll` — lecture immédiate des sondes Tapo actives

Le polling automatique Tapo est lancé toutes les 5 minutes avec le scheduler
existant. Chaque lecture est enregistrée dans `TemperatureLog`, avec le VPD
calculé par la même fonction que Govee et ESPHome.

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

## Statut hors ligne (2026-11-06)

Un capteur est **hors ligne** si `derniere_lecture` date de plus de 15 min (ou n'existe pas). Source unique : `frontend/src/utils/sensorStatus.ts` (`isSensorOnline`, `offlineLabel`, `SENSOR_OFFLINE_THRESHOLD_MS`). Ne plus recoder le test `15 * 60 * 1000` dans les pages.

Affichage quand hors ligne (Suivi des constantes, Dashboard, Paramétrage) :
- valeurs remplacées par `--` (jamais 0 : 0 °C / 0 % sont des vraies valeurs et le VPD 0 tomberait dans une zone colorée)
- carte et tuiles grisées
- libellé « Hors ligne depuis X » : minutes sous 1 h, heures de 1 h à 48 h, jours de 48 h à 30 j, puis « Hors ligne » sans durée
- graphiques historiques inchangés

Limite : le libellé est recalculé au refetch de la liste des capteurs, pas en temps réel.

## Comparaison année précédente (N-1) — fix 2026-11-08

Le bouton « Afficher N-1 » de `SensorChart` (`SuiviConstantes.tsx`) charge la même fenêtre décalée d'un an (`date_debut`/`date_fin`). La série N-1 est fusionnée **par horodatage** : chaque point N-1 est décalé de l'écart entre maintenant et la fin de fenêtre N-1, puis associé au point courant le plus proche (recherche dichotomique), tolérance 15 min si fenêtre ≤ 48h (brut), 90 min sinon (horaire). Hors tolérance → `null`.

Ne jamais apparier par index : en données brutes, les relevés N-1 (import CSV Govee) et les relevés live n'ont pas le même pas, ce qui décalait/tronquait la courbe en 6h/24h/48h (seuls 7j/30j marchaient, car agrégés à l'heure des deux côtés).

## Résilience aux pannes de l'API Govee (2026-11-18)

**Contexte** : le 18/11/2026, les deux H5179 sont passés « hors ligne » juste après le déploiement de la v3.19.0, ce qui faisait croire à une régression. Logs du backend : `502 Bad Gateway` et `The read operation timed out` sur `/device/state`. Test depuis le serveur : Google OK en 0,4 s, Govee en IPv4 → `504` après 10 s (panne côté Govee). Le `000` en IPv6 est normal : Govee n'a pas d'adresse IPv6. L'app Govee continuait de marcher car elle lit les capteurs en Bluetooth, sans passer par le cloud. **Conclusion : panne Govee, pas de régression.**

Le message « Aucune donnée — vérifier device_id et SKU » s'affichait pour **toute** erreur cloud, ce qui orientait le diagnostic vers une mauvaise piste.

**Changements** (`services/govee_poller.py`, `routers/capteurs.py`) :
- `cloud_v2_read(api_key, device_id, sku, timeout, attempts)` → `(reading, cause)`. `_cloud_v2_get_device_status` reste comme enveloppe de compatibilité.
- **Nouvel essai** (2 essais, pause 1,5 s) uniquement sur erreur passagère : délai dépassé, erreur de connexion, HTTP 5xx. Pas de nouvel essai sur 401/403, 429, 400/404 ni sur une réponse Govee `code != 200`.
- **Délais** : 20 s par essai pour le polling de fond (toutes les 5 min), 12 s pour « Lire maintenant ». Le pire cas manuel (UDP 3 s + 2 × 12 s + pause) reste sous le `proxy_read_timeout` de 60 s de nginx.
- **« Lire maintenant »** lit les capteurs **en parallèle** (`ThreadPoolExecutor`), les écritures en base restent séquentielles.
- **Causes affichées** (`PollResult.erreur`) : « API Govee indisponible (5xx) », « pas de réponse en N s », « Clé API Govee refusée (401/403) », « Limite d'appels Govee atteinte (429) », « Capteur inconnu de Govee (400/404) : vérifier device_id et SKU », « Govee a refusé la lecture : <message> », « Govee injoignable (connexion Internet du serveur ?) », « pas de température / humidité (capteur hors ligne côté cloud ?) », « Aucun device_id renseigné », « Clé API Govee non configurée ».
- **Logs** : `V2 state <id> (<sku>) essai n/2 : <cause>` et, pour le polling de fond, `Device '<nom>': aucune donnée (<cause>)`.

**Diagnostic rapide** d'une prochaine coupure :
```
docker logs growmanager-backend --since 3h 2>&1 | grep -iE 'V2 state|govee' | tail -20
curl -4 -s -o /dev/null -w "%{http_code} en %{time_total}s\n" -m 30 https://openapi.api.govee.com/router/api/v1/user/devices
```
`401` rapide = serveur et réseau OK, Govee répond (la commande n'envoie pas de clé) · `5xx` ou délai = panne Govee · `000` partout, Google compris = connexion du serveur.

## See Also

- [[database/database-sensors]] — GoveeDevice, TemperatureLog models
- [[api/api-infrastructure]] — sensor CRUD + polling endpoints
- [[database/database-spaces]] — EspaceCulture (sensors assigned to spaces)
