---
type: bug
status: corrigé
discovered: 2026-11-18
fixed: 2026-11-18
sources: [frontend/native/android/MainActivity.java, frontend/src/utils/keyboardScroll.ts, .github/workflows/android-apk.yml]
---

# Bug — Le clavier Android recouvre les champs en cours de saisie

**Signalé le 2026-11-18** par Pik sur l'APK.

## Symptôme

En touchant un champ (surtout dans une modale : arrosage, nouvelle culture…), le clavier s'ouvrait par-dessus le champ, qui restait caché pendant la saisie.

## Cause

- `targetSdk 36` : Android 15+ impose l'affichage bord à bord. Dans ce mode, `adjustResize` est ignoré : la fenêtre n'est plus réduite quand le clavier s'ouvre.
- Capacitor 7 (`adjustMarginsForEdgeToEdge: 'force'`) pose un listener d'insets sur la WebView qui ne prend en compte que `systemBars() | displayCutout()`, pas `ime()`. La WebView garde donc toute sa hauteur et le clavier la recouvre ; `innerHeight`, `vh` et `visualViewport` ne changent pas, aucun recentrage n'est possible côté web.

## Correctif

1. **Natif** : `frontend/native/android/MainActivity.java` remplace, après `super.onCreate()`, le listener de Capacitor par un équivalent dont la marge basse vaut `max(barres système, clavier)`. La WebView rétrécit quand le clavier s'ouvre, les modales en `max-h-[90vh]` + `overflow-y-auto` s'adaptent.
2. **CI** : `frontend/android/` n'est pas commité, l'étape « Install custom MainActivity (clavier) » d'`android-apk.yml` copie le fichier après `npx cap add android` et échoue si la copie n'a pas pris.
3. **Web** : `src/utils/keyboardScroll.ts` (appelé dans `main.tsx`) recentre le champ actif (`scrollIntoView({ block: 'center' })`) 350 ms après `focusin` et à chaque `resize`, seulement s'il n'est pas déjà visible. Actif uniquement sur écran tactile (`pointer: coarse`).

## À retenir

Toute personnalisation native Android passe par `frontend/native/` + une étape CI, jamais directement dans `frontend/android/` (régénéré à chaque build).

## See Also

- [[features/mobile-app]]
- [[bugs/drawer-decale-space-y]]
