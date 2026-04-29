# GrowManager — CLAUDE.md

## Stack technique
- **Frontend** : React 18 + TypeScript + Vite + Tailwind CSS + React Query
- **Backend** : FastAPI + SQLAlchemy 2.0 + PyMySQL
- **DB** : MySQL (Docker) — `growmanager-db-1`
- **Containers** : `growmanager-backend-1` (port 8000), `growmanager-frontend-1` (port 5173)

## Commandes utiles
```bash
docker-compose restart backend   # après modifs backend
docker-compose restart frontend  # après modifs frontend (rare, Vite HMR)
docker-compose logs -f backend   # voir les erreurs Python
```

## Architecture des fichiers clés
```
backend/app/
  models/all_models.py      # TOUS les modèles SQLAlchemy
  models/__init__.py        # exports — METTRE À JOUR à chaque nouveau modèle
  routers/                  # un fichier par domaine
  schemas/                  # schemas Pydantic par domaine
  main.py                   # run_migrations() + include_router()

frontend/src/
  api/                      # clients Axios typés (1 fichier par domaine)
  pages/                    # pages principales
  components/               # composants réutilisables
  components/culture/       # composants spécifiques culture
```

## Mise à jour du Wiki — OBLIGATOIRE

Le wiki Obsidian (`Obsidian - GrowManager/Growmanager/wiki/`) est la source de vérité du projet. **À la fin de chaque action de code, mettre à jour les fichiers wiki concernés.**

### Quoi mettre à jour selon l'action

| Action | Fichiers wiki à modifier |
|---|---|
| Nouveau router (`routers/xxx.py`) | `api/overview.md` — ajouter ligne dans le tableau des routers |
| Nouvelle page (`pages/Xxx.tsx`) | `frontend/pages.md` — ajouter section `### NomPage (\`/route\`)` |
| Nouveau modèle SQLAlchemy | `database/schema-overview.md` — ajouter ligne dans la section du domaine concerné |
| Nouveau schéma Pydantic | Rien (couvert par la doc router) |
| Modification d'une feature existante | Page wiki correspondante (`features/`, `api/`, `frontend/`) |
| Bug corrigé | `bugs/` — créer ou mettre à jour le fichier du bug |
| Décision d'architecture | `architecture/decisions.md` |
| TODO résolu | `roadmap.md` — déplacer vers section Completed |
| Nouveau TODO identifié | `roadmap.md` — ajouter sous la section priorité appropriée |

### Toujours logger dans wiki/log.md

Après chaque mise à jour wiki, ajouter une entrée dans `log.md` :
```
## [YYYY-MM-DD] update | <description courte de ce qui a changé>
```

### Mettre à jour les compteurs dans overview.md

Si le nombre de routers, pages ou modèles change, mettre à jour les chiffres dans `overview.md` (ligne `← XX router files`, `← XX page components`).

---

## Règles importantes

### Backend
- **Nouvelles tables** → ajouter dans `all_models.py` ET `models/__init__.py`
- **Nouvelles colonnes** → ajouter dans `run_migrations()` avec pattern `INFORMATION_SCHEMA`
- **Routes FastAPI** → déclarer les routes statiques (`/utils/...`) AVANT `/{id}` dans chaque router
- **Migrations DB** → pas d'Alembic, utiliser `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via `INFORMATION_SCHEMA`

### Frontend
- **Couleur brand** → `grow-600` (Tailwind custom)
- **React Query** → invalider avec `qc.invalidateQueries({ queryKey: [...] })` après mutations
- **Hooks** → jamais dans switch/case, toujours au top niveau du composant

## Modèles DB — état actuel (tables principales)
| Table | Description |
|---|---|
| `Culture` | Session de culture (active/sechage_curing/terminee) |
| `Plant` | Plante individuelle (statut: germination→curing) |
| `ActionCalendrier` | Journal d'actions par plante/culture |
| `PlanCulture` | Plan préparation future culture *(nouveau)* |
| `PlanCultureVariete` | Lignes du plan (pack graine + nb + pot) *(nouveau)* |
| `EspaceCulture` | Espaces de culture avec surface_m2 |
| `PackGraine` | Lot de graines acheté |
| `Graine` | Graine individuelle (utilisee=True quand plantée) |
| `Stock` | Stock de produits (fleur, hash, rosin…) |
| `TemperatureLog` | Données capteurs Govee |

## Formule calcul pots
```python
nb_pots = round(surface_m2 * 20.8 * volume_l ** -0.59)
# Calibrée sur : 120x120cm → [30×1L, 14×5.5L, 12×11L, 9×16L, 4×35L, 3×50L]
```

## Statuts Plant
`germination → veg → floraison → sechage → curing → prete | recolte | abandonne`

## Statuts Culture
`active → sechage_curing → terminee`

## TODO en attente
→ Voir `wiki/roadmap.md` pour la liste complète et à jour.