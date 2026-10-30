---
type: feature
status: planifié (plan validé 2026-10-30, non lancé)
updated: 2026-10-30
sources: [backend/app/routers/parametre.py, backend/app/db_init.py, frontend/src/local/seeds.ts, frontend/src/local/db.ts, frontend/src/pages/Parametrage.tsx, backend/app/models/all_models.py]
---

# Données standard pré-remplies (listes paramétrables, breeders, variétés)

**Pourquoi** : un nouvel utilisateur (testeurs Play, futur public) arrive aujourd'hui sur des listes génériques ou vides (Marques vide, fournisseurs génériques, aucun breeder). Pik veut que ses propres valeurs, construites à l'usage, deviennent le **standard** livré à tout le monde, et qu'un catalogue de breeders soit fourni.

**Statut** : plan validé par Pik le 2026-10-30 (toutes les décisions sont prises, section 1), rien n'est lancé. ADR associé : [[architecture/decisions#ADR-011 : Données standard pré-remplies (2026-10-30)|ADR-011]].

---

## 1. Décisions de Pik (2026-10-30)

1. Les données standard sont **réellement insérées en base**, pour tout le monde, et livrées **par les mises à jour de l'app** (APK Play en mode autonome, image Docker en mode serveur).
2. **Rien n'est jamais écrasé** : aucune donnée saisie par l'utilisateur (valeur de liste, breeder, quelle qu'elle soit) n'est modifiée ni supprimée.
3. **Vérification avant insertion** : une valeur dont le nom existe déjà (insensible casse, accents, espaces) n'est pas réinsérée. Obligatoire puisque le bouton peut être pressé plusieurs fois. Un doublon résiduel (variante d'orthographe) reste acceptable.
4. **Rien d'automatique à la mise à jour** : le standard complet est inséré à la **première installation** uniquement ; ensuite, seul le **bouton « Compléter avec les valeurs standard »** de Paramétrage ajoute des valeurs.
5. **Le bouton réajoute toutes les valeurs standard absentes**, y compris celles que l'utilisateur avait supprimées. Aucun suivi des suppressions.
6. **Variétés : rien.** Le chantier 2 se limite aux breeders.
7. **Fournisseurs des packs de graines : option A.** La liste déroulante du pack lit la liste paramétrable `fournisseurs` ; au choix d'un nom, la ligne de la table `Fournisseur` est retrouvée ou créée en coulisse (FK `PackGraine.id_fournisseur` conservée, stats, prix-graine et CSV inchangés).

## 2. État actuel (constat code 2026-10-30)

- Les valeurs par défaut existent déjà, mais **en double** : `LISTE_DEFAULTS` dans `backend/app/routers/parametre.py` (mode serveur) et une copie dans `frontend/src/local/seeds.ts` (mode autonome). Risque de divergence à chaque modification.
- Le seed ne remplit une liste **que si elle est vide** (`count == 0`). Conséquence : modifier les valeurs par défaut n'a **aucun effet** sur une installation existante dont la liste contient déjà au moins une valeur. Les testeurs actuels ne recevraient rien.
- Seule exception : les valeurs verrouillées (ADR-009), ré-insérées si absentes.
- Les valeurs du code ne sont pas celles de Pik : c'est sa base de prod qui contient le vrai standard.
- `marques` est vide par défaut. Il existe aussi des tables `Marque` et `Fournisseur` (le pack de graines utilise la table `Fournisseur`, le matériel et les engrais utilisent la liste `fournisseurs` / `marques`). À clarifier lors du chantier 1 : quelle source pré-remplir pour les fournisseurs de graines.
- Breeders : table `Breeder` (nom, origine, information). Variétés : table `Variete` **sans lien direct vers un breeder** (le lien passe par `Graine`). Un contrôle de doublons breeders / variétés existe depuis le 2026-10-11.

## 3. Mécanisme commun : première installation + bouton

Principe valable pour les deux chantiers et les deux modes (serveur et autonome).

- **Une seule source** : fichiers JSON partagés (ex. `shared/seeds/parametres.json`, `shared/seeds/breeders.json`) lus par le backend Python ET embarqués dans l'APK (import JSON côté `seeds.ts`). Fin de la double maintenance.
- **Première installation** : à la création de la base, tout le standard est inséré. Un indicateur `AppSettings.standard_initial_applique` évite de le refaire. Remplace la règle actuelle « liste vide = on la remplit à chaque démarrage » (aujourd'hui, une liste vidée par l'utilisateur se re-remplit au redémarrage).
- **Valeurs verrouillées** (ADR-009) : toujours ré-insérées au démarrage si absentes, inchangé.
- **Bouton « Compléter avec les valeurs standard »** dans Paramétrage : un bouton global en haut de page et un bouton par liste ; pour les breeders, un bouton sur la page Breeders (ou dans Paramétrage). Il insère toutes les valeurs standard absentes. Idempotent : le presser plusieurs fois ne crée rien de plus. Retour à l'utilisateur : « N valeurs ajoutées ».
- **Jamais d'UPDATE ni de DELETE** sur les données existantes, uniquement des INSERT.
- **Comparaison des noms** : fonction de normalisation commune (minuscules, sans accents, espaces rognés), en Python et en TS. Côté serveur, l'index unique MySQL des listes fait déjà ce travail ; côté autonome, le contrôle actuel de `local/handlers/parametres.ts` compare au caractère près et doit être aligné (fix à faire au passage). Pour les breeders, aucun index : comparaison via la normalisation, noms existants chargés une fois en mémoire.
- **Livraison** : une mise à jour de l'app apporte le nouveau JSON ; l'utilisateur appuie sur le bouton pour en profiter.

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
| C1.4 | Seed de première installation + endpoint « compléter » (global et par liste) côté backend Python et côté backend local TS, normalisation commune, alignement du contrôle de doublon autonome. Tests : base neuve, base existante partielle, valeur supprimée puis bouton, doublon casse/accents, bouton pressé deux fois. |
| C1.5 | Boutons « Compléter avec les valeurs standard » dans Paramétrage (global + par liste) avec compteur de valeurs ajoutées. |
| C1.5b | Fournisseurs des packs (option A) : `NouveauPackModal` lit la liste `fournisseurs`, find-or-create dans la table `Fournisseur` (serveur + autonome) ; reprise unique des noms existants de la table `Fournisseur` vers la liste. |
| C1.6 | Livraison : nouvelle version APK + image Docker. Test par Pik sur une installation existante (rien d'écrasé, bouton qui ajoute les nouveautés) et sur une installation neuve. |

## 5. Chantier 2 : breeders, puis variétés

### 2a. Breeders (recommandé)

- Catalogue large des breeders connus : Pays-Bas, Espagne, États-Unis, France, Allemagne, Italie, plus les grands noms d'autres pays (Canada, Royaume-Uni, Suisse...). Ordre de grandeur visé : 200 à 400.
- Champs remplis : `nom_breeder`, `origine_breeder` = pays, `information_breeder` = courte description (ville, spécialité, actif ou disparu).
- Les breeders disparus sont gardés : leurs génétiques circulent toujours.
- Étapes : constitution de la liste par recherche (sites des breeders, Seedfinder, banques de graines), revue par Pik, `shared/seeds/breeders.json`, insertion via le même mécanisme (première installation + bouton, vérification par nom normalisé).

### 2b. Variétés : écarté (décision Pik 2026-10-30)

Pas de variétés pré-remplies. Raisons : même nom chez plusieurs breeders alors que `Variete` n'a pas de lien direct vers un breeder, pollution des écrans de l'utilisateur (graines, stock, classement, recherche), catalogue qui se périme vite. Les utilisateurs saisissent leurs variétés.

## 6. Liens avec les autres chantiers

- **Multilingue** ([[features/i18n]], sprint I2) : le JSON du standard devra exister par langue pour les valeurs libres (`parametres.fr.json`, `parametres.en.json`...) ; la langue choisie au premier lancement détermine le fichier utilisé. Les noms de breeders ne se traduisent pas. Faire le chantier 1 avant I2 simplifie I2.
- **Mode autonome** ([[features/mobile-standalone]]) : le seed initial s'exécute à la création de la base ; une mise à jour Play livre le nouveau JSON, le bouton l'applique.
- **Valeurs verrouillées** : ADR-009 inchangé.

## 7. Points tranchés

Tous tranchés par Pik le 2026-10-30, voir section 1. Écartés : seed versionné automatique à chaque mise à jour (remplacé par le bouton), insertion sans vérification (créerait des doublons à chaque appui sur le bouton), pré-remplissage des variétés, option B fournisseurs (FK remplacée par du texte, trop lourde).
