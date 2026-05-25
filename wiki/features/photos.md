---
type: feature
updated: 2026-05-25
sources: [models/all_models.py, routers/photos.py, components/culture/PhotoGallery.tsx, pages/Culture.tsx]
---

# Feature — Galerie Photos

## Deux types de photos

| Type | `id_plant` | `id_culture` | Usage |
|---|---|---|---|
| **Photo globale** | `null` | ✓ | Vue d'ensemble de la culture, serre entière, etc. |
| **Photo de plante** | ✓ | ✓ | Suivi individuel d'une plante/graine spécifique |

## Backend (inchangé — déjà opérationnel)

Le modèle `Photo` supporte les deux cas nativement :

```
Photo.id_culture  FK → Culture   (nullable)
Photo.id_plant    FK → Plant     (nullable, SET NULL on delete)
```

Endpoint upload : `POST /api/photos/upload`
- `id_culture` (Form, optional)
- `id_plant` (Form, optional) — si fourni, lie la photo à la plante ET à la culture
- `notes`, `date_prise` (Form, optional)

## Frontend

### PhotoGallery (`components/culture/PhotoGallery.tsx`)

Accepte une prop `plants?: Plant[]` en plus de `idCulture` et `idPlant`.

**Zone upload :**
- Sélecteur "Associer à" : `🌿 Toute la culture` (global) **ou** une plante de la liste
- Les plantes récoltées/abandonnées apparaissent dans un groupe séparé dans le select
- Un texte d'info confirme la cible sélectionnée avant l'upload
- En vue plante (prop `idPlant` fourni) : pas de sélecteur, toujours associé à la plante

**Galerie :**
- Badge `🌱 [nom plante]` sur les miniatures associées à une plante (vert, top-left)
- Filtres rapides : **Toutes** · **🌿 Culture (N)** · **🌱 [Plante] (N)** — seules les plantes ayant au moins une photo sont affichées
- Lightbox : badge plante vert sous l'image si applicable

### Culture.tsx

```tsx
<PhotoGallery idCulture={cultureId} plants={culture.plants} />
```

`culture.plants` contient toutes les plantes de la culture (actives + terminées).

## Comportement de filtrage

- `filterTarget = 'all'`    → toutes les photos de la culture
- `filterTarget = 'global'` → photos sans plante (`id_plant = null`)
- `filterTarget = '<id>'`   → photos de la plante `id`

## Upload via ActionModal

Quand l'action `photo` est sélectionnée dans l'`ActionModal`, la cible (`target`) détermine `id_plant` :
- `target = 'global'` → `id_plant` non envoyé → photo globale
- `target = '<id>'`   → `id_plant = <id>` → photo de plante

## Voir aussi

- [[database/culture]] — modèle Photo, ActionCalendrier
- [[api/cultures]] — endpoint cultures et plants
