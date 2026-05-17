---
type: api
updated: 2026-05-17
sources: [routers/cultures.py, api/cultures.ts]
---

# API — Cultures

Router: `backend/app/routers/cultures.py` | Prefix: `/api/cultures`

## Culture CRUD

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/` | — | `list[CultureWithDetails]` | All cultures |
| GET | `/actives` | — | `list[CultureWithDetails]` | Active only |
| GET | `/{id}` | — | `CultureWithDetails` | Single culture |
| POST | `/` | `CultureCreate` | `CultureRead` | Create culture |
| PUT | `/{id}` | `CultureUpdate` | `CultureRead` | Update culture |
| DELETE | `/{id}` | — | `{message}` | Delete culture |
| GET | `/{id}/recap` | — | detailed summary | Full culture recap |
| POST | `/{id}/close` | — | — | Archive culture → HistoriqueCulture |
| POST | `/{id}/transfer` | `PlantTransferPayload` | — | Move plant to another culture |

**Note:** `/actives` is a static route — must be declared before `/{id}` in router file. → [[architecture/patterns]]

`CultureWithDetails` includes enriched data: plant list, associated equipment names, action counts.

## Plants

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/{id}/plants` | — | `list[enriched plant data]` |
| POST | `/{id}/plants` | `PlantCreate` | `PlantRead` |
| PUT | `/{id}/plants/{plant_id}` | `PlantUpdate` | `PlantRead` |
| DELETE | `/{id}/plants/{plant_id}` | — | `{message}` |

Plant data is enriched: includes `variete_nom`, `breeder_nom` from related records. → [[architecture/patterns]] (enrichment pattern)

## Actions (Calendar)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/{id}/actions` | — | `list[ActionRead]` |
| POST | `/{id}/actions` | `ActionCreate` | `ActionRead` |
| PUT | `/{id}/actions/{action_id}` | `ActionCreate` | `ActionRead` |
| DELETE | `/{id}/actions/{action_id}` | — | `{message}` |

`ActionCreate` fields: `id_plant` (nullable), `date_action`, `type_action`, `parametres` (JSON), `note`, `global_culture` (bool).

## Export PDF Fiche Culture

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/{id}/export/pdf` | PDF binaire (A4) | Téléchargement direct |

Le PDF généré contient :
1. Informations générales (nom, espace, statut, dates, durées)
2. Tableau des plantes (variété, statut, substrat, pot, poids)
3. Résumé des actions (comptages par type)
4. Coûts (électricité, engrais, graines, total, coût/g, rendement)
5. Notes de la culture
6. **Journal Photos** — photos groupées par jour (date_prise), affichées en grille 3 colonnes avec leur note

## Photos

Géré par le router `photos.py` (`/api/photos`).

| Method | Path | Params | Notes |
|---|---|---|---|
| GET | `/photos/` | `id_culture`, `id_plant` | Liste triée par date_prise desc |
| POST | `/photos/upload` | `file`, `id_culture`, `id_plant`, `notes`, **`date_prise`** | Upload + compression + thumbnail |
| DELETE | `/photos/{id}` | — | Supprime fichier + thumbnail + DB |

**`date_prise`** : paramètre Form optionnel (format `YYYY-MM-DD` ou `YYYY-MM-DDTHH:MM:SS`). Si absent, utilise `datetime.utcnow()`. Permet d'associer une photo à une date passée.

Côté frontend (`PhotoGallery.tsx`) : date picker initialisé à aujourd'hui, modifiable avant l'upload. La date choisie s'applique à toutes les photos uploadées en même temps. Les miniatures affichent la date en bas à gauche.

## Frontend Client

`frontend/src/api/cultures.ts` — all culture operations.

## See Also

- [[database/culture]] — Culture, Plant, ActionCalendrier models
- [[features/culture-lifecycle]] — status transitions
- [[features/plant-lifecycle]] — plant status flow
