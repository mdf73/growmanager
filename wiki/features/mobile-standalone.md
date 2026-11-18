---
type: feature
updated: 2026-10-23
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
| `db.ts` | Connexion `@capacitor-community/sqlite`, migrations via `PRAGMA user_version`, seeds au démarrage. Schéma v6 depuis le 2026-11-18 (sexe des plantes, liens plante ↔ pollen / croisement). |
| `seeds.ts` | AppSettings (prix_kwh, devise, vpd_leaf_offset) + ~35 listes paramétrables + seuil alerte stock Fleur — miroir des seeds backend. |
| `router.ts` | Registre de routes REST locales. Les params `:id*` ne matchent que des chiffres (comme FastAPI). `LocalHttpError` = HTTPException. |
| `adapter.ts` | Adapter Axios branché sur le client **et** `axios.defaults` en standalone. URLs absolues (http…) → vrai réseau. Route non enregistrée → **501** avec message explicite. |
| `helpers.ts` | one/count/insert/updateById/boolify/jsonify… (booléens 0/1 ↔ bool, colonnes JSON). |
| `zip.ts` | Écriture/lecture de .zip sans compression (« stored »), CRC32 vérifié, noms UTF-8, conversions base64. Aucune dépendance externe. |
| `backup-core.ts` | Logique de sauvegarde indépendante de Capacitor (testable sous Node) : dump de toutes les tables, validation du fichier, restauration atomique. |
| `photos-fs.ts` | Stockage photos dans `Directory.Data/photos/` (`@capacitor/filesystem`), `localPhotoUrl()` via `Capacitor.convertFileSrc`. |
| `handlers/` | 22 fichiers = portage TS fidèle des routers FastAPI (mêmes chemins, codes d'erreur, effets de bord). |

**Principe clé** : les fichiers `src/api/*.ts` et les pages ne changent pas — le contrat REST est réimplémenté sous Axios.

## Couverture fonctionnelle

Porté (sprints B1→B6) : référentiels (breeders, variétés, fournisseurs, graines/packs/catalogue, matériel, espaces, engrais, paramètres), cœur culture (CRUD, plants, clonage, transfert, actions + effets, coûts, calendrier, stats, plan de culture), post-récolte (séchage, curing, WPFF, stock + origine + alertes, extractions rosin/hash, vaporisateurs), recettes (6 types), sol vivant (préparation + suivi), croisements + pollen, open field, notations, dashboard complet, calendrier global, recherche, comparaison, consommation, historique cultures, **photos** (sans compression ni thumbnail : original conservé, `thumbnail_path = filepath`).

## Sauvegarde & restauration

Ajoutée au sprint B7 (2026-10-23). Onglet Paramétrage → « Sauvegarde et restaurations », visible dans les deux modes (en mode serveur : `.sql` mysqldump inchangé).

- **Routes locales** (`handlers/backup.ts`) : `GET /backup/info` (nombre et poids des photos), `GET /backup/dump?photos=0|1`, `POST /backup/restore` (multipart, champ `file`).
- **Format** : `growmanager_mobile_AAAAMMJJ_HHMMSS.zip` contenant `backup.json` (`format: growmanager-mobile-backup`, `version`, `schema_version`, `created_at`, `tables: {Table: {columns, rows}}`) + `photos/<fichier>` (chemins `filepath` et `thumbnail_path` de la table Photo). Case « Inclure les photos » cochée par défaut.
- **Restauration** : fichier lu et contrôlé avant toute modification (zip valide, CRC, format, `schema_version` ≤ celle de l'app). Puis DELETE de toutes les tables + INSERT dans **une seule transaction** (`executeSet`), clés étrangères désactivées pendant l'opération puis réactivées. Lots ≤ 900 valeurs par requête (limite de 999 variables des SQLite Android anciens). Tables et colonnes inconnues ignorées (sauvegarde plus ancienne). Seeds rejoués ensuite. Photos écrites dans `photos_restore/`, puis substituées à `photos/` une fois toutes écrites.
- **Uniquement mode autonome → mode autonome** : pas de passerelle vers le serveur (format différent du `.sql`).
- **Tests** (Node + better-sqlite3, vrai schéma 80 tables, ~1 700 lignes) : restauration identique à l'original, aucune incohérence de clés étrangères, échec en cours = base intacte, ancienne sauvegarde restaurée, fichiers invalides refusés, zip lisible par les outils standards. Non testé sur appareil réel.
- **Limite** : le zip est construit en mémoire ; une sauvegarde avec plusieurs centaines de Mo de photos peut échouer sur le téléphone → le message propose de réessayer sans les photos.
- `LocalResponse` accepte désormais `headers` (ex. `content-disposition`), relayés par `adapter.ts`.

## Limites (v1)

- **Capteurs Govee / esphome** : serveur requis → module Dashboard, page Constantes (T°/VPD) et onglet Paramétrage → Capteurs **masqués** en standalone ; temp/humidité séchage = null.
- **Étiquettes QR (PDF)** et **exports/imports CSV** : non portés → 501 avec message clair (sprints B8/B9, voir [[roadmap]]).
- Photos : pas de compression 2 Mo ni de thumbnail 300×300 (fichier original affiché).
- Les données restent sur l'appareil : faire régulièrement une sauvegarde .zip (voir ci-dessus) et la copier hors du téléphone.

## See Also

- [[mobile-app]] — mode serveur (Phase A), build APK, Tailscale
- [[roadmap]] — sprints B0–B10
