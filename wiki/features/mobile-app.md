---
type: feature
updated: 2026-07-09
sources: [frontend/capacitor.config.ts, .github/workflows/android-apk.yml, frontend/src/components/ServerSetup.tsx, frontend/src/api/client.ts]
---

# App Mobile Android (Capacitor)

App Android = le frontend React empaqueté dans un APK via **Capacitor**, qui parle au serveur GrowManager auto-hébergé de l'utilisateur (Phase A du plan mobile — voir [[roadmap]]).

## Architecture

- **Aucun code dupliqué** : même frontend que le web, breakpoints Tailwind pour le mobile.
- **Backend inchangé** : l'app appelle `<url-serveur>/api` (config A3, clé localStorage `gm_server_url`).
- **Premier lancement** : `App.tsx` détecte le runtime natif (`isNativeApp()` de client.ts) → si aucun mode choisi (`gm_mode`), affiche `ModeSetup.tsx` : choix **Autonome** (SQLite local, Phase B) ou **Serveur** (saisie URL + test `/health` + reload). Rétro-compat : URL déjà configurée → mode serveur.
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
- APK **debug** (signature debug) : installation via "sources inconnues", flaggé "app inconnue" par Android — c'est le flux historique, distribution directe hors Play Store.

**Récupérer l'APK** : GitHub → Actions → Build Android APK → run → Artifacts, ou la release du tag.

## Distribution Google Play (depuis v3.4.0)

Le workflow build en plus un **AAB signé** (`bundleRelease`), destiné à Google Play, si le secret `GROWMANAGER_KEYSTORE_BASE64` est configuré. Étapes ajoutées (conditionnelles, `if: secrets.GROWMANAGER_KEYSTORE_BASE64 != ''`) après `npx cap sync android` : décodage du keystore → injection d'un `signingConfigs.release` dans `android/app/build.gradle` (script Python, cherche `buildTypes {` et `release {\n  minifyEnabled false`) → `gradlew bundleRelease` → artifact `growmanager-aab` + attaché à la release GitHub si tag.

**Secrets GitHub requis** (Settings → Secrets and variables → Actions → repository secrets) :

| Secret | Contenu |
|---|---|
| `GROWMANAGER_KEYSTORE_BASE64` | keystore RSA 2048 (upload key) encodé en base64 |
| `GROWMANAGER_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `GROWMANAGER_KEY_ALIAS` | alias de la clé (`growmanager-upload`) |
| `GROWMANAGER_KEY_PASSWORD` | mot de passe de la clé |

Keystore généré une seule fois via `keytool -genkeypair` (RSA 2048, validité 10 000 j) et conservé par Pik hors du repo (jamais commité). Avec **Play App Signing** activé côté Play Console, Google conserve la vraie clé de signature de l'app — la perte de l'upload key est rattrapable via une demande de reset (formulaire de support Play Console), pas fatale.

**Plan en 2 temps (décision 2026-07-09) :**
- **Temps 1 (en cours)** : app publiée en **Test interne** Play Console (jusqu'à 100 testeurs par email, lien privé, pas de fiche publique, exempté du formulaire "Sécurité des données"). But : l'app devient signée par Google → plus d'alerte "app inconnue" à l'installation pour les testeurs.
- **Temps 2 (plus tard)** : passage en **Production** publique pour permettre les mises à jour poussées depuis le Play Store (fini le téléchargement manuel via GitHub). Nécessite en plus du Test interne : un **Test fermé** avec 12 testeurs actifs pendant 14 jours consécutifs (le Test interne ne compte pas pour ce palier — spécifique aux comptes développeur perso créés après nov. 2023), + fiche store complète (icône, captures, description, politique de confidentialité, classification par âge, formulaire "Sécurité des données" cette fois obligatoire).

Étapes manuelles côté Pik (hors repo, dans Play Console) : création du compte développeur (25$, vérification d'identité), création de l'app (`com.growmanager.app`), premier upload manuel de l'AAB pour activer Play App Signing, ajout des testeurs, partage du lien d'opt-in.

## Accès distant — Tailscale (recommandé)

Le serveur reste local, rien n'est exposé sur internet. Tailscale crée un VPN privé entre les appareils. Le serveur expose l'app sur le port 80 (`APP_PORT` par défaut dans `docker-compose.server.yml`) → URLs sans port.

**Procédure complète :**

1. **Compte** : tailscale.com → "Get started" → connexion Google/GitHub/Microsoft. Plan gratuit suffisant (100 appareils, usage perso).
2. **Serveur Linux** : `curl -fsSL https://tailscale.com/install.sh | sh` puis `sudo tailscale up` → ouvrir l'URL affichée dans un navigateur et se connecter.
3. **Adresse du serveur** : `tailscale ip -4` → IP permanente de forme `100.x.y.z`.
4. **⚠ Désactiver l'expiration de clé** (sinon déconnexion silencieuse après ~6 mois) : https://login.tailscale.com/admin/machines → machine serveur → "..." → **Disable key expiry**. À faire une fois.
5. **Téléphone** : app Tailscale (Play Store) → même compte → activer le VPN. Peut rester actif en permanence (consommation négligeable).
6. **Test** : téléphone en données mobiles (WiFi coupé) → `http://100.x.y.z` dans Chrome → GrowManager doit s'afficher.
7. **App GrowManager** : premier lancement ou Paramétrage → Général → Serveur : `http://100.x.y.z`.

**Astuce** : utiliser l'IP Tailscale comme URL unique même à la maison (Tailscale route en direct sur le LAN quand les appareils sont sur le même réseau) — une seule config qui marche partout.

**Bonus** : activer MagicDNS dans la console admin → serveur joignable par son nom (`http://monserveur`).

Alternative réseau local pur : `http://<ip-locale-du-serveur>` — fonctionne uniquement en WiFi maison.

## Mises à jour de l'app

L'APK **embarque sa propre copie du frontend** (figée au build). Règle :
- Fix **backend / nginx / serveur** → rien à faire côté téléphone.
- Fix **interface (frontend)** → nouvel APK : Actions → Build Android APK (ou tag `vX.Y.Z`), installer par-dessus (config conservée, pas de désinstallation).
- Le pull-to-refresh n'existe pas en natif — fermer/rouvrir ne recharge pas le code, seul un nouvel APK le fait.
- Alternative possible si besoin (non implémentée) : APK "coquille mince" qui charge l'UI depuis le serveur (toujours à jour, mais UI indisponible hors connexion serveur).

Le test de connexion utilise `GET <url>/health` — proxifié partout depuis le fix du 2026-07-04 (vite dev, nginx dev, nginx prod du Dockerfile.prod).

## Limites connues (v1)

- En mode Serveur, l'app nécessite le serveur joignable — le mode 100% autonome est disponible via la Phase B (voir [[mobile-standalone]]).
- Distribution Play Store en cours (Test interne, voir section dédiée ci-dessus) — pas encore en Production publique.
- La PWA web reste disponible en parallèle (voir [[log]] A3) mais l'APK/AAB est la voie principale.

## See Also

- [[roadmap]] — plan Phase Mobile A/B
- [[frontend/frontend-overview]] — bottom nav mobile, conventions responsive
