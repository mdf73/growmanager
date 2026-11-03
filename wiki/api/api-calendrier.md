---
type: api
updated: 2026-05-15
sources: [routers/calendrier.py, api/calendrier.ts]
---

# API — Calendrier Global

Router: `calendrier.py` | Prefix: `/api/calendrier`

## Endpoints

| Method | Path | Params | Returns |
|---|---|---|---|
| GET | `/calendrier/` | `year`, `month` | `list[CalendrierEvent]` — tous les events du mois |
| GET | `/calendrier/cultures-actives` | — | `list[CultureRef]` — toutes les cultures (pour filtres/légende) |
| GET | `/calendrier/export` | `date_debut`, `date_fin` | `list[CalendrierEvent]` — tous les events dans la plage |
| GET | `/calendrier/horaires-lampe` | `date_fin` | `list[HoraireLampe]` `{id_culture, id_espace, date_action, heure_debut, heure_fin}` — historique des actions `horaires_lampe` jusqu'à date_fin, une par (culture, jour). Sert au bloc capteurs jour/nuit (2026-11-03) |

## Types

### CalendrierEvent
```
id_action       int
date_action     str (ISO)
type_action     str
global_culture  bool
parametres      dict | null
note            str | null
id_culture      int
culture_nom     str
culture_statut  str | null
id_plant        int | null
plant_nom       str | null
```

### CultureRef
```
id_culture  int
nom         str
statut      str | null
date_debut  str | null
date_fin    str | null
```

## Export PDF

`GET /api/calendrier/export?date_debut=YYYY-MM-DD&date_fin=YYYY-MM-DD`

Retourne tous les `ActionCalendrier` entre les deux dates (inclus), triés chronologiquement. Utilisé par le modal `ExportPDFModal` du frontend pour générer un PDF jour par jour via `window.print()`. Aucune limite sur la plage de dates.
