---
type: frontend
updated: 2026-04-09
sources: [frontend/src/App.tsx, frontend/src/components/Layout.tsx]
---

# Frontend Overview

React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query v5.

## Route Table

All routes are defined in `frontend/src/App.tsx`, wrapped in `<Layout>`.

| Route | Component | Page |
|---|---|---|
| `/` | Dashboard | Overview dashboard (7 modules) |
| `/culture` | Culture | Active grow cycle management |
| `/graines` | Graines | Seed catalogue |
| `/stock` | Stock | Finished product inventory |
| `/extractions` | Extractions | Rosin extractions |
| `/extractions-hash` | ExtractionsHash | Hash extractions |
| `/amendements` | Amendements | Fertilizer products |
| `/historique-cultures` | HistoriqueCultures | Past grow records |
| `/statistiques` | Statistiques | Global analytics |
| `/materiel` | Materiel | Equipment inventory |
| `/parametrage` | Parametrage | Settings + dropdowns |
| `/suivi-constantes` | SuiviConstantes | Sensor charts |
| `/suivi-sols-vivants` | SuiviSolsVivants | Living soil pots |
| `/espaces-culture` | EspacesCulture | Growing spaces |
| `/sechage-curing` | SechageCuring | Drying & curing |
| `/croisement` | Croisement | Breeding (placeholder) |
| `/plan-culture` | PlanCulture | Culture planning |
| `/preparation-substrat` | PreparationSubstrat | Substrate calculator |
| `/recettes/tco` | RecettesTCO | TCO recipes |
| `/recettes/lso` | RecettesLSO | LSO recipes |
| `/recettes/reamendement` | RecettesReamendement | Re-amendment recipes |
| `/recettes/fermentation` | RecettesFermentation | Fermentation recipes |
| `/recettes/schemas-engrais` | RecettesSchemas | Nutrient schemas (placeholder) |

## Component Hierarchy

```
App
└── Layout (sidebar nav + header)
    └── <Route component>
        └── Page-specific modals and components
```

`Layout.tsx` — responsive sidebar with navigation links + header. Brand color: `grow-600`.

## Component Directory

```
frontend/src/components/
├── Layout.tsx              ← nav shell
├── LoadingSpinner.tsx
├── EmptyState.tsx
├── StatCard.tsx            ← reusable metric card
├── ImportExportModal.tsx   ← CSV import/export dialog
├── culture/
│   ├── ActionModal.tsx           ← log a culture/plant action
│   ├── ArrosageModal.tsx         ← record watering
│   ├── CalendrierCulture.tsx     ← action timeline view
│   ├── NouvellerCultureModal.tsx ← create culture (internal/external, multi-goal, living soil)
│   ├── PlantesTab.tsx            ← plant list within a culture
│   ├── StatsTab.tsx              ← culture statistics
│   └── TransfertPlantModal.tsx   ← move plant between cultures
└── [domain modals]               ← one modal per entity type (20+ modal files)
```

## See Also

- [[frontend/pages]] — all 24 pages documented
- [[frontend/conventions]] — React Query, Tailwind, hook rules
