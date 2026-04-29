---
type: frontend
updated: 2026-04-27
sources: [frontend/src/pages/]
---

# Frontend — All Pages

## Core Culture Pages

### Dashboard (`/`)
Overview with 8 status modules:
- Active cultures count
- Plants in drying (séchage)
- Plants in curing
- Stock summary (fleur, hash, rosin)
- Production stats
- Seeds inventory
- Govee sensor status
- **Dernier arrosage par box** (2026-04-27) : pour chaque culture active, affiche le nombre de jours depuis le dernier arrosage (`arrosage_eau` ou `arrosage_engrais` dans `ActionCalendrier`). Code couleur : vert ≤ 2j / amber 3-4j / rouge ≥ 5j / gris = jamais. Trié par urgence décroissante. Endpoint : `GET /api/dashboard/arrosage-boxes`.

**Module Séchage** (2026-04-27 update) : en plus des jours de séchage, affiche T° ambiante et humidité moyenne calculées sur les dernières lectures des capteurs Govee actifs (champs `sechage_temp_moy`, `sechage_hum_moy` dans `DashboardFullStats`).

**Module Curing** (2026-04-27 update) : en plus des jours de curing, affiche la durée depuis la dernière ouverture de bocal (`curing_jours_bocal` = max jours sans `ouverture_bocal` dans `ActionCalendrier` parmi toutes les plantes en curing). Couleur : vert ≤ 3j / amber ≤ 7j / rouge > 7j.

**Module Production** (2026-04-27 update) : les quantités affichées (année en cours, mois en cours, 30 derniers jours) sont désormais calculées depuis l'historique de production (`HistoriqueCulture` + `HistoriquePlant`). Règle : si `HistoriqueCulture.date_fin` tombe dans la période concernée → la culture est comptée ; le poids = somme des `HistoriquePlant.quantite_recoltee`. `nb_recoltes_annee` = nombre de cultures clôturées dans l'année. L'ancienne source (table `Plant` avec statut `prete/recolte`) est abandonnée pour ce module.

**Layout** (2026-04-27) : modules Séchage et Curing ont `flex-1` pour occuper la même hauteur que le module Cultures en cours (colonne droite étirée à `h-full`).

### Culture (`/culture`)
Main grow cycle management. Shows active + completed cultures.
- Per-culture: phase tabs (Plantes, Calendrier, Stats)
- PlantesTab: list plants, update statuses
- CalendrierCulture: action timeline
- StatsTab: yield, cost, grams/watt
- Modals: NouvellerCultureModal, ActionModal, ArrosageModal, TransfertPlantModal

**ArrosageModal — plantes exclues de l'arrosage** (2026-04-27) : `plantesActives` exclut les statuts `sechage`, `recolte`, `curing`, `prete`, `abandonne`. Les plantes en séchage n'apparaissent donc plus dans les pills de sélection ni dans "Tout l'espace" pour les actions d'irrigation. Elles restent disponibles uniquement dans le dropdown `debut_curing` (plantesSechage).

### SechageCuring (`/sechage-curing`)
Drying & curing process. Tracks plant weights, dates, temperature/humidity logs, and progression to curing stage.

**Toggle Séchage / Curing** (2026-04-27) : la page affiche deux listes distinctes accessibles via un toggle à deux onglets (barre grise arrondie avec fond blanc + ombre sur l'onglet actif). Onglet 🌬️ Séchage (badge jaune) / 🏺 Curing (badge violet), chacun avec le compteur de plantes. Par défaut : onglet Séchage actif. Si la liste de l'onglet actif est vide, un état vide dédié s'affiche. État `activeTab: 'sechage' | 'curing'` géré en local dans le composant.

**Logique de calcul des jours (burping)** : utilise `calendarDaysAgo(dateStr)` — différence en jours calendaires (minuit → minuit locale), pas en tranches de 24h glissantes. Fix appliqué le 2026-04-25 : l'ancien calcul (`T12:00` + `Math.floor(ms/86400000)`) faisait varier le label selon l'heure courante au lieu de changer à minuit.

**Fenêtre recommandée (burping)** : affiche fréquence + durée recommandée selon le stade de curing :
| Stade | Fréquence | Durée |
|---|---|---|
| Sem 1 (J0-7) | chaque jour | 15-30 min |
| Sem 2 (J8-14) | tous les 3j | 15-30 min |
| Sem 3-4 (J15-28) | tous les 7j | 5-15 min |
| Mois 2+ (J29+) | tous les 14j | 5-10 min |
Logique : `bocalBurpWindow(joursCuring)` → fréquence, `bocalBurpDuree(joursCuring)` → durée. Stocké dans `BurpStatus.dureeRecommandee`, affiché inline après la fréquence séparé par `·`.

### HistoriqueCultures (`/historique-cultures`)
Searchable/sortable archive of past grow cycles. Shows date, varieties, plant count, cost, grams/watt. Includes CultureHistoriqueDetailModal.

---

## Seeds Pages

### Graines (`/graines`)
Seed catalogue management.
- Searchable, filterable by type (Regular/Féminisée/Auto), sortable
- GestionModal for breeders/varieties management
- NouveauPackModal / DetailPackModal for pack management
- Toggle `utilisee` flag per seed

---

## Stock & Extraction Pages

### Stock (`/stock`)
Finished product inventory.
- Sort by variety, type, jar, quantity, age
- NouveauStockModal to add entries
- `sortie` action to mark jar as consumed

### Extractions (`/extractions`)
Rosin press sessions.
- Track yield %, temperature, mesh, bag weights, press passes
- Stats (total extracted, avg yield)
- NouvelleExtractionModal, ExtractionDetailModal

### ExtractionsHash (`/extractions-hash`)
Hash extraction sessions (Polinator / Ice-o-lator).
- Track passages, bags, yield
- NouvelleHashModal, HashDetailModal

---

## Recipe Pages

### RecettesTCO (`/recettes/tco`)
Tank mix recipes by stage (Croissance/Stretch/Floraison/Correctif).
NouvelleRecetteTCOModal.

### RecettesLSO (`/recettes/lso`)
Living soil recipes by type (Substrat de base/Super soil/Top dress/Correctif).
NouvelleRecetteLSOModal.

### RecettesArrosage (`/recettes/arrosage`)
Watering recipes. NouvelleRecetteArrosageModal.

### RecettesFermentation (`/recettes/fermentation`)
Fermentation recipes by type (AACT/Compost tea/Lactofermentation/Bokashi/JADAM JLF).
NouvelleRecetteFermentationModal.

### RecettesReamendement (`/recettes/reamendement`)
Top-dressing recipes. NouvelleRecetteReamendementModal.

### RecettesSchemas (`/recettes/schemas-engrais`)
Nutrient schedule recipes by grow stage (Veg / Early Flo / Flo / Late Flo / Maturation / Flush).
- RecetteEngrais + RecetteEngraisLigne — lignes avec produit, dose ml/L, fréquence
- Color-coded by période
- NouvelleRecetteEngraisModal, import/export CSV

---

## Growing Environment Pages

### EspacesCulture (`/espaces-culture`)
Growing spaces management.
- Dimensions, surface area, equipment assigned, status (Actif/Inactif/Maintenance)
- NouvelEspaceModal, ImportExportModal

### SuiviConstantes (`/suivi-constantes`)
Sensor monitoring dashboard.
- Temperature, humidity, VPD charts
- Time window: 6h / 24h / 48h / 7j / 30j
- Per-device or aggregate view

### SuiviSolsVivants (`/suivi-sols-vivants`)
Living soil pot tracking.
- Preparation timeline, amendments applied, costs, soil age
- SuiviSolVivantModal for logging events

---

## Planning Pages

### PlanCulture (`/plan-culture`)
Culture preparation planner.
- Select space → choose pot sizes → browse seed catalogue → select varieties
- Pot count calculator (from space surface_m2)
- **Harvest date simulator** (2026-04-25): above the table, right of "Nouveau plan" button — date picker (start date) + veg duration (weeks since germination) → displays estimated harvest window using `duree_flo_min`/`duree_flo_max` of each variety. Range = earliest (fastest variety flo_min) → latest (slowest variety flo_max). Resets on plan change. UI-only, no backend.
- **TODO:** "Launch culture" button to convert plan to actual culture

### PreparationSubstrat (`/preparation-substrat`)
Substrate preparation calculator.
- Coco brick expansion, pot configs, LSO recipe selection
- Ingredient quantities + costs
- Logs preparation history

---

## Management Pages

### Amendements (`/amendements`)
Fertilizer product stock tracking.
- Expiration dates, purchase info, residual quantities
- NouveauProduitEngraisModal, GestionStockEngraisModal

### Materiel (`/materiel`)
Equipment inventory by category.
- Age, purchase date, characteristics
- NouveauMaterielModal

### Statistiques (`/statistiques`)
Global analytics.
- Seed inventory value
- Culture cost/revenue
- Production trends
- Per-variety stats

### Parametrage (`/parametrage`)
Settings page.
- Manage all configurable dropdown lists (brand types, lamp types, pot materials, jar types, equipment categories, etc.)
- Govee sensor configuration

---

### Croisement (`/croisement`)
Genetics/breeding management — fully implemented.
- **Pollen** : stock (quantité, stockage frigo/congel/ambiant), péremption auto-calculée, statut épuisé/périmé
- **Croisement** : mère (Variete + phéno) × père (pollen stock ou variété saisie), type F1/F2/BX/S1/IBL
- Récolte de graines via `RecolteGrainesInput` → crée un `PackGraine` et des `Graine`

### ClassementVarietes (`/classement-varietes`)
Variety scoring and ranking system.
- 2 dimensions : Culture /30 (vigueur/santé, productivité/structure, soif) + Consommation /70 (apparence, profil aromatique, saveur, effet)
- Note finale /100, affichage couleur-codé
- Terpene multi-select, liens avec stats d'extractions
- Export CSV

## See Also

- [[frontend/overview]] — routing table + component hierarchy
- [[frontend/conventions]] — React patterns
