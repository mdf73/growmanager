---
type: feature
status: chantier 1 livré (validé 2026-11-04), chantier 2 abandonné
updated: 2026-11-04
sources: [backend/app/routers/parametre.py, backend/app/db_init.py, frontend/src/local/seeds.ts, frontend/src/local/db.ts, frontend/src/pages/Parametrage.tsx, backend/app/models/all_models.py]
---

# Données standard pré-remplies (listes paramétrables, breeders, variétés)

**Pourquoi** : un nouvel utilisateur (testeurs Play, futur public) arrive aujourd'hui sur des listes génériques ou vides (Marques vide, fournisseurs génériques, aucun breeder). Pik veut que ses propres valeurs, construites à l'usage, deviennent le **standard** livré à tout le monde, et qu'un catalogue de breeders soit fourni.

**Statut** : chantier 1 (listes de Paramétrage + fournisseurs des packs) livré et validé par Pik le 2026-11-04, voir section 4bis. Chantier 2 (breeders) abandonné le 2026-11-04, voir section 5. ADR associé : [[architecture/decisions#ADR-011 : Données standard pré-remplies (2026-10-30)|ADR-011]].

---

## 1. Décisions de Pik (2026-10-30, révisées 2026-11-01)

1. Les données standard sont **réellement insérées en base**, pour tout le monde, et livrées **par les mises à jour de l'app** (APK Play en mode autonome, image Docker en mode serveur) : le JSON du standard est embarqué dans chaque version.
2. **Rien n'est jamais écrasé** : aucune donnée saisie par l'utilisateur n'est modifiée ni supprimée.
3. **Démarrage vide** (révision 2026-11-01) : à l'installation, aucune liste de Paramétrage n'est remplie. Seules exceptions : les **valeurs utilisées par le code**, sous cadenas (ADR-009), toujours présentes : catégories de matériel de base (déjà le cas) et **types de stock `Fleur`, `Trim`, `WPFF`, `Hash`, `Rosin`** (nouveau verrouillage). Les réglages techniques invisibles (AppSettings, seuils d'alerte stock, emplacements de culture) restent créés automatiquement.
4. **Bouton global + bouton par catégorie** dans Paramétrage pour charger le standard. Ils réajoutent toutes les valeurs standard absentes, y compris celles que l'utilisateur avait supprimées. Aucun suivi des suppressions, rien d'automatique à la mise à jour.
5. **Vérification avant insertion** : une valeur dont le nom existe déjà (insensible casse, accents, espaces) n'est pas réinsérée. Bouton idempotent. Un doublon résiduel (variante d'orthographe) reste acceptable.
6. **Variétés : rien.** Le chantier 2 se limite aux breeders.
7. **Fournisseurs des packs de graines : option A.** La liste déroulante du pack lit la liste paramétrable `fournisseurs` ; au choix d'un nom, la ligne de la table `Fournisseur` est retrouvée ou créée en coulisse (FK `PackGraine.id_fournisseur` conservée). Reprise unique des noms existants de la table `Fournisseur` vers la liste.
8. Message « Liste vide : chargez les valeurs standard dans Paramétrage » sous les listes vides : proposé, non retenu pour l'instant.

## 2. État actuel (constat code 2026-10-30)

- Les valeurs par défaut existent déjà, mais **en double** : `LISTE_DEFAULTS` dans `backend/app/routers/parametre.py` (mode serveur) et une copie dans `frontend/src/local/seeds.ts` (mode autonome). Risque de divergence à chaque modification.
- Le seed ne remplit une liste **que si elle est vide** (`count == 0`). Conséquence : modifier les valeurs par défaut n'a **aucun effet** sur une installation existante dont la liste contient déjà au moins une valeur. Les testeurs actuels ne recevraient rien.
- Seule exception : les valeurs verrouillées (ADR-009), ré-insérées si absentes.
- Les valeurs du code ne sont pas celles de Pik : c'est sa base de prod qui contient le vrai standard.
- `marques` est vide par défaut. Il existe aussi des tables `Marque` et `Fournisseur` (le pack de graines utilise la table `Fournisseur`, le matériel et les engrais utilisent la liste `fournisseurs` / `marques`). À clarifier lors du chantier 1 : quelle source pré-remplir pour les fournisseurs de graines.
- Breeders : table `Breeder` (nom, origine, information). Variétés : table `Variete` **sans lien direct vers un breeder** (le lien passe par `Graine`). Un contrôle de doublons breeders / variétés existe depuis le 2026-10-11.

## 3. Mécanisme commun : boutons dans Paramétrage

Principe valable pour les deux chantiers et les deux modes (serveur et autonome).

- **Une seule source** : fichiers JSON partagés (ex. `shared/seeds/parametres.json`, `shared/seeds/breeders.json`) lus par le backend Python ET embarqués dans l'APK. Fin de la double maintenance `LISTE_DEFAULTS` (`parametre.py` + `local/seeds.ts`).
- **Démarrage** : suppression du remplissage automatique des listes (règle actuelle « liste vide = remplie à chaque démarrage »). Restent automatiques : valeurs verrouillées (ADR-009, étendu aux 5 types de stock) et réglages techniques.
- **Boutons « Charger les valeurs standard »** : un global en haut de Paramétrage, un par section (catégorie) de Paramétrage ; pour les breeders, un bouton dédié. Insère toutes les valeurs standard absentes, idempotent, retour « N valeurs ajoutées ».
- **Jamais d'UPDATE ni de DELETE**, uniquement des INSERT.
- **Comparaison des noms** : normalisation commune (minuscules, sans accents, espaces rognés), en Python et en TS. Côté serveur, l'index unique MySQL des listes fait déjà ce travail ; côté autonome, le contrôle de `local/handlers/parametres.ts` compare au caractère près et doit être aligné. Pour les breeders, comparaison via la normalisation.
- **Installations existantes** : rien ne change, leurs valeurs restent.

## 4. Chantier 1 : listes de Paramétrage

Périmètre demandé par Pik : toutes les listes de la page Paramétrage reprennent ses valeurs actuelles.

| Section Paramétrage | Listes |
|---|---|
| Général | `marques`, `fournisseurs` |
| Matériel : Général | `materiel_categories` (base verrouillée + ses ajouts), `etats_materiel` |
| Matériel : Vaporisateurs | `vapo_types_chauffe`, `vapo_types_batterie`, `vapo_types_charge`, `vapo_compatibilites`, `vapo_conso_types`, `vapo_conso_matieres` |
| Matériel : Lampes | `lampes_types`, `spectres` |
| Matériel : Pots & Bocaux | `pot_matieres`, `bocal_fermetures`, `bocal_couleurs`, `bocal_usages` |
| Matériel : Équipements | `arrosage_types`, `pompe_types`, `ventilation_types`, `filet_types`, `sechage_types`, `outil_types` |
| Stock : Types | `types_stock`, `sous_types_stock` |
| Stock : Hash & Rosin | `types_hash`, `types_rosin` |
| Stock : Maillages | `maillages_polinator`, `maillages_iceolator`, `maillages_rosin` |
| Espaces de culture | `types_espace`, `types_culture`, `buts_culture` |
| Préparer un substrat | `types_sol_preparation` |
| Historique Culture | `tentes`, `lampes_hc`, `puissances_hc`, `engrais`, `substrats` |
| Recettes | `periodes_recette`, `types_lso`, `types_fermentation` |

Étapes :

| Étape | Contenu |
|---|---|
| C1.1 | **Extraction** des valeurs de la base de prod de Pik : `SELECT liste_nom, valeur, ordre FROM ParametreListeValeur ORDER BY liste_nom, ordre;` (ou export JSON existant) |
| C1.2 | **Revue avec Pik** : retirer ce qui est purement personnel (ex. noms complets de ses lampes dans `lampes_hc`, formats de ses tentes, puissances précises) ou le généraliser. Décider pour `lampes_stock` (non affichée dans Paramétrage). |
| C1.3 | Création de `shared/seeds/parametres.json` (version 1 = standard actuel du code + valeurs de Pik), suppression des deux copies `LISTE_DEFAULTS`. `LISTES_VERROUILLEES` reste dans le code (ADR-009). |
| C1.4 | Retrait du remplissage automatique des listes, verrouillage des 5 types de stock, endpoint « charger le standard » (global et par section) côté backend Python et côté backend local TS, normalisation commune, alignement du contrôle de doublon autonome. Tests : base neuve vide (hors verrouillées), base existante partielle, valeur supprimée puis bouton, doublon casse/accents, bouton pressé deux fois. |
| C1.5 | Boutons « Charger les valeurs standard » dans Paramétrage (global + par section) avec compteur de valeurs ajoutées. |
| C1.5b | Fournisseurs des packs (option A) : `NouveauPackModal` lit la liste `fournisseurs`, find-or-create dans la table `Fournisseur` (serveur + autonome) ; reprise unique des noms existants de la table `Fournisseur` vers la liste. |
| C1.6 | Livraison : nouvelle version APK + image Docker. Test par Pik sur une installation existante (rien d'écrasé, bouton qui ajoute les nouveautés) et sur une installation neuve. |

## 4bis. Chantier 1 : réalisation (validé 2026-11-04)

**Standard** : `frontend/src/data/standard-parametres.json` (version 1, 42 listes, 261 valeurs), seule source pour les deux modes. Le serveur ne le lit pas : le frontend envoie les valeurs au clic. Construit depuis la base de prod de Pik (export du 2026-11-01) avec ses arbitrages : fournisseurs sans adresse mail perso ni magasin local ni SuperU, fusion des fournisseurs de packs (`aristodeseedco.fr`, `saltonverde.com` ; `alchimia.com` écarté au profit de `alchimia.fr` ; `cannaweed` laissé hors standard faute de réponse), engrais `Living Soil (LSO)` générique + `Autre`, puissances génériques 100 à 1000 W, `lampes_stock` exclue, orthographe corrigée (Li-ion, Pierre à bulles, Filtre à charbon, Cspec Enhanced, 3500K...), valeurs du code supprimées par Pik non reprises. Liste `carences` ajoutée avec ses valeurs du code.

**Code** :
- Backend `routers/parametre.py` : `LISTE_DEFAULTS` supprimé, `LISTES_VERROUILLEES` étendu à `types_stock`, `normaliser()`, `charger_valeurs()`, `migrer_fournisseurs_vers_liste()` (une fois, drapeau `AppSettings.migr_fournisseurs_liste`, appelée dans `db_init.seed_parametres`), endpoint `POST /api/parametres/_standard/charger`. `LISTES_TECHNIQUES = {"govee_config"}` jamais touchée.
- Mode autonome `local/seeds.ts` : mêmes fonctions (`chargerValeurs(conn, listes)`, migration fournisseurs), route locale dans `local/handlers/parametres.ts`, contrôle de doublon normalisé sur l'ajout.
- Frontend : `api/parametres.ts` (`STANDARD_LISTES`, `normaliserValeur`, `parametresAPI.chargerStandard`), `Parametrage.tsx` (`ChargerStandardButton` global + par section), `NouveauPackModal.tsx` (fournisseur via `SelectWithAdd` sur la liste `fournisseurs`, id de la table `Fournisseur` retrouvé ou créé à l'enregistrement).

**Vérifié** : tsc OK ; scripts de test ad hoc serveur (SQLite) et autonome (sql.js) : démarrage vide, valeurs verrouillées, pas de doublon casse/accents, idempotence, valeur supprimée qui revient, `govee_config` intouchée, migration fournisseurs unique.

**Attention pour une base existante** : une correction d'orthographe qui ne se réduit pas à la casse ou aux accents (`Pierre a bulle` / `Pierre à bulles`, `Li-On` / `Li-ion`, `3500 K` / `3500K`) crée un doublon au chargement : corriger la valeur avant d'appuyer.

## 5. Chantier 2 : breeders, puis variétés

> **Abandonné le 2026-11-04 (décision Pik).** Un catalogue de 178 breeders avait été préparé avec un bouton dédié ; Pik l'a jugé bien trop grand : un grower amateur n'aura jamais tous ces breeders dans son catalogue. Code retiré, rien n'a été livré. Les utilisateurs saisissent leurs breeders (contrôle de doublon existant à la création). La section ci-dessous est conservée pour mémoire.

### 2a. Breeders (recommandé)

- Catalogue large des breeders connus : Pays-Bas, Espagne, États-Unis, France, Allemagne, Italie, plus les grands noms d'autres pays (Canada, Royaume-Uni, Suisse...). Ordre de grandeur visé : 200 à 400.
- Champs remplis : `nom_breeder`, `origine_breeder` = pays, `information_breeder` = courte description (ville, spécialité, actif ou disparu).
- Les breeders disparus sont gardés : leurs génétiques circulent toujours.
- Étapes : constitution de la liste par recherche (sites des breeders, Seedfinder, banques de graines), revue par Pik, `shared/seeds/breeders.json`, insertion via le même mécanisme (bouton, vérification par nom normalisé).

### 2b. Variétés : écarté (décision Pik 2026-10-30)

Pas de variétés pré-remplies. Raisons : même nom chez plusieurs breeders alors que `Variete` n'a pas de lien direct vers un breeder, pollution des écrans de l'utilisateur (graines, stock, classement, recherche), catalogue qui se périme vite. Les utilisateurs saisissent leurs variétés.

## 6. Liens avec les autres chantiers

- **Multilingue** ([[features/i18n]], sprint I2) : le JSON du standard devra exister par langue pour les valeurs libres (`parametres.fr.json`, `parametres.en.json`...) ; la langue choisie au premier lancement détermine le fichier utilisé. Les noms de breeders ne se traduisent pas. Faire le chantier 1 avant I2 simplifie I2.
- **Mode autonome** ([[features/mobile-standalone]]) : une mise à jour Play livre le nouveau JSON, le bouton l'applique.
- **Valeurs verrouillées** : ADR-009 inchangé.

## 7. Points tranchés

Tous tranchés par Pik le 2026-10-30, voir section 1. Écartés : seed versionné automatique à chaque mise à jour, standard complet à la première installation (révision 2026-11-01 : démarrage vide + boutons), insertion sans vérification (créerait des doublons à chaque appui sur le bouton), pré-remplissage des variétés, option B fournisseurs (FK remplacée par du texte, trop lourde).
