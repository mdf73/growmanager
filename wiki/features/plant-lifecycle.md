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

## Clonage — suivi bouture

Un clone suit un mini-cycle avant de rejoindre le cycle normal :

```
Prélèvement → (en attente d'enracinement) → Enraciné ✅ → cycle normal
                                           → Raté ❌ → abandonne
```

### Champs DB (Plant)

| Champ | Type | Notes |
|---|---|---|
| `id_plant_mere` | FK → Plant (nullable) | Plante source du clone |
| `date_prelevement` | Date (nullable) | Date de prise de bouture |
| `date_enracinement` | Date (nullable) | Date d'enracinement constatée |
| `statut_clone` | String (nullable) | `en_attente` \| `enracine` \| `rate` |

### Endpoints API

| Endpoint | Action |
|---|---|
| `POST /cultures/{id}/plants/{id}/clone` | Crée un clone dans une culture cible |
| `PATCH /cultures/{id}/plants/{id}/enraciner` | Marque enraciné + date |
| `PATCH /cultures/{id}/plants/{id}/clone-rate` | Marque raté → statut `abandonne` |

### Frontend

- **`ClonageModal.tsx`** — déclenché via bouton ✂️ sur chaque `PlantCard`. Permet de choisir la culture cible, nommer le clone, saisir la date de prélèvement. Propose de saisir l'enracinement immédiatement après création.
- **`PlantCard`** — badge violet "Bouture de X" si clone ; badge statut enracinement (⏳/🌱/❌) ; badge "N clone(s)" sur la plante mère ; bouton ✅ inline pour marquer enraciné ou raté depuis la plante clone.

### Naming Convention

Le nom d'une plante est **`<nom_variété> #<rang_dans_paquet>`** où le rang est la position 1-based de la graine dans son paquet (`id_packgraine`), triée par `id_graine`.

Exemple : si le paquet contient 12 graines et que la graine utilisée est la 5ème → `Bleu Roi (True F1) #5`.

Implémenté dans `_build_plant_name(graine, numero, db)` (routers/cultures.py) :
```python
ids_in_pack = [r[0] for r in db.query(Graine.id_graine)
    .filter(Graine.id_packgraine == graine.id_packgraine)
    .order_by(Graine.id_graine).all()]
rank = ids_in_pack.index(graine.id_graine) + 1
f"{graine.variete.nom_variete} #{rank}"
```

> ⚠️ Historique corrections :
> - 2026-04-28 : le nom utilisait `plant_counter` (compteur de boucle) → remplacé par `id_graine` global
> - 2026-05-25 : `id_graine` global (ex: #1758) → rang dans le paquet (ex: #5). Migration one-shot : `backend/migrate_plant_names.py`

## Affichage — Tri alphabétique (PlantesTab)

Dans l'onglet **Plantes actives** (`PlantesTab.tsx`) :

- Les plantes actives sont triées par `nom_affichage` A→Z (`.localeCompare('fr', { sensitivity: 'base' })`) avant affichage, que ce soit en liste plate ou groupée par variété.
- Les **groupes de variétés** (quand plusieurs variétés présentes) sont également triés alphabétiquement par nom de variété.

Les plantes **terminées** (recolte, prete, abandonne, wpff) ne sont pas concernées par ce tri.

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

- [[database/database-culture]] — Plant + ActionCalendrier models
- [[features/culture-lifecycle]] — parent culture status flow
- [[api/api-cultures]] — plant CRUD endpoints
