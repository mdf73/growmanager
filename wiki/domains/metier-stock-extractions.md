---
type: domain
updated: 2026-07-04
---

# 📦 Stock & Extractions

Le produit fini : stock de fleurs/hash/rosin, et les sessions d'extraction.

## Ce que ça fait

- **Stock** — inventaire produit fini, tri par variété/type/bocal/quantité/âge, action "sortie" pour marquer un bocal consommé. Page `/stock`.
- **Extractions rosin** — sessions de presse : rendement %, température, mesh, poids des sachets, nombre de passes, stats globales. Page `/extractions`.
- **Extractions hash** — sessions Polinator / Ice-o-lator : passages, sachets, rendement. Page `/extractions-hash`.

## Détails techniques

- [[api/stock-extractions]] — stock, extractions rosin + hash, stats dashboard
- [[database/stock]] — modèles Stock, Recolte, RosinExtraction, HashExtraction

## Voir aussi

- [[domains/metier-cultures]] — récoltes qui alimentent le stock
