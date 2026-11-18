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
| `deces_plante` | → abandonne |
| `graine_morte` | → abandonne ; la graine est comptée **morte** dans le taux de germination du classement variétés (ajouté 2026-10-02) |

**Taux de germination (classement variétés)** — plantes `origine = graine` uniquement : *morte* = a une action `graine_morte` ; *germée* = `date_germination` renseignée ou statut ≥ veg ; le reste (germination en cours, abandon sans action `graine_morte`) n'est pas compté.

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

**Boutures externes (2026-10-11)** : des boutures achetées ou reçues s'enregistrent comme un pack, avec le type « Bouture » (`Graine.types_graines = 'Bouture'`). Ajoutées à une culture (création ou « Ajouter une plante »), elles donnent une plante `origine = 'bouture'`, `statut = 'germination'`, `statut_clone = 'en_attente'` : même suivi d'enracinement que les clones maison, avec badge « Bouture externe ». Variété et breeder viennent de la graine du lot. Exclues du taux de germination.

**Enracinement (UI, 2026-10-11)** : tant qu'une bouture (clone maison ou externe) est en attente, sa carte affiche l'étiquette « Enracinement ✂️ » et un bouton « Valider l'enracinement » à côté du badge jaune. Valider l'enracinement passe la plante en `veg`. Un bouton rouge « Enracinement échoué » (2026-10-18), à côté, déclare la bouture morte après confirmation (`clone-rate` : `statut_clone = 'rate'`, `statut = 'abandonne'`) ; elle reste listée dans « Terminées » avec le badge « N'a pas pris », pour les stats d'enracinement. En base, le statut reste `germination` pendant l'enracinement.

## Sexe & reproduction (2026-11-18)

Pour les **graines régulières** et la **création de graines**. Le sexe se déclare sur la plante, les statuts du cycle de vie ne changent pas : garder une plante pour la repro est une simple case.

### Champs DB (Plant)

| Champ | Type | Notes |
|---|---|---|
| `sexe` | String (nullable) | `femelle` \| `male` \| `hermaphrodite` \| `NULL` = inconnu |
| `date_sexage` | Date (nullable) | Remplie à aujourd'hui quand le sexe change (sauf date fournie), effacée si retour à inconnu |
| `conserve_repro` | Bool | Plante gardée pour la reproduction (père ou mère) |
| `reverse_sts` | Bool | Femelle reversée (STS) : donneuse de pollen féminisé |

Liens ajoutés : `Pollen.id_plant_source` (plante donneuse) et `Croisement.id_plant_mere` (plante mère réelle), tous deux FK → Plant, mis à NULL si la plante est supprimée (le pollen et le croisement gardent variété et phéno).

### Règles

- **Sexe à la création** : `NULL` si la graine est régulière (`types_graines` contient « gul » : Regular, Régulière), `femelle` sinon (féminisée, auto, bouture). Plante externe (séchage/curing importé) : `femelle`. Un **clone hérite du sexe** de sa mère.
- **Migration** (une seule fois, à la création de la colonne) : toutes les plantes existantes passent en `femelle`, sauf celles issues d'une graine régulière (restent à `NULL`). Ensuite, un `NULL` est un choix de l'utilisateur et n'est jamais réécrit.
- **Écarter les mâles** : `POST /cultures/{id}/ecarter-males` (`{ inclure_hermaphrodites }`) passe en `abandonne` les mâles (et en option les hermaphrodites) encore sur pied (`germination` / `veg` / `floraison`), **sauf** ceux `conserve_repro`, et ajoute « Écartée (mâle) le JJ/MM/AAAA » aux notes.
- **Collecter du pollen depuis une plante** : `POST /croisements/pollen` avec `id_plant_source` → variété (via la graine) et phéno (nom de la plante) déduits s'ils sont vides, `reverse` déduit (femelle ou `reverse_sts`) s'il n'est pas envoyé, plante marquée `conserve_repro`.
- **Croisement avec plante mère** : `id_plant_mere` → variété et phéno déduits s'ils sont vides, plante marquée `conserve_repro` (création et modification).
- **Plantes candidates** : `GET /croisements/plantes-repro?role=pere|mere`. Père = mâles + femelles reversées ; mère = femelles + hermaphrodites. Plantes sur pied d'une culture non terminée, plus toutes les `conserve_repro` où qu'elles soient. Tri : conservées d'abord, puis culture, puis nom.

### Frontend

- **`PlantCard`** : badge sexe cliquable (sexage rapide ♀ / ♂ / ⚥ / ?, avec date), badge « 🧬 Conserver repro » (bascule), badge « Reversée STS », badge « 🌼 N lots de pollen ». Affichés seulement si utile (pas sur une féminisée femelle ordinaire). Icône fiole « Collecter du pollen » sur un mâle ou une femelle reversée → `CollectePollenModal.tsx`. Formulaire d'édition : sexe, date de sexage, cases repro et STS.
- **`PlantesTab`** : bandeau « Sexage » (bilan ♀/♂/⚥/? des plantes actives) + bouton « Écarter les mâles (N) » avec confirmation et option hermaphrodites. Visible dès qu'une plante active est régulière ou non femelle.
- **`Croisement.tsx`** : composant `PlanteReproSelect` (« Plante donneuse » dans le formulaire pollen, « Plante mère » dans les formulaires de croisement, préremplissage variété/phéno/reverse). Affichage « 🌱 nom de la plante » sur les cartes croisement et dans le tableau pollen.
- Portage mode autonome : schéma SQLite v6 (`db.ts`, même backfill), handlers `cultures.ts` / `cultures-helpers.ts` / `croisement.ts`.

**Pas fait** : relier les pères de l'Open Field (`PlantePereOpenField`) à de vraies plantes.

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
