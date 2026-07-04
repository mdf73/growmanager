# Wiki Log

Append-only chronological record of all wiki operations.

Format: `## [YYYY-MM-DD] <operation> | <description>`

---

## [2026-07-04] Feature | Wiki — vue métier "Vue métier" (wiki/domains/) — validé

Ajout d'une navigation par domaine fonctionnel (cultures, graines, recettes/sol vivant, stock/extractions, équipement/espaces, capteurs, photos, mobile) en complément du wiki technique (api/database/frontend), pour une lecture plus "parlante" côté humain.

9 fichiers créés dans `wiki/domains/` : `metier-index.md` + 8 hubs (`metier-cultures.md`, `metier-graines.md`, `metier-recettes-sol-vivant.md`, `metier-stock-extractions.md`, `metier-equipement-espaces.md`, `metier-capteurs.md`, `metier-photos.md`, `metier-mobile-app.md`). Chaque hub liste les fonctionnalités en langage naturel puis renvoie vers le détail technique existant. Lien ajouté en tête de `wiki/index.md`.

**Correction appliquée en cours de route** : les fichiers avaient d'abord été créés sans préfixe (`domains/cultures.md`, `domains/photos.md`, `domains/mobile-app.md`, `domains/stock-extractions.md`, `domains/index.md`) — collision de basename avec des fichiers existants (`api/cultures.md`, `features/photos.md`, `features/mobile-app.md`, `api/stock-extractions.md`, `wiki/index.md`), rendant le graph view à nouveau illisible (même symptôme que le fix précédent). Renommés avec préfixe `metier-` pour garantir l'unicité, tous les wikilinks mis à jour.

---

## [2026-07-04] Maintenance | Wiki — renommage fichiers ambigus pour le graph view Obsidian (validé)

Le vault Obsidian ("2nd Brain" basé sur NicholasSpisak/second-brain) affichait un graph illisible : plusieurs dossiers (`api/`, `database/`, `frontend/`) réutilisaient les mêmes noms de fichiers génériques (`overview.md`, `recipes.md`, `planning.md`, `living-soil.md`, `graines.md`). Obsidian affiche le nom de fichier seul dans le graph view (pas le chemin), donc ces doublons apparaissaient comme des nœuds distincts mais indiscernables.

**Fix — renommage en noms uniques et auto-descriptifs**, liens internes mis à jour :
- `api/overview.md` → `api/api-overview.md`
- `frontend/overview.md` → `frontend/frontend-overview.md`
- `api/recipes.md` → `api/api-recipes.md`, `database/recipes.md` → `database/database-recipes.md`
- `api/planning.md` → `api/api-planning.md`, `database/planning.md` → `database/database-planning.md`
- `api/living-soil.md` → `api/api-living-soil.md`, `database/living-soil.md` → `database/database-living-soil.md`
- `api/graines.md` → `api/api-graines.md`, `database/graines.md` → `database/database-graines.md`

Tous les `[[wikilinks]]` (index.md + fichiers concernés) mis à jour en conséquence. Aucun lien cassé, plus aucun basename dupliqué dans `wiki/`.

**Note :** "Sans titre.base" / "Sans titre.canvas" visibles isolés dans le graph = fichiers Obsidian par défaut, sans rapport avec le wiki — à supprimer manuellement dans Obsidian si besoin.

---

## [2026-07-04] Bugfix | Mobile — /health non proxifié + contenu caché derrière la bottom nav (validés)

**Fix 1 — test de connexion "serveur injoignable"** alors que le navigateur marchait :
l'app teste `GET <url>/health`, mais la route n'était relayée vers le backend nulle part.
- `vite.config.ts` — proxy `/health` → backend (dev :5173)
- `nginx.conf` (dev :80) — location `/health`
- `frontend/Dockerfile.prod` — la config nginx prod ne proxifiait **rien** (ni /api, ni /uploads — contrairement au commentaire du compose ; la prod entière aurait été cassée) → ajout des 3 proxies + `client_max_body_size 20M`

**Fix 2 — dernières lignes cachées derrière la bottom nav** (toutes pages) : bug 100vh mobile — `h-screen` dépasse la zone visible (barre URL / barre gestes / webview).
- `index.css` — classe `.h-screen-safe` (100vh fallback + **100dvh**)
- `Layout.tsx` — racine `h-screen-safe` + padding bas `calc(6rem + env(safe-area-inset-bottom))`
- Desktop inchangé (100dvh = 100vh sur PC)

**Règle de mise à jour APK** (documentée dans [[features/mobile-app]]) : fix backend/serveur → rien côté téléphone · fix interface → rebuild APK (Actions ou tag).

---

## [2026-07-04] Feature | Sprint Mobile A4 — App Android Capacitor + APK CI (validé) — Phase A complète

- `frontend/capacitor.config.ts` — appId `com.growmanager.app`, webDir dist, androidScheme `http` + cleartext true (serveurs locaux/Tailscale sans mixed-content).
- `package.json` — @capacitor/core+cli+android ^7 en devDeps · retrait `vite-plugin-pwa` (config obsolète : icône inexistante + collision avec le manifest statique A3) · lockfile régénéré · `vite.config.ts` nettoyé.
- `ServerSetup.tsx` (nouveau) — écran premier lancement natif : saisie URL + test `/health` + reload. Gate dans `App.tsx` via `window.Capacitor.isNativePlatform()` + `getServerUrl()`.
- `photos.ts` (`photoUrl`) + `calendarPdfExport.ts` — URLs `/uploads` via `serverFileURL()`/`getServerUrl()` pour le mode distant.
- `frontend/assets/` — icon.png 1024 + splash.png 2732 générés depuis `IconSeul.png` (source pour `@capacitor/assets`).
- `.github/workflows/android-apk.yml` — build APK debug sur workflow_dispatch ou tag `vX.Y.Z` : npm ci → build → cap add android → assets generate → gradlew assembleDebug → artifact + release. Premier run : ✅ Success 2m30s. Node 20→22 (dépréciation runners).
- `.gitignore` — frontend/android/, frontend/icons/, *.apk.
- Wiki : [[features/mobile-app]] créé (architecture, build, procédure Tailscale détaillée) + index.
- **Phase A terminée** : app mobile Android connectée au serveur auto-hébergé. Phase B (autonome SQLite) au backlog.

---

## [2026-07-04] Feature | Sprint Mobile A3 — URL serveur configurable + PWA (validé)

**URL serveur configurable**
- `api/client.ts` — nouvelles fonctions exportées : `getServerUrl()` / `setServerUrl()` (clé localStorage `gm_server_url`), `apiBaseURL()` (vide → `/api` inchangé ; renseignée → `<url>/api`), `serverFileURL(path)` (pour `/uploads/...` en distant), `testServerConnection(url)` (GET `<url>/health`, timeout 5s).
- `Parametrage.tsx` — section "Serveur (app mobile)" dans l'onglet Général : input URL + bouton Tester + Enregistrer (reload auto pour recharger le client Axios).

**PWA**
- `frontend/public/manifest.webmanifest` — standalone, portrait, theme `#2d6a4f`.
- Icônes générées depuis `IconSeul.png` : `pwa-192.png`, `pwa-512.png`, `pwa-512-maskable.png` (fond brand, logo 62%).
- `index.html` — `<link rel="manifest">`, apple-touch-icon → pwa-192, viewport `viewport-fit=cover`.
- ⚠ Limite connue : install PWA "standalone" Chrome Android exige HTTPS ; en `http://IP` locale = raccourci simple. L'APK Capacitor (A4) n'a pas cette contrainte.

---

## [2026-07-04] Feature | Sprint Mobile A2 batch 2 — pages restantes responsive (validé)

Audit des 24 pages restantes : la plupart déjà conformes (headers `flex-col lg:flex-row` ou `flex-wrap`, tables `overflow-auto`, grilles avec breakpoints). Corrections :
- `Croisement.tsx` — header `flex-wrap gap-3` + table croisements `overflow-hidden` → `overflow-x-auto`
- `SuiviConstantes.tsx` — header `flex-wrap gap-3` (boutons Import CSV / Lire maintenant)
- `Consommation.tsx` — header `flex-wrap gap-3` (bouton Nouvelle session)
- Graines / Extractions (prioritaires Pik) : déjà conformes, aucun changement
- Cas limites laissés tels quels (tiennent sur 360px) : mini-grilles stats 3-4 col (Statistiques, Culture, Materiel, durées SechageCuring)
- `tsc --noEmit` OK · Sprint A2 complet validé

---

## [2026-07-04] Feature | Sprint Mobile A2 batch 1 — 4 pages principales responsive (validé)

- `CalendrierGlobal.tsx` — `DayCell` mode compact mobile (< `sm`) : pastilles colorées par type d'action (couleur culture si event unique, gris si groupe), cellules `min-h-[52px]`, tap jour → DayModal. Chips détaillées inchangées ≥ `sm`.
- `Culture.tsx` — modal Dates clés : `max-h-[90vh] overflow-y-auto`.
- `Parametrage.tsx` — modal confirmation import : idem.
- Dashboard et Stock audités : déjà responsive (grilles breakpoints, tables `overflow-auto`), aucun changement.
- Compilation `tsc --noEmit` OK. Zéro impact desktop.

---

## [2026-07-04] Feature | Sprint Mobile A1 — bottom nav + modals (validé)

Lancement de la **Phase Mobile** (plan "A puis B" validé — voir section dédiée dans [[roadmap]]).

**Sprint A1 livré :**
- `Layout.tsx` — bottom nav mobile refaite : 4 raccourcis (Dashboard, Culture, Calendrier, Stock) + bouton "Plus" ouvrant la sidebar mobile. Remplace l'aplatissement des 28 items. Safe-area `env(safe-area-inset-bottom)`.
- `NouveauSessionVapoModal.tsx` — ajout `max-h-[90vh] overflow-y-auto` (seule modal sur 39 sans le pattern standard).
- Zéro impact desktop (breakpoints `lg:` inchangés). Compilation `tsc --noEmit` OK.

**Wiki :** section Phase Mobile dans [[roadmap]] + section bottom nav dans [[frontend/frontend-overview]].

---

## [2026-07-04] Bugfix | Coquille "bocalx" → "bocaux" (pluriel)

**Bug corrigé :** Le badge d'alerte stock du Dashboard et le bouton de confirmation d'ouverture bocaux dans SechageCuring affichaient "2 bocalx" au lieu de "2 bocaux".

**Cause :** Pluralisation naïve `bocal${n > 1 ? 'x' : ''}` — ajoute un "x" à "bocal" au lieu du vrai pluriel français "bocaux" (pluriel irrégulier).

**Fix :** Remplacé par un ternaire complet sur le mot entier : `${n > 1 ? 'bocaux' : 'bocal'}`.

**Fichiers modifiés :**
- `frontend/src/pages/Dashboard.tsx` (l.270) — badge alerte stock
- `frontend/src/pages/SechageCuring.tsx` (l.888) — bouton "Ouvrir X bocaux"

---

## [2026-06-24] Feature | Âge de la plante lors de l'extraction Rosin

### Besoin
Dans la fiche d'une extraction Rosin (Extractions → clic sur une extraction), afficher l'âge **figé** de la plante au moment de l'extraction = `date d'extraction − date de fin de curing`. Valeur qui ne bouge jamais (ne dépend pas de la date du jour). Affichage juste avant les Notes.

### Modifications
- **Backend** (`extractions.py`) : helpers `_age_source_for_stock()` + `_build_ages_sources()` ; remonte `id_stock_source`/`sources[]` → `Stock.id_plant` → `Plant` → dernière `PlantCuring` clôturée. Une entrée par source (ids dédoublonnés).
- **Schéma** (`schemas/extraction.py`) : nouveau `AgeSource` + champ `RosinExtractionRead.ages_sources`.
- **Frontend** : section « Âge lors de l'extraction » dans `ExtractionDetailModal.tsx` (avant Notes) ; format `21 jours` / `84 jours (~3 mois)` au-delà de 45 j ; `AgeSource` + champ dans `api/stock.ts` (exclu des payloads create/update).
- **Fallbacks** : « Plante source non liée » (pas de `Stock.id_plant`) / « Fin de curing non renseignée » (curing non clôturé).
- Aucune migration DB.

### Wiki
- `api/stock-extractions.md` — section « Âge lors de l'extraction (2026-06-24) »
- `database/stock.md` — note enrichissement `ages_sources` sous RosinExtraction

---

## [2026-06-17] Feature | Édition d'extraction Rosin + maillage obligatoire

### Besoin
Une extraction Rosin a pu être validée sans maillage. Deux demandes : (1) pouvoir modifier une extraction depuis la liste (notamment maillage et poids sortie), (2) rendre le maillage obligatoire.

### Modifications
- **Maillage obligatoire** : `RosinExtractionCreate`/`RosinExtractionUpdate` → `maillage: str` ; garde backend (400 si vide) dans `create`+`update` ; `<select required>` + validation JS dans les deux modals.
- **Endpoint `PUT /api/rosin/{id}`** (`update_rosin_extraction`) : édite tous les paramètres, **ne re-déduit pas** les stocks sources, **synchronise le stock Rosin produit** (quantité par delta + maillage).
- **Lien extraction ↔ stock produit** : nouvelle colonne `RosinExtraction.id_stock_produit` (posée à la création après `flush`). Rétrocompat : best-effort par date+maillage+quantité pour les anciennes extractions.
- **Frontend** : nouveau `EditExtractionModal.tsx` (édition complète préremplie) ; bouton crayon ✏️ sur chaque ligne `Extractions.tsx` ; `rosinAPI.update()` dans `api/stock.ts`.
- **Migration auto** : `("RosinExtraction", "id_stock_produit", "ALTER TABLE RosinExtraction ADD COLUMN id_stock_produit INT")` ajoutée à `run_migrations()` dans `main.py` → créée au prochain démarrage backend, aucun SQL manuel.

### Wiki
- `api/stock-extractions.md` — endpoint PUT + section édition/maillage
- `database/stock.md` — colonnes `id_stock_produit` et `maillage` obligatoire

---

## [2026-06-04] Bugfix | Migration manquante : Stock.substrat_type

### Problème
Les nouvelles installations depuis GitHub crashaient au démarrage du backend avec :
```
sqlalchemy.exc.OperationalError: (1054, "Unknown column 'Stock.substrat_type' in 'field list'")
```
Le Dashboard était inaccessible.

### Cause
La colonne `substrat_type VARCHAR(200)` était présente dans le modèle SQLAlchemy (`Stock`) mais absente de la liste `run_migrations()` dans `main.py`. La migration automatique au démarrage ne créait donc jamais cette colonne sur les nouvelles installations.

### Fix
- **`backend/app/main.py`** — ajout de l'entrée `("Stock", "substrat_type", "ALTER TABLE Stock ADD COLUMN substrat_type VARCHAR(200) NULL")` dans `run_migrations()`

### Fix ponctuel pour les installations existantes affectées
```powershell
docker compose exec db mysql -u growuser -pgrowpassword growmanager -e "ALTER TABLE Stock ADD COLUMN substrat_type VARCHAR(200) NULL;"
docker compose restart backend
```

Operations: `bootstrap`, `ingest`, `query`, `lint`, `update`

---

## [2026-05-25] update | Tri alphabétique plantes actives dans PlantesTab

Plantes actives triées A→Z par `nom_affichage` (`.localeCompare 'fr'`). Groupes de variétés également triés alphabétiquement. Fichier modifié : `frontend/src/components/culture/PlantesTab.tsx`.

---

## [2026-05-25] update | Chantier TypeScript — 5 fichiers tronqués réparés + 7 erreurs tsc corrigées

**Contexte :**
`tsc --noEmit` retournait des erreurs JSX sur plusieurs fichiers. Diagnostic : fichiers écrits partiellement lors de sessions précédentes (tronqués en cours d'écriture), plus des erreurs de type pré-existantes.

**Fichiers tronqués réparés (JSX reconstitué) :**
- `frontend/src/components/NouveauPackModal.tsx` — bouton submit avec ternaire `isPending`/`Save`/`Plus`
- `frontend/src/components/SuiviSolVivantModal.tsx` — contenu dupliqué retiré (footer déjà complet)
- `frontend/src/pages/Culture.tsx` — fermeture `{showNewModal && ...}` + `</div>` + return + doublon supprimé
- `frontend/src/pages/Croisement.tsx` — fermeture table pollen (`</td></tr></tbody></table>`) + `setRecolteCroisement(null)` tronqué
- `frontend/src/components/culture/PhotoGallery.tsx` — bouton suppression, badge plante, fermeture grid, lightbox

**Erreurs TypeScript corrigées :**
- `api/stock.ts` : ajout champ `maillage_polinator?: string` dans l'interface `HashExtraction` (utilisé par `NouvelleHashModal` mais absent du type)
- `SensorDayChart.tsx` : formatters recharts (`Tooltip` + `Legend`) typés `any` pour `props`/`entry` (recharts `DataKey` est `string | number | function`, pas juste `string`)
- `StockOriginDrawer.tsx` : import `FlaskConical` inutilisé supprimé
- `StatsTab.tsx` : constante `PHASES_VEG` inutilisée supprimée
- `Croisement.tsx` : `EditCroisementModal` câblé dans la section modals (feature déjà codée mais jamais rendue — `editCroisement` state + composant désormais reliés)

**Résultat :** `tsc --noEmit` → 0 erreur, build Vite propre.

---

## [2026-06-02] update | Bug fix — onglet "En curing" affichait les plantes déjà en stock

**Symptôme :** Les plantes dont le curing était terminé (bouton "Terminer" dans SechageCuring) continuaient d'apparaître dans l'onglet "En curing" de la page Stock.

**Cause :** Dans `Stock.tsx`, le `useMemo` `curingPlants` itérait sur toutes les plantes de toutes les sessions `active`, sans filtrer celles dont `date_fin_curing` est renseigné. Une session curing reste `statut='active'` tant qu'elle n'est pas explicitement fermée, donc les plantes terminées restaient visibles.

**Fix :** Ajout de `.filter(p => !p.date_fin_curing)` dans le `useMemo` `curingPlants` de `frontend/src/pages/Stock.tsx`.

---

## [2026-05-25] update | Plant — numéro de graine dans le paquet (rang) au lieu de l'id_graine global

**Bug corrigé :**
Le `nom_affichage` d'une plante affichait `Bleu Roi (True F1) #1758` (id_graine global DB) au lieu du rang dans le paquet (`#5`, `#6`…).

**Fix backend (`cultures.py`) :**
- `_build_plant_name(graine, numero, db=None)` : si `db` est fourni et que la graine a un `id_packgraine`, calcule le rang 1-based de la graine dans son paquet (toutes les graines du pack triées par `id_graine`, `index + 1`). Fallback sur `numero` si db absent.
- Création bulk (NouvellerCultureModal) : passage de `db` à `_build_plant_name`
- `add_plant` (ajout unitaire depuis PlantesTab) : si `id_graine` fourni, recalcule le nom via `_build_plant_name` avant création — remplace le `nom_affichage` envoyé par le frontend (qui était juste `variete_nom` sans numéro)

**Migration one-shot :** `backend/migrate_plant_names.py`
- Recalcule et met à jour `nom_affichage` pour toutes les plantes existantes liées à une graine
- Commande : `docker compose exec backend python migrate_plant_names.py`

**Fichiers modifiés :**
- `backend/app/routers/cultures.py` — `_build_plant_name`, `add_plant`
- `backend/migrate_plant_names.py` — script migration (nouveau)

---

## [2026-05-25] update | PlantesTab — groupement des plantes actives par variété

**Feature validée :**
Dans l'onglet "Plantes" d'une culture, la section "Plantes actives" regroupe désormais les plantes par variété quand plusieurs variétés coexistent.

**Comportement :**
- Si ≥ 2 variétés différentes parmi les plantes actives → affichage en accordéons (un par variété)
- Chaque accordéon : header cliquable (icône ▶/▼ + Leaf + nom variété + breeder + badge "N plantes")
- Clic sur le header → déplier/replier la liste des PlantCards
- Groupes ouverts par défaut
- Si 1 seule variété → affichage à plat inchangé (rétro-compatibilité)

**Composant ajouté :** `VarieteGroup` dans `PlantesTab.tsx`
**Import ajouté :** `ChevronDown`, `ChevronRight` (lucide-react)

**Fichier modifié :** `frontend/src/components/culture/PlantesTab.tsx`

---

## [2026-05-18] update | Bugfix — Restauration SQL échoue (TLS self-signed certificate)

**Bug corrigé :**
La restauration de base de données via `/api/backup/restore` échouait avec `ERROR 2026 (HY000): TLS/SSL error: self-signed certificate in certificate chain` quand le serveur MySQL cible utilise un certificat auto-signé.

**Cause :** La commande `mysqldump` (export) avait déjà `--skip-ssl` mais la commande `mysql` (restore) ne l'avait pas.

**Fix :** Ajout de `--skip-ssl` dans la liste d'arguments de `subprocess.run(["mysql", ...])` dans `backup_restore()`.

**Fichier modifié :** `backend/app/routers/import_export.py`

---

## [2026-05-18] update | Bugfix — CalendrierGlobal heure 02:00 (timezone UTC)

**Bug corrigé :**
Dans `EventDrawer` (CalendrierGlobal.tsx), toutes les actions affichaient "À 02:00".

**Cause :** `new Date(event.date_action)` sur une chaîne `"YYYY-MM-DD"` sans heure est interprétée en UTC midnight. La France étant UTC+2, minuit UTC → 02:00 locale.

**Fix :** Parsing via `.slice(0, 10) + 'T12:00:00'` (même pattern que `DayModal` ligne 414). L'heure est supprimée de l'affichage (non significative pour les actions de culture).

**Fichier modifié :** `frontend/src/pages/CalendrierGlobal.tsx`

---

## [2026-05-18] update | Stock — fix engrais_type par plante (pas par culture entière)

**Bug corrigé :**
Dans une culture multi-substrat (ex: un pied Coco/Aptus + un pied LSO/Terralba dans la même tente), le calcul des marques engrais prenait tous les arrosages de la culture → contamination croisée entre pieds.

**Fix :** filtre `id_plant = cette_plante OR id_plant IS NULL OR global_culture = 1` dans :
- `fin_curing` handler (cultures.py)
- endpoint `GET /plant/{id}/stock-info`

Logique : seuls les arrosages spécifiques à cette plante + les arrosages globaux (appliqués à toute la culture) sont pris en compte.

**DB corrigée :** stocks 48/49/50 → `engrais_type = 'Aptus'` (au lieu de 'Aptus, Terralba')

**Fichier modifié :** `backend/app/routers/cultures.py`

---

## [2026-05-18] update | Stock Fleur — bug casse, substrat_type, engrais marques, bocal, auto-remplissage

**Bugs corrigés :**
- `type_stock="fleur"` (minuscule) au lieu de `"Fleur"` lors du passage `fin_curing` → `cultures.py` l.698 corrigé + 2 entrées DB mises à jour
- `substrat_type` écrasé à null par le modal lors d'une modification → corrigé via auto-remplissage

**Nouvelles colonnes Stock :**
- `substrat_type VARCHAR(200)` : substrat de la plante (Coco, Sol Vivant — Recette X…)
- `engrais_type` élargi à VARCHAR(200) : marques uniques des produits engrais utilisés en arrosage (ex: "Aptus, Terralba")
- `id_plant` : traçabilité plante source (maintenant rempli au fin_curing)
- `id_materiel_bocal` : bocal de la session de curing (maintenant rempli au fin_curing)

**Nouvel endpoint :** `GET /api/cultures/plant/{id_plant}/stock-info`
Retourne `{ sous_type_stock, lampe_type, substrat_type, engrais_type }` dérivés de la culture.
Logique : type_culture → sous_type, dernière action lampe → lampe_type, plant.substrat → substrat_type, recettes arrosage_engrais → ProduitEngrais.marque uniques.

**Modal NouveauStockModal :**
- `useEffect` sur `form.id_plant` → appel `getPlantStockInfo()` → auto-remplit sous_type, lampe, substrat, engrais
- Badge vert "✓ rempli depuis la culture" affiché après auto-remplissage
- Substrat et Engrais : champs `<select>` alimentés par listes paramétrage (`substrats` et `engrais`)
- `substrat_type` ajouté au form state, payload, et reset on type change

**Affichage Stock.tsx :**
- Colonne renommée "Substrat / Engrais"
- Substrat en ligne principale, engrais en ligne secondaire (gris plus petit) — indépendants

**Fichiers modifiés :**
- `backend/app/routers/cultures.py` — fix `type_stock="Fleur"`, endpoint `/plant/{id}/stock-info`, fin_curing remonte bocal + substrat + engrais + id_plant
- `backend/app/models/all_models.py` — `substrat_type` + `engrais_type` VARCHAR(200)
- `backend/app/schemas/stock.py` — `substrat_type` ajouté
- `backend/app/routers/stock.py` — `substrat_type` dans create/update/read
- `frontend/src/api/stock.ts` — `substrat_type` dans interface Stock
- `frontend/src/api/cultures.ts` — `PlantStockInfo` interface + `getPlantStockInfo()`
- `frontend/src/components/NouveauStockModal.tsx` — auto-remplissage + selects substrat/engrais
- `frontend/src/pages/Stock.tsx` — affichage substrat + engrais séparés

---

## [2026-05-17] update | Détail arrosage engrais dans CalendrierGlobal — 3 encarts + fix [object Object]

**Bug corrigé :**
- `EventDrawer` dans `CalendrierGlobal.tsx` appelait `String(v)` sur les champs array (`produits`, `produits_calcules`, `calculs`) → affichage `[object Object],[object Object],...`
- Fix : ces clés sont exclues du rendu générique, la détection utilise `!Array.isArray(v) && typeof v !== 'object'`

**Feature — 3 encarts pour `arrosage_engrais` :**
1. Encart gris : Recette, pH cible, Volume/plante (`volume_par_plante_l` ou fallback `volume_l`)
2. Encart vert : 🧪 Produits utilisés (depuis `params.produits_calcules`)
3. Encart doré : 💰 Coût par produit + total €

**Nouveau endpoint backend :** `GET /api/cultures/{id}/actions/{id}/cout`  
Calcul : `dosage × volume_total_l × (prix_achat / volume_conditionnement)` par ligne de recette.  
Retourne `ActionCout { cout_total, par_produit: [{nom, cout}] }`. Fonctionne sur anciens events (lit `id_recette` + `volume_total_l` des params).

**Nouveau type frontend :** `ActionCout` + `getActionCout()` dans `api/calendrier.ts`

**Fichiers modifiés :**
- `backend/app/routers/cultures.py` — endpoint `/{culture_id}/actions/{action_id}/cout`
- `frontend/src/api/calendrier.ts` — `ActionCout` interface + `getActionCout()`
- `frontend/src/pages/CalendrierGlobal.tsx` — `EventDrawer` 3 encarts + fix rendu générique

---

## [2026-05-15] update | Bugfix coût engrais culture — x1000 trop cher

**Bug corrigé :**
- Fichier : `backend/app/routers/culture_helpers.py`, fonction `_compute_culture_cost`
- Symptôme : coût engrais affiché sur la culture était 1000× trop élevé (ex : 70€ au lieu de 0.07€ pour 5 mL de mélasse noire)
- Cause : `prix_par_unite = prix_achat / volume_conditionnement` ne convertissait pas les unités (1 L → 1 au lieu de 1000 mL)
- Fix : ajout de `_to_small_unit(val, unite)` qui normalise L→mL et Kg→g avant le calcul
- Le frontend (modal recette) était déjà correct via sa fonction `norm()`

---

## [2026-05-15] update | Export PDF Calendrier Global — v3.3.0

**Feature validée :**
- Nouveau endpoint `GET /api/calendrier/export?date_debut=&date_fin=` (calendrier.py)
- Modal `ExportPDFModal` + bouton "Export PDF" dans header CalendrierGlobal
- Génération HTML jour par jour : cover page + 1 page/jour, events groupés par type avec params/notes
- `window.print()` → PDF natif navigateur · zéro dépendance
- v3.2.0 → v3.3.0

---

## [2026-05-15] update | Review specs V4 — bilan complet + clôture High Priority TODOs

**Bilan review 2026-05-15 :**
- Toutes les features V4 (A–M) : ✅ DONE (confirmé sur code réel)
- HP-1 Launch Culture depuis PlanCulture : ✅ DONE (NouvellerCultureModal + initialData)
- HP-2 Multi-goal but_culture badges : ✅ DONE (split(',') Culture.tsx)
- HP-3 ActionModal global harvest : ✅ VÉRIFIÉ (backend expand par plante actives)
- HP-4 Export CSV PlanCulture : ✅ DONE (endpoint + bouton frontend)
- Croisements (audit marqué 🚧) : ✅ DONE — 1294 lignes frontend + router complet

**Gaps restants après V4 :**
- Stock bulk entry : ❌ non implémenté
- Govee LAN polling : ⚠️ besoin test hardware H5179
- Pas de specs V5 dans Documentation/ — projet en attente d'un nouveau backlog

---

## [2026-05-14] update | Sprint L — Export PDF fiche culture

**Feature :** Export PDF complet d'une fiche culture, généré côté backend avec fpdf2 (déjà présent dans requirements.txt).

**Backend :** `GET /api/cultures/{id}/export/pdf` dans `cultures.py`
- Fiche A4 portrait avec header vert brand, footer paginé
- Sections : Informations générales (2 colonnes dates + infos) · Tableau des plantes (variété, statut, substrat, pot, récolte) · Résumé des actions (comptage par type, grille 3 colonnes) · Coûts (électricité, engrais, graines, total, €/g) · Notes si présentes
- Réutilise `_compute_culture_cost()` et `_enrich_plant()` existants
- Streaming PDF via `StreamingResponse` + header `Content-Disposition`

**Frontend :** Bouton `📄 PDF` dans `CultureDetail` (Culture.tsx)
- Bouton toujours visible (tous statuts) · import `FileDown` depuis lucide-react
- `handleExportPdf` : fetch → blob → `URL.createObjectURL` → download nommé `fiche_{nom}.pdf`
- Spinner `Loader2` pendant la génération

**Fichiers modifiés :**
- `backend/app/routers/cultures.py` — endpoint `/{culture_id}/export/pdf`
- `frontend/src/pages/Culture.tsx` — bouton PDF + handler

---

## [2026-05-13] update | Tri alphabétique par défaut dans le catalogue graines

**Feature :** Le tableau `/graines` est désormais trié par défaut par breeder A→Z, puis variété A→Z à l'intérieur de chaque breeder.

**Changement :** Dans `Graines.tsx`, le `useMemo` `filtered` retournait `base` sans tri quand `sortCol === null`. Remplacé par un `.sort()` avec `localeCompare('fr', { sensitivity: 'base' })` sur breeder puis variété. Les colonnes cliquables ne sont pas affectées.

**Fichier modifié :** `frontend/src/pages/Graines.tsx`

---

## [2026-05-13] update | Bugfix — race condition création variété dans NouveauPackModal

**Bug corrigé :** Dans `NouveauPackModal.tsx`, l'ajout d'une nouvelle variété via le bouton `+` semblait ne pas fonctionner.

**Cause racine :** Race condition entre `queryClient.invalidateQueries` (async) et le rendu du `<select>`. Après création de la variété, `setShowNewVariete(false)` basculait immédiatement sur le select, mais le cache n'était pas encore mis à jour. Le select affichait "— Sélectionner —" car aucune option ne correspondait à l'ID retourné, donnant l'impression que la création avait échoué (alors que la variété était bien créée en DB).

**Fix appliqué :**
- `addVariete.onSuccess` : `invalidateQueries` → `setQueryData` pour mise à jour immédiate du cache
- Même fix appliqué sur `addBreeder` et `addFournisseur` (même pattern, même risque)
- Ajout d'un message d'erreur `addVariete.isError` sous le champ variété

**Fichier modifié :** `frontend/src/components/NouveauPackModal.tsx`

---

## [2026-04-29] update | Setup Git + workflow CI

Mise en place du versioning Git et du workflow de commit.

**Actions réalisées :**
- `git init` + premier commit sur `https://github.com/mdf73/growmanager` (repo privé)
- `.gitignore` créé — exclut `node_modules/`, `__pycache__/`, `.env`, `mysql_data/`
- `.env.example` créé — template des variables d'environnement sans secrets
- `push.bat` créé — script Windows pour committer et pusher en un double-clic

**Workflow de commit :**
1. Claude fait les modifications code + wiki + écrit `_commit_msg.txt`
2. L'utilisateur double-clique sur `push.bat` → git add + commit + push automatique

---

## [2026-05-10] update | Sprint 1 V4 — PPFD/DLI, timer flush, launch culture, déduction engrais

**Features validées :**

- **M — PPFD / DLI** : widget dans `StatsTab.tsx` — calcul PPFD (µmol/m²/s) et DLI (mol/m²/j) depuis puissance lampe + surface espace. Photopériode auto (18h veg / 12h floraison). Indicateurs colorés vs cibles. Fallback si données manquantes. Props `idEspace` + `phase` passés depuis `Culture.tsx`.

- **C — Timer de flush** : colonne `date_debut_flush DATE NULL` sur `Culture` (migration auto `main.py`). Exposée dans `CultureUpdate`, `CultureRead`, serializer `cultures.py`. Bouton toggle dans `Culture.tsx` (visible en phase floraison). Badge 🚿 J+X dans `Dashboard.tsx` via `BoxArrosageStats` enrichi.

- **Launch Culture** : `PlanCulture.tsx` appelle `planCultureAPI.update({ statut: 'lance' })` après création. Badge "Lancé" visible dans le sélecteur de plans.

- **J — Déduction stock engrais** : déjà implémentée dans `cultures.py` (arrosage_engrais via recette RecetteEngrais ou liste manuelle, `max(0, ...)`). Roadmap mise à jour (fausse ❌ → ✅).

**Fix** : `espaceAPI` → `espacesAPI` dans `StatsTab.tsx` (nom correct de l'export).

**Pages wiki mises à jour :** `roadmap.md` — Sprint 1 marqué complété, statuts M/C/J mis à jour.

---

## [2026-04-28] update | Bugfix — nommage des plantes

**Bug corrigé :** `_build_plant_name()` dans `routers/cultures.py` utilisait `plant_counter` (compteur incrémental de la boucle de création) au lieu de `graine.id_graine`.

**Comportement corrigé :** Le nom d'une plante est désormais `<variété> #<id_graine>`, reflétant le numéro réel de la graine utilisée.

**Page mise à jour :** `features/plant-lifecycle.md` — section "Naming Convention" ajoutée.

---

## [2026-04-25] update | Feature — simulateur de récolte sur PlanCulture

Ajout du simulateur de dates de récolte sur la page `/plan-culture` (UI-only, pas de backend).
- `frontend/pages.md` — section PlanCulture mise à jour avec description du simulateur
- `roadmap.md` — feature ajoutée dans Completed (2026-04-25)

---

## [2026-04-24] update | Wiki sync — 5 new routers, 2 new pages, 8 new DB models

Compared wiki state (2026-04-09) against actual codebase. Gaps identified and patched.

**New routers (not documented):**
- `sechage.py` `/api/sechage` + `curing.py` `/api/curing` — séchage/curing refactorisés en sessions indépendantes
- `notation_variete.py` `/api/notations` — système de notation variétés /100
- `vaporisateur.py` `/api/vaporisateurs` — inventaire vaporisateurs + consommables
- `croisement.py` `/api/croisements` — génétique : pollen + croisements (était placeholder)

**New pages (not documented):**
- `ClassementVarietes` `/classement-varietes` — ranking variétés avec scores Culture/Conso
- `Croisement` `/croisement` — génétique complètement implémentée (était "coming soon")
- `RecettesSchemas` `/recettes/schemas-engrais` — schémas engrais par période (était placeholder)

**New DB models:**
- `SessionSechage`, `PlantSechage`, `SessionCuring`, `PlantCuring` — refacto séchage/curing
- `NotationVariete` — scoring variétés
- `Vaporisateur`, `VapoConsommable` — inventaire vaporisateurs
- `Pollen`, `Croisement` — génétique

**Files updated:** `api/overview.md`, `frontend/pages.md`, `database/schema-overview.md`, `roadmap.md`, `overview.md`

---

## [2026-04-09] bootstrap | Initial wiki creation from full codebase exploration

Explored entire GrowManager codebase (backend + frontend + docs) and bootstrapped the wiki from scratch.

**Coverage:**
- 24+ SQLAlchemy models across 10 domain groups
- 23 FastAPI routers with all endpoints documented
- 24 frontend pages + routing table
- 4 cross-cutting feature flows
- Architecture patterns and dev rules
- Consolidated roadmap from existing docs

**Pages created:** 28 pages across 6 sections + index + log + overview

---

## [2026-05-14] Feature E — Comparaison inter-cultures (Sprint 4)

### Nouvelles fonctionnalités
- **`GET /api/cultures/compare?ids=1,2,3`** : endpoint multi-culture retournant données complètes (durées, rendement, coûts, espace, lampes, LSO/TCO, marques engrais, hauteurs, arrosages)
- **`ComparaisonCultures.tsx`** (`/comparaison-cultures`) : page complète de comparaison
  - Sélecteur dropdown 2-3 cultures (actives + terminées + séchage/curing)
  - Tableau comparatif côte-à-côte avec highlight meilleure valeur
  - Détail TCO par type (Croissance/Floraison/Stretch/Correctif) pour cultures LSO
  - Graphique hauteurs superposées (moyenne par culture, axe X continu J0→J_max)
  - Graphique arrosages cumulés (AreaChart, axe continu)
  - Section "Détail coût engrais par recette" : volume, coût, coût/L (rouge si > 1€/L)

### Bugfixes
- **Double-comptage volume arrosage** : en mode "arrosage global", le backend crée N actions per-plante avec `volume_l = volume_total`. Fix : utiliser `volume_par_plante_l` (si disponible et `global_culture=False`) pour le calcul des coûts (`_compute_culture_cost`) et du volume affiché dans le compare
- **Séparation volume total / volume engrais** : `volume_arrosage_total_l` (tous types) et `volume_arrosage_engrais_l` (recette engrais uniquement) exposés dans l'API compare
- **Axe X graphiques** : ticks réguliers de J0 à J_max (tous les 5/10/20/30j selon durée) — plus de sauts bizarres liés aux jours sans données

### Files modified
- `backend/app/routers/cultures.py` — ajout endpoint `/compare`, fix `_compute_culture_cost` (volume_par_plante_l), fix compare arrosage
- `frontend/src/api/comparaison.ts` — interfaces + fonctions API
- `frontend/src/pages/ComparaisonCultures.tsx` — page complète (~600 lignes)
- `frontend/src/App.tsx` — route `/comparaison-cultures`
- `frontend/src/components/Layout.tsx` — nav sous-menu Culture

## [2026-06-11] Normalisation des unités — coûts & déductions de stock

### Contexte
Merge de la **PR #4** (contributeur externe Boblespam) : fix du calcul des coûts LSO, réamendements et arrosages dans `suivi_sol_vivant.py` — normalisation des unités (mL/L/g/Kg) avant le ratio `prix_achat / volume_conditionnement`, et prise en compte de `volume_eau_l` pour les arrosages. Audit complet ensuite : le même bug existait ailleurs.

### Bugfixes (suite de l'audit)
- **`cultures.py` — 3 calculs de coût engrais** (`_compute_culture_cost` ~l.480, détail coût par recette dans `/compare` ~l.1053, coût d'un arrosage individuel ~l.2422) : le prix était divisé par `volume_conditionnement` sans tenir compte de `unite_volume` → coûts surévalués ×1000 pour les produits conditionnés en L ou Kg (ex. flacon 1 L à 30 € compté 30 €/mL au lieu de 0,03 €/mL)
- **Déductions de stock** : `quantite_stock` était décrémenté d'une quantité en mL/g sans conversion vers `unite_quantite` du produit (faux ×1000 si stock saisi en L ou Kg). Corrigé dans `cultures.py` (arrosage_engrais l.844, preparation_tco l.867) et `suivi_sol_vivant.py` (`add_arrosage`)

### Implémentation
- Helpers partagés par fichier : `_UNIT_FACTORS` (mL/L/cL/g/Kg), `_to_small_unit()` (normalise vers mL ou g, gère les unités composées 'mL/L' → 'mL'), `_prix_par_petite_unite()` (cultures.py), `_deduire_stock()` (conversion bidirectionnelle : quantité ligne → petite unité → réécriture dans l'unité du stock)
- Même logique que `culture_helpers.py` (déjà correct) et que le `toBase()`/`norm()` du frontend (déjà correct partout)
- Exception volontaire : liste manuelle legacy (`cultures.py` l.869) — quantité saisie sans unité, supposée dans l'unité du stock

### Files modified
- `backend/app/routers/cultures.py` — helpers unités + 3 fix coûts + 2 fix déductions stock
- `backend/app/routers/suivi_sol_vivant.py` — `_deduire_stock()` + fix déduction dans `add_arrosage` (en plus de la PR #4 mergée)
