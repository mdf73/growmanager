---
type: api
updated: 2026-05-15
sources: [routers/stock.py, routers/extractions.py, api/stock.ts]
---

# API — Stock & Extractions

## Stock

Router: `stock.py` | Prefix: `/api/stock`

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/` | — | `list[StockWithVariete]` | All stock entries |
| GET | `/{id}` | — | `StockWithVariete` | Single entry |
| GET | `/bocaux-disponibles` | query: `current_stock_id?` | `list[BocalDisponible]` | Available jars (not in use) |
| GET | `/{id}/origine` | — | `StockOrigineResponse` | Feature F — traçabilité complète : variété, bocal, cultures source, plantes |
| GET | `/{id}/label` | — | `application/pdf` | Feature I — PDF étiquette 100×60 mm : QR code + variété + type + quantité + date + bocal |
| POST | `/` | `StockCreate` | `StockRead` | Add stock entry |
| PUT | `/{id}` | `StockCreate` | `StockRead` | Update stock |
| POST | `/{id}/sortie` | — | `StockWithVariete` | Mark as consumed (sets `date_fin_stock`) |
| DELETE | `/{id}` | — | 204 | Hard delete |

**Note:** `/bocaux-disponibles` is a static route — must be declared before `/{id}`. → [[architecture/patterns]]

### id_plant sur Stock

Chaque entrée de stock peut être liée à une plante précise via `id_plant` (FK nullable → `Plant`). Quand renseigné :
- La page Stock affiche `plant_nom` (ex: "OG Kush #3") à la place de `variete_nom`
- Le drawer `StockOriginDrawer` utilise le chemin direct `id_plant → Plant → Graine → Culture`
- Le formulaire `NouveauStockModal` propose un select "Plante (optionnel)" après la sélection de variété, chargé via `GET /api/cultures/plants-by-variete/{id_variete}`

Migration : `ALTER TABLE Stock ADD COLUMN id_plant INT NULL REFERENCES Plant(id_plant)`

### StockOrigineResponse (Feature F)

Retourne la chaîne de traçabilité d'un stock. Deux chemins selon la donnée disponible :
- **Chemin précis** (`id_plant` renseigné) : 1 plante directe → 1 culture
- **Chemin large** (`id_variete` uniquement) : toutes les plantes de la variété via `Graine.id_variete` → groupées par culture

```
StockOrigineResponse {
  stock: StockWithVariete
  variete: { nom_variete, croisement_variete, informations_variete, lien_web } | None
  bocal: { nom, volume_ml } | None
  cultures_source: CultureSource[]   // cultures ayant cultivé cette variété
    → plants: PlantOrigine[]
        → graine: { types_graines, breeder }
        → sechage: date_debut / date_fin
        → curing: date_debut + poids début/fin
        → poids_recolte_g, date_recolte
}
```

Frontend : `StockOriginDrawer.tsx` — clic sur une ligne de la page Stock.tsx ouvre le drawer.

`StockWithVariete` includes enriched variete name.

`POST /{id}/sortie` is the soft-delete — sets `date_fin_stock` to today. Used when a jar is finished.

## Rosin Extractions

Router: `extractions.py` | Prefix: `/api/rosin`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/rosin` | — | `list[RosinExtractionRead]` |
| GET | `/rosin/stats` | — | `ExtractionStats` |
| POST | `/rosin` | `RosinExtractionCreate` | `RosinExtractionRead` |
| DELETE | `/rosin/{id}` | — | 204 |

`ExtractionStats`: count, total input (g), total output (g), avg yield %.

### Multi-sources Rosin (2026-05-15)

Le formulaire et l'API supportent désormais **plusieurs produits en entrée** pour une extraction Rosin.

**Schéma `RosinExtractionCreate`** — champ ajouté :
```json
{
  "sources": [
    { "id_stock": 12, "quantite": 15.0 },
    { "id_stock": 17, "quantite": 10.0 }
  ],
  "quantite_utilisee": 25.0,
  ...
}
```

**Comportement backend (`routers/extractions.py`)** :
- Si `sources` est fourni : déduit `quantite` de chaque stock concerné, ferme automatiquement les stocks épuisés (`date_fin_stock = today`), pose `id_stock_source = sources[0].id_stock` (rétrocompat)
- Si `sources` est absent mais `id_stock_source` présent : fallback mono-source (rétrocompat)
- Validation : tous les stocks doivent exister et avoir `quantite_utilisee > 0`

**DB** : colonne `sources JSON NULL` ajoutée à `RosinExtraction` (migration `backend/migrate_sources.sql`)

**Frontend** : `NouvelleExtractionModal.tsx` — UX en deux sections distinctes :

1. **Produits en entrée** : sélection des stocks (pas de quantité saisie ici). Dispo affiché en info.
2. **Répartition par sac** :
   - *1 produit* : chaque sac = poids uniquement. Le total des sacs est déduit du stock.
   - *N produits* : chaque sac a un sélecteur "quel produit" + poids. Les déductions sont calculées par produit en agrégeant les sacs. Warning en temps réel si dépassement du dispo.

`quantite_utilisee` = somme des poids de sacs (pas de champ quantité séparé). `sources` payload dérivé depuis les sacs.

## Hash Extractions

Router: `extractions.py` | Prefix: `/api/hash`

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/hash` | — | `list[HashExtractionRead]` |
| GET | `/hash/stats` | — | `{nombre_extractions, total_entree_g, total_hash_g, ratio_moyen}` |
| POST | `/hash` | `HashExtractionCreate` | `HashExtractionRead` |
| DELETE | `/hash/{id}` | — | 204 |

### Multi-sources Hash (2026-05-15)

Même logique que Rosin. Le formulaire `NouvelleHashModal.tsx` expose une section "Produits en entrée" partagée entre les deux types d'extraction (Polinator et Ice-o-lator).

**Schéma `HashExtractionCreate`** — champ ajouté :
```json
{
  "sources": [
    { "id_stock": 5, "quantite": 20.0 }
  ],
  "quantite_utilisee": 20.0,
  ...
}
```

**DB** : colonne `sources JSON NULL` ajoutée à `HashExtraction` (migration `backend/migrate_sources.sql`)

## Dashboard

| Method | Path | Returns |
|---|---|---|
| GET | `/dashboard/stats` | `DashboardFullStats` |
| GET | `/dashboard/arrosage-boxes` | `list[BoxArrosageStats]` |

`DashboardFullStats` modules: cultures actives, en séchage, en curing, stock (fleur, hash, rosin), production stats, seeds inventory.

`BoxArrosageStats` (2026-04-27): pour chaque culture active → `id_culture`, `culture_nom`, `box_label` (dimensions), `derniere_arrosage` (date ISO), `jours_depuis_arrosage` (int). Trié par urgence (sans arrosage en premier, puis plus de jours en premier). Source : `ActionCalendrier` filtré sur `type_action IN ('arrosage_eau', 'arrosage_engrais')`.

Legacy: `GET /dashboard` → `DashboardStats` (older format, kept for compatibility).

## Frontend Clients

- `frontend/src/api/stock.ts`
- `frontend/src/api/dashboard.ts`

## See Also

- [[database/stock]] — Stock, RosinExtraction, HashExtraction models
