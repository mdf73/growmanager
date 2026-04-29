---
type: feature
updated: 2026-04-09
sources: [models/all_models.py, routers/cultures.py, Documentation/claude.md]
---

# Feature — Plant Lifecycle

## Status Flow

```
germination → veg → floraison → sechage → curing → prete
                                                  → recolte
                                                  → abandonne
```

All statuses are stored as strings in `Plant.statut`.

## Status Descriptions

| Status | Meaning | Key Date Field |
|---|---|---|
| `germination` | Seed has been placed to germinate | `date_germination` |
| `veg` | Vegetative growth phase | `date_debut_croissance` (on Culture) |
| `floraison` | Flowering phase | `date_debut_flo` |
| `sechage` | Harvested, drying | `date_recolte` |
| `curing` | Dried, now curing | `date_fin_sechage` |
| `prete` | Ready to consume/store | — |
| `recolte` | Harvested (terminal) | `date_recolte` + `poids_recolte_g` |
| `abandonne` | Plant abandoned/died | — |

## Key Events (ActionCalendrier)

Status transitions are tracked as `ActionCalendrier` entries:

| Action type | Triggers |
|---|---|
| `graine_germee` | germination → veg |
| `debut_croissance` | veg phase logged |
| `debut_floraison` | veg → floraison |
| `passage_12_12` | Light flip (12h/12h) — triggers floraison |
| `recolte` | floraison → sechage (sets `date_recolte`, `poids_recolte_g`) |
| `fin_sechage` | sechage → curing |

## Plant Creation

Plants are created via `POST /cultures/{id}/plants` with `PlantCreate`:

```typescript
{
  id_graine?: number,     // null for external plants
  nom_affichage: string,
  numero_plant: number,
  origine: 'graine' | 'bouture' | 'clone',
  substrat?: string,
  id_recette_sol?: number,  // living soil recipe
  volume_pot_l?: number,
}
```

External plants (bouture/clone) don't require a seed — used for secondary cultures or cutting experiments.

### Naming Convention

Le nom d'une plante est **`<nom_variété> #<id_graine>`** où `id_graine` est l'identifiant unique de la graine utilisée (PK de la table `Graine`), **pas** un compteur incrémental de la culture.

Implémenté dans `_build_plant_name()` (routers/cultures.py) :
```python
f"{graine.variete.nom_variete} #{graine.id_graine}"
```

> ⚠️ Bug corrigé le 2026-04-28 : le nom utilisait auparavant `plant_counter` (compteur de boucle de création), ce qui donnait des numéros relatifs à la culture plutôt qu'au numéro de graine réel.

## Plant Transfer

Plants can move between cultures via `POST /cultures/{id}/transfer` with `PlantTransferPayload`.

Used when a plant is moved to a dedicated drying/curing culture or to a different tent.

## Harvest Recording

When a plant is harvested (`type_action = 'recolte'`, `global_culture = false`):
- `Plant.statut` → `sechage`
- `Plant.date_recolte` set
- `Plant.poids_recolte_g` set (fresh weight)
- Action logged in `ActionCalendrier`

For whole-culture harvest (`global_culture = true`):
- All active plants in culture get harvested simultaneously
- **TODO:** Verify ActionModal handles `global_culture=true` correctly — see [[roadmap]]

## See Also

- [[database/culture]] — Plant + ActionCalendrier models
- [[features/culture-lifecycle]] — parent culture status flow
- [[api/cultures]] — plant CRUD endpoints
