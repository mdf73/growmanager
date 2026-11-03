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

## [3.16.0] - 2026-11-03

### Ajouté
- **Calendrier global, température / humidité / VPD du mois** : nouveau bloc sous les stats. Moyennes calées sur les horaires de la lampe (action « Horaires de la lampe », dernier horaire en vigueur chaque jour, par espace du capteur) : une période jour (lampe allumée) et une période nuit, coupées en deux au-delà de 12 h. Repli 0h-12h / 12h-24h sans horaire saisi. Résumé jour / nuit par capteur, courbes avec point plein (jour) ou creux (nuit).

### Corrigé
- **Calendrier global, compteurs** : une même action le même jour sur une culture compte pour un événement, quel que soit le nombre de plantes. « Arrosages » et « Traitements » comptent les jours (par culture). Fenêtre du jour : nombre d'événements recalculé, « N plantes » au lieu de « N events ». Cases : plus de « ×N » (nombre de plantes au survol).
- **Calendrier global, libellés** : les actions de lampe (horaires, durée d'éclairage, intensité…) s'affichent avec leur nom et leur icône au lieu du code brut.

---

## [3.15.0] - 2026-11-03

### Ajouté
- **Actions de culture, cible multi-plantes** : comme pour les arrosages, la cible se choisit avec des boutons « Espace uniquement », « Toutes les plantes » ou plante par plante (sélection multiple). Une action est créée pour chaque plante cochée. Les actions qui exigent un statut (ex. fin de séchage) n'apparaissent que si toutes les plantes cochées ont ce statut.
- **Photos dans le calendrier** : une photo ajoutée depuis la galerie crée automatiquement l'action 📷 du jour (une seule par plante ou par culture et par jour, avec le nombre de photos). Elle disparaît quand toutes les photos du jour sont supprimées.

### Modifié
- **Ajouter une action** : le type Photo est retiré de la modale, les photos passent uniquement par la galerie.

### Corrigé
- **Mode autonome (APK), stats d'arrosage** : même logique que le serveur depuis la 3.14.3 (un arrosage = une journée, volumes en litres, préparation TCO exclue).

---

## [3.14.3] - 2026-11-03

### Corrigé
- **Statistiques de culture, arrosages** : un arrosage correspond maintenant à une journée. Les actions du même jour (une par plante ou une globale) sont regroupées et leurs volumes additionnés. La préparation de TCO n'est plus comptée comme un arrosage. La case affiche « Jours d'arrosage » et le volume total en litres.
- **Graphique des arrosages** : volumes en litres, une barre par jour, dates au format JJ/MM, barres empilées par type (eau, engrais, TCO), moyenne par arrosage, infobulle avec le détail et le nombre de plantes arrosées.

---

## [3.14.2] - 2026-11-01

### Corrigé
- **Calendrier de suivi de culture** : chaque icône porte désormais un trait de la couleur de sa catégorie, ce qui rend la légende lisible. Les actions identiques d'un même jour sont regroupées (« 🥛 ×20 »). Catégorie Photo ajoutée à la légende. Cases vides de début et fin de mois correctement sombres en mode nuit.
- **Récoltes prévues dans le calendrier** : la fenêtre de récolte s'affiche maintenant même sans « Début floraison » saisi sur chaque plante (repli sur la date de floraison ou de passage 12/12 de la culture, comme le bandeau). Affichage d'une ligne par variété au lieu d'une ligne par plante, encadré « Récoltes prévues » regroupé par variété avec un message explicite quand aucune floraison n'est encore saisie.

---

## [3.14.1] - 2026-10-30

### Corrigé
- **PPFD / DLI (onglet Stats d'une culture)** : le calcul prend désormais en compte l'intensité de la lampe. La puissance utilisée est la puissance de la lampe multipliée par le dernier réglage dimmer enregistré (100 % si aucun réglage). La case Lampe affiche le détail (« 165 W · 30 % de 550 W »).

---

## [3.14.0] - 2026-10-28

### Ajouté
- **Nouvelle catégorie d'actions « Training & Taille »** (vert émeraude) : Mise en place SOG (plantes/m²), Mise en place SCROG (hauteur du filet, taille de maille), Passage dans le filet SCROG, LST / Palissage (nombre d'attaches), HST, Super cropping (tiges pliées), Mainlining / Manifold (têtes visées), FIM, Lollipopping, Schwazzing, Tuteurage / Yoyo.
- **Échelle d'intensité commune** Légère / Normale / Forte / Intense sur toutes les actions de training et de taille (sauf Mise en place du filet).

### Modifié
- Défoliation, Étêtage, Pinçage et Mise en place du filet déplacés de « Mesures & Soins » vers « Training & Taille ». L'ancienne intensité `lourde` de la défoliation s'affiche « Forte ».
- Détail d'un jour du calendrier de culture : paramètres affichés lisiblement (« Intensité : Forte · Hauteur du filet : 30 cm ») au lieu des codes bruts. Légende du calendrier avec les vrais noms de catégories.
- Calendrier global, export PDF du calendrier et rapport PDF de culture : libellés et emojis des nouvelles actions.

### Modifié
- **Google Play : lancement du test fermé** (version 3.13.0 promue depuis le test interne, France) et envoi de la fiche Store et des déclarations à l'examen. Documentation dans le wiki (`features/mobile-app.md`).

---

## [3.13.4] - 2026-10-24

### Ajouté
- **Captures d'écran de la fiche Google Play** (8 écrans, recadrés en 1080×2116 pour respecter le ratio 2:1 maximum) dans `docs/play-store/captures/`.

---

## [3.13.3] - 2026-10-24

### Ajouté
- **Visuels de la fiche Google Play** (icône 512 px et bannière 1024×500) dans `docs/play-store/`, et ancre « suppression des données » dans la politique de confidentialité.

---

## [3.13.2] - 2026-10-24

### Ajouté
- **Politique de confidentialité publique** pour la fiche Google Play : page `docs/privacy/index.html`, publiée via GitHub Pages à l'adresse https://mdf73.github.io/growmanager/privacy/ (aucun compte, aucune publicité, aucun traceur, données sur le téléphone ou sur le serveur de l'utilisateur).

---

## [3.13.1] - 2026-10-23

### Corrigé
- **Panneaux « Origine du stock » et « Origine du bocal » décalés vers le bas** (surtout visible sur Android) : le panneau descendait de 24 px, on voyait le menu de l'appli au-dessus et les boutons Modifier / Supprimer étaient coupés par la barre de navigation du téléphone. Les deux panneaux s'affichent maintenant en plein écran au-dessus de toute l'appli.

---

## [3.13.0] - 2026-10-23

### Ajouté
- **Boutons Modifier et Supprimer en bas de la fiche d'un stock** (appli Android et version PC) : quand on touche une ligne de stock, le panneau « Origine du stock » affiche maintenant en bas, sous les cultures, une barre fixe avec « Modifier » (ouvre le formulaire d'édition) et « Supprimer » (avec confirmation). Plus besoin de faire défiler le tableau vers la droite pour atteindre les petits boutons de la ligne, qui restent disponibles.

---

## [3.12.0] - 2026-10-23

### Ajouté
- **Sauvegarde et restauration en mode autonome** : l'onglet « Sauvegarde et restaurations » du Paramétrage est maintenant disponible dans l'app sans serveur. Le bouton crée un fichier `.zip` avec toutes les données du téléphone (cultures, stocks, recettes, paramétrage…) et, au choix, les photos. La restauration contrôle le fichier avant de toucher aux données et remplace tout d'un seul bloc : en cas d'erreur, rien n'est modifié. À copier hors du téléphone (Drive, ordinateur) pour ne rien perdre en cas de perte ou de changement d'appareil. Le mode serveur garde sa sauvegarde `.sql`.

---

## [3.11.2] - 2026-10-23

### Corrigé
- **Erreur au démarrage du serveur après une mise à jour qui ajoute une table** : les 2 processus du backend tentaient de créer la table en même temps, l'un des deux plantait (« Table already exists ») puis redémarrait. La base est maintenant préparée une seule fois (tables, migrations, valeurs par défaut) avant le lancement des 2 processus. Aucune action requise : effectif au prochain `update.sh`.

---

## [3.11.1] - 2026-10-21

### Corrigé
- **Vue « Groupé » de la page Matériel** : les items sont désormais regroupés par nom de base (tout ce qui précède le « # », ex. « Bocal 1L Weck #1 / #2 / #12 » → un seul groupe « Bocal 1L Weck »), sans tenir compte de la casse. Auparavant chaque item formait son propre groupe. Groupes triés alphabétiquement, items en ordre naturel (#2 avant #10), mêmes colonnes triables qu'en vue liste, marques du groupe affichées. La suppression depuis un groupe demande maintenant une confirmation.

### Ajouté
- **Pagination de la page Matériel** : 25 lignes par défaut (25 / 50 / 100 / Tout), choix mémorisé dans le navigateur. En vue groupée, la pagination porte sur les groupes. Retour en page 1 à chaque changement de filtre, recherche, tri ou vue. L'onglet Matériel n'attend plus le chargement des vaporisateurs (et inversement).

---

## [3.11.0] - 2026-10-18

### Ajouté
- **Bouton « Enracinement échoué » sur les boutures** : dans l'onglet Plantes du suivi de culture, un clone (ou une bouture externe) en attente d'enracinement affiche désormais un bouton « Enracinement échoué » à côté de « Valider l'enracinement », avec confirmation. La plante passe en « Abandonnée » avec le badge « N'a pas pris » et reste comptée comme bouture ratée pour les statistiques d'enracinement. Cette option n'était jusqu'ici accessible qu'à la création du clone ou dans le panneau caché de validation.

---

## [3.10.2] - 2026-10-18

### Corrigé
- **Volumes d'arrosage au millilitre** : les champs de volume de l'arrosage (eau pure, engrais via recette, volume utilisé, TCO) acceptent désormais n'importe quelle valeur jusqu'au millilitre (ex. 0.2 L, 0.001 L). Ils étaient bloqués sur des multiples de 0,5 L.

---

## [3.10.1] - 2026-10-18

### Corrigé
- **Tuile « En croissance » toujours vide** (3.10.0) : la date de début de croissance était filtrée par le serveur avant d'arriver à la page. Elle est maintenant transmise, avec repli sur l'action « Début croissance » du calendrier si la date n'est pas enregistrée sur la culture.

---

## [3.10.0] - 2026-10-18

### Ajouté
- **Tuile « En croissance » sur la page de suivi de culture** : nombre de jours depuis le passage en croissance (action « Début croissance »). Le compteur avance tant que la culture n'est pas en floraison, puis s'arrête au passage en floraison et affiche la durée totale de croissance.

---

## [3.9.0] - 2026-10-13

### Modifié
- **Toutes les listes paramétrables triées par ordre alphabétique** (listes déroulantes de l'application et écran Paramétrage, serveur et mode local) : tri français insensible à la casse et aux accents, nombres dans l'ordre naturel (15µ avant 110µ). Les listes à ordre logique (périodes de recette, états du matériel) suivent aussi le tri alphabétique, choix validé.

---

## [3.8.1] - 2026-10-13

### Corrigé
- **Valeurs en double dans les listes paramétrables** (catégories et états du matériel, listes vapo) après le déploiement de la 3.8.0 : les 2 workers du backend remplissaient en parallèle les nouvelles listes vides. Doublons supprimés automatiquement au démarrage, index unique `(liste_nom, valeur)` et seed en `INSERT IGNORE` pour empêcher toute récidive. Ajout ou renommage vers une valeur existante : message « Cette valeur existe déjà » (409) au lieu d'une erreur serveur.

---

## [3.8.0] - 2026-10-13

### Ajouté
- **Listes déroulantes du Matériel entièrement paramétrables** (Paramétrage, sections « Matériel — Général » et « Matériel — Vaporisateurs ») : catégories de matériel, états, et pour les vaporisateurs type de chauffe, type de batterie, type de charge, compatibilités, types et matières de consommable. Bouton ➕ d'ajout inline dans les formulaires (backend + mode local).
- **Catégories de matériel personnalisées** : les 11 catégories de base sont verrouillées 🔒 (ni renommables ni supprimables, contrôle backend + mode local) ; une catégorie ajoutée n'a que les champs communs.
- **Session vapo** : les types de produit proposés viennent de la liste `types_stock` (même référentiel que le Stock).

### Modifié
- **Compatibilités vapo** stockées en libellés au lieu de clés techniques ; migration automatique des vapos existants au démarrage (backend + mode local).
- Les filtres Catégorie et État de la page Matériel suivent les listes paramétrables.

### Corrigé
- **Vaporisateur** : la température min / max n'est plus plafonnée à 300 °C dans le formulaire.

---

## [3.7.1] - 2026-10-11

### Corrigé
- **Boutures non enracinées affichées « Germination »** : elles affichent maintenant l'étiquette « Enracinement ✂️ » (clones maison et boutures externes).
- **Bouton d'enracinement introuvable** : la petite icône jaune est remplacée par un bouton « Valider l'enracinement » à côté du badge « En attente d'enracinement ». Une bouture externe sans statut d'enracinement enregistré est aussi considérée en attente.
- **Bouture enracinée restée en « Germination »** : la validation de l'enracinement la passe automatiquement en Végétation (backend + mode local).
- **Durée de floraison affichée « sem »** sur la carte de plante alors que la valeur est en jours.

---

## [3.7.0] - 2026-10-11

### Ajouté
- **Boutures externes** : nouveau type « Bouture (clone) » dans le formulaire de pack (page Graines & boutures). Le lot se choisit ensuite comme une graine, à la création d'une culture ou via « Ajouter une plante » dans une culture existante. La plante est créée avec l'origine `bouture`, en attente d'enracinement (même suivi enraciné / raté que les clones maison). Exclue du taux de germination et du coût moyen par graine. Filtre « Bouture » sur la page Graines.
- **Floraison en jours ou en semaines** dans le formulaire de pack (stockage toujours en jours, conversion affichée).
- **Fenêtre Nouveau stock** : la liste des variétés est triée et affiche le ou les breeders (déduits des packs).

### Corrigé
- **Doublons breeders / variétés** : la création d'un nom déjà existant (casse et espaces ignorés) renvoie l'existant au lieu de créer un doublon (backend + mode local).
- **Ajout d'une plante depuis un pack dans une culture existante** : la graine n'était pas marquée comme utilisée et restait disponible dans le stock.
- **Durée de floraison affichée en « sem »** alors que la valeur est en jours (sélecteurs de graines de la nouvelle culture et de l'onglet Plantes).

---

## [3.6.6] - 2026-10-07

*(prochaines modifications en cours)*

---

## [3.6.5] - 2026-10-07

*(prochaines modifications en cours)*

---

## [3.6.4] - 2026-10-07

*(prochaines modifications en cours)*

---

## [3.6.3] - 2026-10-07

*(prochaines modifications en cours)*

---

## [3.6.2] - 2026-10-03

### Corrigé
- Build Docker du frontend en échec en 3.6.1 (`npm ci` : `readdirp@3.6.1` introuvable). `version-bump.ps1` remplaçait **tous** les `"version": "<ancienne>"` du `package-lock.json`, y compris des dépendances de même numéro (chokidar, readdirp). Remplacement limité aux 2 occurrences de l'app (racine du lockfile) et lockfile restauré

---

## [3.6.1] - 2026-10-03

*(prochaines modifications en cours)*

---

## [3.6.0] - 2026-10-02

### Ajouté
- Classement des variétés entièrement refait : une ligne par variété produite, avec rendement par pied selon la taille du pot (hydro à part), rendement rosin et hash cumulés (total extrait / total utilisé), taux de germination des graines (germées / semées)
- Notes sur 5 étoiles : goût, odeur, texture, facilité d'extraction ; tri par défaut sur leur moyenne, toutes les colonnes triables
- Export CSV du classement complet (stats + notes)
- L'action « Graine morte » passe la plante en abandonnée et la compte comme graine morte dans le taux de germination

### Modifié
- Les anciennes notations sur 100 (7 critères) sont supprimées ; les fiches existantes gardent breeder, données labo et notes générales
- Les archives de cultures sont reliées à leur culture d'origine (`HistoriqueCulture.id_culture`) pour ne pas compter deux fois les récoltes
- Build APK Android : APK signé avec la clé fixe (si secrets keystore configurés) et versionCode/versionName dérivés de `package.json` → mises à jour installables par-dessus sans désinstaller ; repli APK debug sinon

---

## [3.5.4] - 2026-10-01

### Corrigé
- Photos d'une culture : le sélecteur « Associer à » ne propose plus les plantes mortes (statut `abandonne`, via l'action « Décès plante ») ; les plantes récoltées sont regroupées à part sous « Récoltées »
- Page culture : l'onglet affiche « Plantes (actives/total) » dès qu'une plante n'est plus active, et l'en-tête de l'onglet Plantes affiche « X actives · Y terminées » au lieu du total brut

---

## [3.5.3] - 2026-10-01

### Corrigé
- App Android (mode serveur) : l'ajout de photos dans une culture ne faisait rien. Les appels `axios` globaux en URL relative (`/api/...`, `/uploads/...`) pointaient vers l'app elle-même au lieu du serveur distant ; ils sont désormais préfixés par l'URL serveur (corrige aussi historique des cultures, matériel, paramètres, réglages app)
- Galerie photos : les erreurs d'upload sont affichées (413, erreur serveur, réseau) au lieu d'être ignorées ; la même photo peut être resélectionnée après un échec
- Page culture sur mobile : les boutons Dates / Changer d'espace / PDF / Clôturer passent sous le titre au lieu de se superposer à lui

---

## [3.5.2] - 2026-09-16

### Corrigé
- Arrosages illisibles en mode nuit dans le panneau "Suivi de culture" (carte sans variante `dark:` sur fond/bordure, texte clair sur fond clair)

---

## [3.5.1] - 2026-09-16

*(prochaines modifications en cours)*

---

## [3.5.0] - 2026-09-16

*(prochaines modifications en cours)*

---

## [3.4.11] - 2026-09-16

*(prochaines modifications en cours)*

---

## [3.4.10] - 2026-09-13

### Ajouté
- Intégration capteurs Tapo T310/T315 via hub H100 local (configuration, découverte, polling automatique 5 min, historique VPD partagé avec Govee/ESPHome). PR externe #5.

---

## [3.4.9] - 2026-09-12

*(prochaines modifications en cours)*

---

## [3.4.8] - 2026-09-12

*(prochaines modifications en cours)*

---

## [3.4.7] - 2026-09-12

*(prochaines modifications en cours)*

---

## [3.4.6] - 2026-09-12

### Corrigé
- CI : le workflow `docker-publish.yml` ne publiait jamais le tag `:latest` sur GHCR (seulement `main` et `sha-xxxxx`), ce qui faisait échouer `update.sh latest` en prod (`manifest unknown`). Ajout de `flavor: latest=true` sur les jobs backend et frontend.

---

## [3.4.5] - 2026-09-12

*(prochaines modifications en cours)*

---

## [3.4.4] - 2026-07-16

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
