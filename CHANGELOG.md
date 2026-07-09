# Changelog

Toutes les modifications notables de GrowManager sont documentÃ©es ici.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)
Versioning : [Semantic Versioning](https://semver.org/lang/fr/) â€” `MAJOR.MINOR.PATCH`

- **PATCH** (`0.1.x`) â†’ correction de bug
- **MINOR** (`0.x.0`) â†’ nouvelle fonctionnalitÃ©
- **MAJOR** (`x.0.0`) â†’ refonte majeure

---

## [Unreleased]

*(prochaines modifications en cours)*

---

## [3.4.1] - 2026-07-09

*(prochaines modifications en cours)*

---

## [3.4.0] â€” 2026-07-09

Rattrapage de version : 63 commits livrÃ©s entre le 15/05/2026 (v3.3.0) et aujourd'hui sans que la version n'ait Ã©tÃ© incrÃ©mentÃ©e (oubli du protocole de bump Ã  chaque validation). Ce tag regroupe l'ensemble de ces livraisons. Ã€ partir de cette version, le bump est **automatisÃ©** (voir `push.bat` / `version-bump.js`) : il ne dÃ©pend plus d'un rappel manuel.

### AjoutÃ©

#### Mobile â€” App Android (Phase A + Phase B complÃ¨tes)
- Phase A : bottom nav mobile, pages responsive (28 pages), PWA installable, URL serveur configurable, app Android Capacitor + build APK via CI
- Phase B : mode standalone 100% local (SQLite embarquÃ©, backend TS derriÃ¨re un adapter Axios) â€” sprints B0 Ã  B6 : fondations, rÃ©fÃ©rentiels, cÅ“ur culture, post-rÃ©colte, recettes & sol vivant, transverses et finitions

#### FonctionnalitÃ©s
- IntÃ©gration capteurs ESPHome (poussÃ©s en complÃ©ment de Govee)
- Courbes capteurs TÂ°/Hum/VPD dans les calendriers jour par jour + export PDF
- VPD foliaire configurable + Ã©dition des dates de culture
- Multi-clones : prÃ©lÃ¨vement de N boutures en une fois
- Croisement open field complet
- Rosin : Ã¢ge de la plante Ã  l'extraction, Ã©dition d'extraction, maillage obligatoire
- Maillages Polinator paramÃ©trables
- PDF culture : journal jour-par-jour avec photos
- Calendrier : photo lightbox, navigation, algo closest-action, 3 encarts dÃ©tail
- Galerie photos : sÃ©lecteur de plante
- Culture : regroupement des plantes actives par variÃ©tÃ©
- TraÃ§abilitÃ© : amÃ©lioration du BocalTimelineDrawer (sÃ©chage + curing)
- Tri alphabÃ©tique de toutes les listes dÃ©roulantes dynamiques
- Stock : substrat_type, marques d'engrais, bocal auto-remontÃ©s depuis curing
- UI : logo + label "Pik" dans la sidebar
- Images Docker de production (multi-stage) + publication GHCR par tag

### CorrigÃ©

- CoÃ»t engrais culture 1000x trop Ã©levÃ© (conversion d'unitÃ©s Lâ†’mL)
- Normalisation des unitÃ©s (mL/L/g/Kg) dans les coÃ»ts LSO, rÃ©amendements, arrosages et dÃ©ductions de stock
- Dark mode : fonds pastels et textes colorÃ©s sur plusieurs pages (Parametrage, ClassementVarietes, hover accordÃ©ons)
- Stock : masquage des plantes en curing terminÃ©es dans l'onglet "En curing" ; filtrage engrais_type par plante
- NumÃ©ro de graine = rang dans le paquet (au lieu de l'id global)
- MatÃ©riel : correction du prix par lot + nommage sans doublon + crÃ©ation de lot sur toutes les catÃ©gories
- CalendrierGlobal : heure 02:00 due au parsing UTC de date_action ; erreur `[object Object]` sur arrosage/engrais
- Mobile : `/health` non proxifiÃ© (test de connexion serveur en Ã©chec) ; contenu cachÃ© derriÃ¨re la bottom nav (bug 100vh)
- CI : Node 20 â†’ 22 sur les runners Android ; rÃ©gÃ©nÃ©ration package-lock.json (sqlite plugin, Node 24)
- Migration manquante `Stock.substrat_type` ; credentials MySQL manquants dans les 3 docker-compose
- Coquille "bocalx" â†’ "bocaux"

---

## [1.0.0] â€” 2026-05-07

PremiÃ¨re version stable. Audit complet et correction de tous les bugs latents avant release.

### CorrigÃ©

- Page Recettes Arrosage orpheline : route `/recettes/arrosage` ajoutÃ©e dans App.tsx et entrÃ©e nav ajoutÃ©e dans Layout.tsx (page, API, backend et modal existaient mais n'Ã©taient pas accessibles via l'UI)
- Label nav trompeur : `/recettes/schemas-engrais` Ã©tait affichÃ© "Arrosages" â€” renommÃ© en "SchÃ©mas d'engrais"
- Suppression de 3 `print()` de debug laissÃ©s dans `croisement.py` et `graines.py`
- Variable morte `thumb_path_rel` supprimÃ©e dans `photos.py` (bloc `except` de l'upload)

---

## [0.1.0] â€” 2026-05-07

Version initiale publique. MVP complet avec toutes les features V3.

### AjoutÃ©

#### Cultures & Plantes
- Cycle de vie complet des cultures : active â†’ sÃ©chage/curing â†’ terminÃ©e
- Cycle de vie des plantes : germination â†’ vÃ©g â†’ floraison â†’ sÃ©chage â†’ curing â†’ prÃªte/rÃ©coltÃ©e/abandonnÃ©e
- Statut WPFF (Whole Plant Fresh Frozen) : congÃ©lateur direct depuis l'onglet SÃ©chage
- Calendrier des actions avec calcul d'intensitÃ© lampe par phase (dimmer par lampe)
- Galerie photos par culture/plante (upload, compression Pillow, lightbox, suppression)
- CoÃ»ts de culture : Ã©lectricitÃ© (par phase, par lampe), engrais, graines â€” total et â‚¬/g
- Historique des cultures avec dÃ©composition des coÃ»ts en popup

#### SÃ©chage & Curing
- Sessions de sÃ©chage et curing indÃ©pendantes
- Ouverture de bocaux en masse (sÃ©lection multiple, burping status, date + durÃ©e)
- Onglet "En curing" sur la page Stock avec carte total poids et tableau plantes

#### Stock & Extractions
- Gestion du stock (Fleur, Hash, Rosin, Trim, WPFF, PoussiÃ¨re)
- Extractions rosin et hash
- Lampe liÃ©e au stock depuis le matÃ©riel rÃ©el (plus de liste statique)

#### GÃ©nÃ©tique & Croisements
- Page Croisement : crÃ©ation, modification (modal prÃ©-rempli), statuts
- Stock pollen avec colonnes triables (6 colonnes, tri asc/desc)
- Fix icÃ´ne statut croisement (fallback statut inconnu)

#### Consommation
- Sessions de consommation avec dÃ©duction de stock
- Modal 3 Ã©tapes : type â†’ stock/variÃ©tÃ© â†’ quantitÃ© avec jauge visuelle
- Stats : totaux par pÃ©riode, graphique 7j, rÃ©partition type/vapo, projection stock

#### Classement & Notation
- Classement des variÃ©tÃ©s avec scores Culture/Conso
- SystÃ¨me de notation /100

#### MatÃ©riel & Vaporisateurs
- Inventaire vaporisateurs + consommables
- Sessions vapo avec dÃ©duction automatique du stock
- Champs marque et fournisseur depuis les listes partagÃ©es

#### Infrastructure
- DÃ©ploiement Docker multi-plateforme (Linux + Windows) via `docker-compose.server.yml`
- Frontend en multi-stage build (Node â†’ nginx:alpine)
- Proxy nginx pour SPA routing, `/api/` et `/uploads/`
- Support PWA (manifest + auto-update)
- Versioning Git avec workflow `push.bat` + `_commit_msg.txt`

### CorrigÃ©

- Nommage des plantes : `<variÃ©tÃ©> #<id_graine>` (Ã©tait basÃ© sur le compteur de boucle)
- Audit complet : 2 erreurs bloquantes backend (Python) + 11 bugs TypeScript sÃ©rieux
- Affichage et suppression photos (proxy `/uploads/` manquant dans nginx et Vite)
- Crash React sur la page Consommation (`.data` manquant sur `stockAPI.getAll()`)

---

<!-- Liens de comparaison (Ã  renseigner avec l'URL GitHub) -->
[Unreleased]: https://github.com/mdf73/growmanager/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mdf73/growmanager/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/mdf73/growmanager/releases/tag/v0.1.0
