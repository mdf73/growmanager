---
type: api
updated: 2026-06-03
sources: [routers/capteurs.py, routers/esphome.py, routers/espaces.py, routers/materiel.py, routers/parametre.py]
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

## Sensors (ESPHome)

Router: `esphome.py` | No prefix

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/capteurs/esphome/push` | `ESPHomePushPayload` | `ESPHomePushResult` |
| GET | `/api/capteurs/esphome/devices` | — | `list[dict]` (enrichi) |
| POST | `/api/capteurs/esphome/devices` | `ESPHomeDeviceCreate` | device enrichi |
| PUT | `/api/capteurs/esphome/devices/{id}` | `ESPHomeDeviceUpdate` | device enrichi |
| DELETE | `/api/capteurs/esphome/devices/{id}` | — | 204 |

Les capteurs ESPHome sont stockés dans `GoveeDevice` avec `modele="esphome"`.
Les relevés sont dans `TemperatureLog` avec `source="esphome"` — compatibles avec tous les graphiques existants.

---

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
| GET | `/{id}/bocal-timeline` | — | `BocalTimelineResponse` | Feature F — traçabilité bocal → graine (depuis SechageCuring) |

### BocalTimelineResponse (Feature F)

Retourne la chaîne de traçabilité complète d'un bocal d'inventaire (Materiel catégorie Bocaux) :

```
BocalTimelineResponse {
  bocal: MaterielRead
  sessions_curing: SessionCuringTimeline[]   // sessions de curing liées (id_materiel_bocal)
    → date_debut, date_fin, statut
    → plants: PlantTimeline[]
        → graine: { types_graines, variete, breeder }
        → culture: { nom, date_debut, date_passage_12_12, date_debut_floraison }
        → sechage: { nom, date_debut, date_fin }
            // date_fin = ss.date_fin ?? sc.date_debut (début curing = fin séchage)
        → curing: { date_debut, date_fin }  // repris de la SessionCuringTimeline parente
            // durée affichée en j ; si en cours → date du jour comme borne de fin
        → poids_recolte_g, poids_debut_curing_g, poids_final_curing_g
  stocks: StockTimeline[]                    // entrées Stock liées (id_materiel_bocal)
    → variete, type_stock, quantite_stock, date_stock
}
```

**Règles d'affichage dans `BocalTimelineDrawer.tsx` :**
- Séchage `date_fin` : valeur DB si renseignée, sinon `session_curing.date_debut` (fallback backend).
- Curing durée : `(date_fin ?? today) - date_debut` en jours — affiché entre parenthèses même si session encore active.

Frontend : composant `BocalTimelineDrawer.tsx` — bouton "🔍 Origine" sur les plantes en curing dans `SechageCuring.tsx`.

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

Router: `import_export.py` | Prefix: `/api`

### CSV Import/Export

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/export/breeders` | — | CSV |
| POST | `/import/breeders` | CSV file | `{created, skipped}` |
| GET | `/export/varietes` | — | CSV |
| POST | `/import/varietes` | CSV file | `{created, skipped}` |
| GET | `/export/packs` | — | CSV |
| POST | `/import/packs` | CSV file | `{created, skipped, errors}` |
| GET | `/export/stock` | — | CSV |
| POST | `/import/stock` | CSV file | `{created, skipped, errors}` |
| GET | `/export/extractions` | — | CSV |
| POST | `/import/extractions` | CSV file | `{created, skipped, errors}` |
| GET | `/export/extractions-hash` | — | CSV |
| POST | `/import/extractions-hash` | CSV file | `{created, skipped, errors}` |
| GET | `/export/historique-cultures` | — | CSV |
| POST | `/import/historique-cultures` | CSV file | `{created, skipped, errors}` |
| GET | `/export/materiel` | — | CSV |
| POST | `/import/materiel` | CSV file | `{created, skipped, errors}` |
| GET | `/export/engrais` | — | CSV |
| POST | `/import/engrais` | CSV file | `{created, skipped, errors}` |

### Backup / Restauration SQL

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/backup/dump` | — | Fichier `.sql` (mysqldump) |
| POST | `/backup/restore` | Fichier `.sql` | `{ok, message}` |

**Notes importantes :**
- `mysqldump` et `mysql` utilisent tous les deux `--skip-ssl` — indispensable si le serveur MySQL utilise un certificat TLS auto-signé (erreur `ERROR 2026 HY000: self-signed certificate in certificate chain` sans ce flag).
- Les credentials sont lus depuis les variables d'environnement : `DB_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`.

## Frontend Clients

- `frontend/src/api/capteurs.ts`
- `frontend/src/api/espaces.ts`
- `frontend/src/api/materiel.ts`
- `frontend/src/api/parametres.ts`
- `frontend/src/api/importExport.ts`

## See Also

- [[database/database-sensors]] — GoveeDevice, TemperatureLog models
- [[database/database-spaces]] — EspaceCulture, EspaceMateriel models
- [[database/database-equipment]] — Materiel model
- [[features/sensor-integration]] — Govee setup workflow
