---
type: feature
updated: 2026-07-04
sources: [frontend/capacitor.config.ts, .github/workflows/android-apk.yml, frontend/src/components/ServerSetup.tsx, frontend/src/api/client.ts]
---

# App Mobile Android (Capacitor)

App Android = le frontend React empaqueté dans un APK via **Capacitor**, qui parle au serveur GrowManager auto-hébergé de l'utilisateur (Phase A du plan mobile — voir [[roadmap]]).

## Architecture

- **Aucun code dupliqué** : même frontend que le web, breakpoints Tailwind pour le mobile.
- **Backend inchangé** : l'app appelle `<url-serveur>/api` (config A3, clé localStorage `gm_server_url`).
- **Premier lancement** : `App.tsx` détecte le runtime natif (`window.Capacitor.isNativePlatform()`) → si aucune URL configurée, affiche `ServerSetup.tsx` (saisie URL + test `/health` + reload).
- **Fichiers statiques** : `photoUrl()` (photos.ts) et l'export PDF calendrier passent par `serverFileURL()` / `getServerUrl()` pour pointer vers le serveur distant.

## Config Capacitor (`frontend/capacitor.config.ts`)

| Clé | Valeur | Raison |
|---|---|---|
| appId | `com.growmanager.app` | identifiant Android |
| webDir | `dist` | build Vite |
| server.androidScheme | `http` | évite le mixed-content vers les serveurs `http://` locaux |
| server.cleartext | `true` | autorise le trafic non-HTTPS (réseau local / Tailscale) |

Dépendances : `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` en devDependencies (^7).
Le dossier `frontend/android/` n'est **pas commité** (`.gitignore`) — généré par la CI.

## Build APK — GitHub Actions

Workflow `.github/workflows/android-apk.yml` :
- Déclencheurs : manuel (workflow_dispatch) ou tag `vX.Y.Z` (comme docker-publish).
- Étapes : `npm ci` → `npm run build` → `npx cap add android` → `npx @capacitor/assets generate --android` (icônes/splash depuis `frontend/assets/icon.png` + `splash.png`, générées depuis `IconSeul.png`) → `gradlew assembleDebug`.
- Sortie : artifact `growmanager-apk` (30 j) + APK attaché à la release GitHub si tag.
- APK **debug** (signature debug) : suffisant pour un usage perso, installation via "sources inconnues". Une signature release pourra être ajoutée plus tard (keystore + secrets GitHub).

**Récupérer l'APK** : GitHub → Actions → Build Android APK → run → Artifacts, ou la release du tag.

## Accès distant — Tailscale (recommandé)

Le serveur reste local, rien n'est exposé sur internet. Tailscale crée un VPN privé entre tes appareils.

1. Installer Tailscale sur le serveur Linux : `curl -fsSL https://tailscale.com/install.sh | sh` puis `sudo tailscale up`.
2. Installer l'app Tailscale sur le téléphone (Play Store), se connecter au même compte.
3. Récupérer l'IP Tailscale du serveur : `tailscale ip -4` (forme `100.x.y.z`).
4. Dans l'app GrowManager (premier lancement ou Paramétrage → Général → Serveur) : `http://100.x.y.z` (ou `http://100.x.y.z:PORT` selon le port nginx).
5. Le téléphone atteint le serveur depuis n'importe où tant que Tailscale est actif (l'app Android Tailscale peut rester connectée en permanence, consommation négligeable).

Alternative réseau local pur : `http://<ip-locale-du-serveur>` — fonctionne uniquement en WiFi maison.

## Limites connues (v1)

- L'app nécessite le serveur joignable (pas de mode hors-ligne) — c'est la Phase B qui apportera le mode 100% autonome.
- APK debug non publié sur le Play Store (distribution directe).
- La PWA web reste disponible en parallèle (voir [[log]] A3) mais l'APK est la voie principale.

## See Also

- [[roadmap]] — plan Phase Mobile A/B
- [[frontend/overview]] — bottom nav mobile, conventions responsive
