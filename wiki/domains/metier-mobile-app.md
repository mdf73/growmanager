---
type: domain
updated: 2026-07-04
---

# 📱 Application Mobile

App Android (Capacitor) qui enveloppe le frontend web.

## Ce que ça fait

- **Build APK** — via Capacitor, CI GitHub Actions.
- **Premier lancement** — écran de config serveur (saisie URL + test `/health`).
- **Accès distant** — via Tailscale.
- **Règle de mise à jour** : un fix backend/serveur ne nécessite rien côté téléphone ; un fix interface nécessite un rebuild de l'APK.

## Détails techniques

- [[features/mobile-app]] — config Capacitor, build APK CI, écran premier lancement, accès distant Tailscale
- [[frontend/frontend-overview]] — routing et structure de composants partagés avec le web

## Voir aussi

- [[domains/metier-cultures]] — toutes les fonctionnalités culture sont accessibles depuis l'app mobile
