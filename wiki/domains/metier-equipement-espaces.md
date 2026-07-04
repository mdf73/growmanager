---
type: domain
updated: 2026-07-04
---

# 🔧 Équipement & Espaces

Le matériel physique (box, lampes, pots, ventilation...) et les espaces de culture.

## Ce que ça fait

- **Espaces de culture** — dimensions, surface, équipement assigné, statut (Actif/Inactif/Maintenance). Page `/espaces-culture`.
- **Matériel** — inventaire par catégorie (box, lampe, pot, irrigation, ventilation, bocal, presse, sacs...), âge, date d'achat. Création en lot avec calcul auto du prix unitaire. Page `/materiel`.
- **Paramétrage** — gestion des listes déroulantes configurables (types de marque, lampe, matériau de pot, bocal, catégories d'équipement...) + config des capteurs Govee. Page `/parametrage`.

## Détails techniques

- [[api/api-infrastructure]] — espaces, matériel, paramètres, fournisseurs, import/export
- [[database/database-equipment]] — Box, Lampe, Pot, Irrigation, Ventilation, Bocal, Press, RosinBag, IceOBag, Materiel, Marque, ParametreListeValeur
- [[database/database-spaces]] — EspaceCulture, EspaceMateriel

## Voir aussi

- [[domains/metier-capteurs]] — capteurs Govee associés aux espaces
