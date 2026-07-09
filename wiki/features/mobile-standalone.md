---
type: feature
updated: 2026-07-06
sources: [frontend/src/local/, frontend/src/api/client.ts, frontend/src/components/ModeSetup.tsx]
---

# Mode Standalone (Phase B)

L'app Android peut fonctionner **sans serveur** : toutes les données vivent dans une base SQLite embarquée sur le téléphone. C'est le second mode du dual-mode décidé le 2026-07-05 (voir [[roadmap]]) — le mode Serveur (Phase A, [[mobile-app]]) reste inchangé.

## Choix du mode

- **Premier lancement natif** : `ModeSetup.tsx` propose Autonome ou Serveur. Rétro-compat : une URL serveur déjà configurée (`gm_server_url`) → mode serveur sans question.
- **Changement** : Paramétrage → Général → "Mode de fonctionnement" (app native uniquement). Le passage d'un mode à l'autre recharge l'app ; les deux bases sont **indépendantes** (pas de synchronisation), la base locale n'est pas supprimée en repassant en mode serveur.
- Clé localStorage : `gm_mode` (`server` | `standalone`), helpers dans `api/client.ts` (`getAppMode`, `setAppMode`, `isStandalone`, `isNativeApp`).

## Architecture (`frontend/src/local/`)

| Fichier | Rôle |
|---|---|
| `schema.ts` | DDL des 78 tables, **généré** depuis `backend/app/models/all_models.py` (SQLAlchemy → dialecte SQLite). Régénérer si le schéma backend change. |
| `db.ts` | Connexion `@capacitor-community/sqlite`, migrations via `PRAGMA user_version`, seeds au démarrage. |
| `seeds.ts` | AppSettings (prix_kwh, devise, vpd_leaf_offset) + ~35 listes paramétrables + seuil alerte stock Fleur — miroir des seeds backend. |
| `router.ts` | Registre de routes REST locales. Les params `:id*` ne matchent que des chiffres (comme FastAPI). `LocalHttpError` = HTTPException. |
| `adapter.ts` | Adapter Axios branché sur le client **et** `axios.defaults` en standalone. URLs absolues (http…) → vrai réseau. Route non enregistrée → **501** avec message explicite. |
| `helpers.ts` | one/count/insert/updateById/boolify/jsonify… (booléens 0/1 ↔ bool, colonnes JSON). |
| `photos-fs.ts` | Stockage photos dans `Directory.Data/photos/` (`@capacitor/filesystem`), `localPhotoUrl()` via `Capacitor.convertFileSrc`. |
| `handlers/` | 21 fichiers = portage TS fidèle des routers FastAPI (mêmes chemins, codes d'erreur, effets de bord). |

**Principe clé** : les fichiers `src/api/*.ts` et les pages ne changent pas — le contrat REST est réimplémenté sous Axios.

## Couverture fonctionnelle

Porté (sprints B1→B6) : référentiels (breeders, variétés, fournisseurs, graines/packs/catalogue, matériel, espaces, engrais, paramètres), cœur culture (CRUD, plants, clonage, transfert, actions + effets, coûts, calendrier, stats, plan de culture), post-récolte (séchage, curing, WPFF, stock + origine + alertes, extractions rosin/hash, vaporisateurs), recettes (6 types), sol vivant (préparation + suivi), croisements + pollen, open field, notations, dashboard complet, calendrier global, recherche, comparaison, consommation, historique cultures, **photos** (sans compression ni thumbnail : original conservé, `thumbnail_path = filepath`).

## Limites (v1)

- **Capteurs Govee / esphome** : serveur requis → module Dashboard, page Constantes (T°/VPD) et onglet Paramétrage → Capteurs **masqués** en standalone ; temp/humidité séchage = null.
- **Exports PDF** (fiche culture, étiquettes QR, calendrier) et **exports/imports CSV** (Sauvegarde et restaurations masqué) : non portés → 501 avec message clair.
- Photos : pas de compression 2 Mo ni de thumbnail 300×300 (fichier original affiché).
- Les données restent sur l'appareil — pensez à la sauvegarde Android (la base est dans le stockage app).

## See Also

- [[mobile-app]] — mode serveur (Phase A), build APK, Tailscale
- [[roadmap]] — sprints B0–B6
