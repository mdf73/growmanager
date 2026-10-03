# Bug — version-bump.ps1 corrompt les dépendances du package-lock.json

**Découvert :** 2026-10-03 (push v3.6.1) · **Statut :** ✅ corrigé

## Symptôme
Les 2 workflows « Build & Publish Docker images » échouent sur l'étape *Build & push Frontend* :
`process "/bin/sh -c npm ci" did not complete successfully: exit code: 1` → en local : `No matching version found for readdirp@3.6.1`.

## Cause
`version-bump.ps1` faisait un `[regex]::Replace` **global** de `"version": "3.6.0"` → `"3.6.1"` dans `frontend/package-lock.json`. Toute dépendance ayant le même numéro de version que l'app était aussi modifiée (ici `chokidar` et `readdirp` 3.6.0 → 3.6.1, version inexistante sur npm). Bug latent depuis l'automatisation du bump (v3.4.0) : il ne se déclenche que quand la version de l'app coïncide avec celle d'une dépendance.

## Fix
- `version-bump.ps1` : instance `[regex]` + `Replace(input, replacement, count)` avec `count = 2` pour le lockfile (racine + `packages[""]`, toujours en tête de fichier) et `1` pour `package.json`.
- `package-lock.json` : chokidar et readdirp remis en 3.6.0 ; `npm ci` vérifié OK.

## Garde-fou
Si un build Docker/APK échoue sur `npm ci` juste après un push, vérifier en premier le diff du lockfile du commit de bump.
