# Changelog

Toutes les modifications notables de GrowManager sont documentées ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)
Versioning : [Semantic Versioning](https://semver.org/lang/fr/) — `MAJOR.MINOR.PATCH`

- **PATCH** (`0.1.x`) → correction de bug
- **MINOR** (`0.x.0`) → nouvelle fonctionnalité
- **MAJOR** (`x.0.0`) → refonte majeure

---

## [Unreleased]

*(prochaines modifications en cours)*

---

## [3.4.3] - 2026-07-16

*(prochaines modifications en cours)*

---

## [3.4.2] - 2026-07-09

*(prochaines modifications en cours)*

---

## [3.4.1] — 2026-07-09

### Ajouté

- Distribution Google Play (Test interne) : build AAB signé dans `android-apk.yml`, activé via secrets GitHub

### Corrigé

- CI Android : `secrets.*` interdit dans les conditions `if:` de GitHub Actions — remplacé par une variable d'env de job
- Bump de version automatique silencieusement ignoré (Node.js absent du PATH de `cmd.exe`) — réécrit en PowerShell
- **Critique** : le script de bump PowerShell corrompait `package.json`/`package-lock.json`/`main.py`/`CHANGELOG.md` (accents en mojibake, BOM UTF-8 cassant le JSON, troncature) à cause de `Get-Content`/`Set-Content` sans encodage explicite — cassait `npm install` en local et en CI. Fichiers restaurés, script réécrit en `[System.IO.File]::ReadAllText/WriteAllText` UTF-8 sans BOM (voir wiki/log.md).

---

## [3.4.0] — 2026-07-09

Rattrapage de version : 63 commits livrés entre le 15/05/2026 (v3.3.0) et aujourd'hui sans que la version n'ait été incrémentée (oubli du protocole de bump à chaque validation). Ce tag regroupe l'ensemble de ces livraisons. À partir de cette version, le bump est **automatisé** (voir `push.bat` / `version-bump.js`) : il ne dépend plus d'un rappel manuel.

### Ajouté

#### Mobile — App Android (Phase A + Phase B complètes)
- Phase A : bottom nav mobile, pages responsive (28 pages), PWA installable, URL serveur configurable, app Android Capacitor + build APK via CI
- Phase B : mode standalone 100% local (SQLite embarqué, backend TS derrière un adapter Axios) — sprints B0 à B6 : fondations, référentiels, cœur culture, post-récolte, recettes & sol vivant, transverses et finitions

#### Fonctionnalités
- Intégration capteurs ESPHome (poussés en complément de Govee)
- Courbes capteurs T°/Hum/VPD dans les calendriers jour par jour + export PDF
- VPD foliaire configurable + édition des dates de culture
- Multi-clones : prélèvement de N boutures en une fois
- Croisement open field complet
- Rosin : âge de la plante à l'extraction, édition d'extraction, maillage obligatoire
- Maillages Polinator paramétrables
- PDF culture : journal jour-par-jour avec photos
- Calendrier : photo lightbox, navigation, algo closest-action, 3 encarts détail
- Galerie photos : sélecteur de plante
- Culture : regroupement des plantes actives par variété
- Traçabilité : amélioration du BocalTimelineDrawer (séchage + curing)
- Tri alphabétique de toutes les listes déroulantes dynamiques
- Stock : substrat_type, marques d'engrais, bocal auto-remontés depuis curing
- UI : logo + label "Pik" dans la sidebar
- Images Docker de production (multi-stage) + publication GHCR par tag

### Corrigé

- Coût engrais culture 1000x trop élevé (conversion d'unités L→mL)
- Normalisation des unités (mL/L/g/Kg) dans les coûts LSO, réamendements, arrosages et déductions de stock
- Dark mode : fonds pastels et textes colorés sur plusieurs pages (Parametrage, ClassementVarietes, hover accordéons)
- Stock : masquage des plantes en curing terminées dans l'onglet "En curing" ; filtrage engrais_type par plante
- Numéro de graine = rang dans le paquet (au lieu de l'id global)
- Matériel : correction du prix par lot + nommage sans doublon + création de lot sur toutes les catégories
- CalendrierGlobal : heure 02:00 due au parsing UTC de date_action ; erreur `[object Object]` sur arrosage/engrais
- Mobile : `/health` non proxifié (test de connexion serveur en échec) ; contenu caché derrière la bottom nav (bug 100vh)
- CI : Node 20 → 22 sur les runners Android ; régénération package-lock.json (sqlite plugin, Node 24)
- Migration manquante `Stock.substrat_type` ; credentials MySQL manquants dans les 3 docker-compose
- Coquille "bocalx" → "bocaux"

---

## [1.0.0] — 2026-05-07

Première version stable. Audit complet et correction de tous les bugs latents avant release.

### Corrigé

- Page Recettes Arrosage orpheline : route `/recettes/arrosage` ajoutée dans App.tsx et entrée nav ajoutée dans Layout.tsx (page, API, backend et modal existaient mais n'étaient pas accessibles via l'UI)
- Label nav trompeur : `/recettes/schemas-engrais` était affiché "Arrosages" — renommé en "Schémas d'engrais"
- Suppression de 3 `print()` de debug laissés dans `croisement.py` et `graines.py`
- Variable morte `thumb_path_rel` supprimée dans `photos.py` (bloc `except` de l'upload)

---

## [0.1.0] — 2026-05-07

Version initiale publique. MVP complet avec toutes les features V3.

### Ajouté

#### Cultures & Plantes
- Cycle de vie complet des cultures : active → séchage/curing → terminée
- Cycle de vie des plantes : germination → vég → floraison → séchage → curing → prête/récoltée/abandonnée
- Statut WPFF (Whole Plant Fresh Frozen) : congélateur direct depuis l'onglet Séchage
- Calendrier des actions avec calcul d'intensité lampe par phase (dimmer par lampe)
- Galerie photos par culture/plante (upload, compression Pillow, lightbox, suppression)
- Coûts de culture : électricité (par phase, par lampe), engrais, graines — total et €/g
- Historique des cultures avec décomposition des coûts en popup

#### Séchage & Curing
- Sessions de séchage et curing indépendantes
- Ouverture de bocaux en masse (sélection multiple, burping status, date + durée)
- Onglet "En curing" sur la page Stock avec carte total poids et tableau plantes

#### Stock & Extractions
- Gestion du stock (Fleur, Hash, Rosin, Trim, WPFF, Poussière)
- Extractions rosin et hash
- Lampe liée au stock depuis le matériel réel (plus de liste statique)

#### Génétique & Croisements
- Page Croisement : création, modification (modal pré-rempli), statuts
- Stock pollen avec colonnes triables (6 colonnes, tri asc/desc)
- Fix icône statut croisement (fallback statut inconnu)

#### Consommation
- Sessions de consommation avec déduction de stock
- Modal 3 étapes : type → stock/variété → quantité avec jauge visuelle
- Stats : totaux par période, graphique 7j, répartition type/vapo, projection stock

#### Classement & Notation
- Classement des variétés avec scores Culture/Conso
- Système de notation /100

#### Matériel & Vaporisateurs
- Inventaire vaporisateurs + consommables
- Sessions vapo avec déduction automatique du stock
- Champs marque et fournisseur depuis les listes partagées

#### Infrastructure
- Déploiement Docker multi-plateforme (Linux + Windows) via `docker-compose.server.yml`
- Frontend en multi-stage build (Node → nginx:alpine)
- Proxy nginx pour SPA routing, `/api/` et `/uploads/`
- Support PWA (manifest + auto-update)
- Versioning Git avec workflow `push.bat` + `_commit_msg.txt`

### Corrigé

- Nommage des plantes : `<variété> #<id_graine>` (était basé sur le compteur de boucle)
- Audit complet : 2 erreurs bloquantes backend (Python) + 11 bugs TypeScript sérieux
- Affichage et suppression photos (proxy `/uploads/` manquant dans nginx et Vite)
- Crash React sur la page Consommation (`.data` manquant sur `stockAPI.getAll()`)

---

<!-- Liens de comparaison (à renseigner avec l'URL GitHub) -->
[Unreleased]: https://github.com/mdf73/growmanager/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mdf73/growmanager/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/mdf73/growmanager/releases/tag/v0.1.0
