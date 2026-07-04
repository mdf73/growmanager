---
type: domain
updated: 2026-07-04
---

# 🌱 Cultures & Cycle de vie

Tout ce qui concerne la conduite d'une culture, du plan de départ jusqu'à la récolte, le séchage et le curing.

## Ce que ça fait

- **Planifier une culture** — choisir un espace, des pots, des variétés depuis le catalogue de graines, simuler une fenêtre de récolte estimée. Page `/plan-culture`.
- **Préparer le substrat** — calculateur d'expansion coco, config des pots, choix d'une recette LSO, historique des préparations. Page `/preparation-substrat`.
- **Suivre une culture active** — plantes groupées par variété, calendrier d'actions par jour (avec courbes capteurs du jour), stats (rendement, coût, g/W), arrosages. Page `/culture`.
- **Séchage & Curing** — poids, dates, T°/humidité, burping recommandé selon le stade. Page `/sechage-curing`.
- **Historique** — archive consultable des cultures terminées. Page `/historique-cultures`.
- **Comparer des cultures côte à côte** — jusqu'à 3 cultures, tableau comparatif complet + graphiques hauteurs/arrosages cumulés. Page `/comparaison-cultures`.
- **Calendrier global** — vue mensuelle tous events toutes cultures, export PDF jour par jour, photos et courbes capteurs intégrées. Page `/calendrier`.
- **Classement des variétés** — notation culture (/30) + consommation (/70), export CSV. Page `/classement-varietes`.

## Détails techniques

- [[features/plant-lifecycle]] — statuts plante : germination → veg → floraison → séchage → curing → prête/récolte/abandonnée
- [[features/culture-lifecycle]] — statuts culture : active → séchage_curing → terminée
- [[api/api-cultures]] — endpoints cultures, plantes, actions
- [[api/api-planning]] — plan-culture, préparation-substrat, historique
- [[api/api-calendrier]] — calendrier global, export
- [[database/database-culture]] — modèles Culture, Plant, ActionCalendrier
- [[database/database-planning]] — PlanCulture, PlanCultureVariete, PreparationSubstrat, HistoriqueCulture/Plant
- [[database/database-spaces]] — EspaceCulture

## Voir aussi

- [[domains/metier-graines]] — variétés utilisées dans les plans de culture
- [[domains/metier-recettes-sol-vivant]] — recettes appliquées pendant le cycle
- [[domains/metier-capteurs]] — courbes T°/humidité/VPD affichées dans le calendrier
