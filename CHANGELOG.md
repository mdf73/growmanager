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
