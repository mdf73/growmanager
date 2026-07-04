---
type: domain
updated: 2026-07-04
---

# 🧪 Recettes & Sol Vivant

Toutes les recettes utilisées pendant la culture (nutrition, arrosage, sol vivant) et le suivi du sol vivant dans les pots.

## Ce que ça fait

- **Recettes TCO** (tank mix) — par stade Croissance/Stretch/Floraison/Correctif. Page `/recettes/tco`.
- **Recettes LSO** (living soil) — Substrat de base/Super soil/Top dress/Correctif. Page `/recettes/lso`.
- **Recettes d'arrosage** — Page `/recettes/arrosage`.
- **Recettes de fermentation** — AACT/Compost tea/Lactofermentation/Bokashi/JADAM JLF. Page `/recettes/fermentation`.
- **Recettes de réamendement** (top-dressing). Page `/recettes/reamendement`.
- **Schémas d'engrais** — calendrier nutritif par stade (Veg/Early Flo/Flo/Late Flo/Maturation/Flush), lignes produit + dose ml/L + fréquence, import/export CSV. Page `/recettes/schemas-engrais`.
- **Suivi du sol vivant** — timeline de préparation, amendements appliqués, coûts, âge du sol par pot. Page `/suivi-sols-vivants`.
- **Amendements** (produits engrais) — stock, dates de péremption, infos d'achat. Page `/amendements`.

## Détails techniques

- [[features/living-soil-system]] — bibliothèque de recettes LSO, préparation substrat, suivi pot
- [[api/api-recipes]] — tous les types de recettes + gestion produits engrais
- [[api/api-living-soil]] — suivi-sol-vivant + sous-événements
- [[database/database-recipes]] — modèles des 6 types de recettes + ProduitEngrais
- [[database/database-living-soil]] — SuiviSolVivant + tables de sous-suivi (réamendement, arrosage, TCO, fermentation, culture)

## Voir aussi

- [[domains/metier-cultures]] — recettes appliquées pendant le cycle de culture
