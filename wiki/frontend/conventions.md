---
type: frontend
updated: 2026-05-25
sources: [Documentation/claude.md, frontend/src/api/client.ts]
---

# Frontend Conventions

## Styling

**Brand color:** `grow-600` (custom Tailwind color — use everywhere brand color needed)

Tailwind utility classes throughout. No CSS modules or styled-components.

## React Query (TanStack Query v5)

All server state is managed via React Query. Pattern:

```typescript
// Read
const { data, isLoading } = useQuery({
  queryKey: ['cultures'],
  queryFn: () => getCultures(),
})

// Write + invalidate
const qc = useQueryClient()
const mutation = useMutation({
  mutationFn: (data) => createCulture(data),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['cultures'] })
  },
})
```

**Rule:** Always invalidate relevant query keys after mutations. Stale cache = stale UI.

## React Hooks Rules

**Rule:** Never call hooks inside switch/case, if blocks, or loops. Always at top level of component.

```typescript
// WRONG
if (condition) {
  const [state, setState] = useState(...)  // ← breaks rules of hooks
}

// CORRECT
const [state, setState] = useState(...)
// Then use condition in the body
```

## Axios Client

Base client in `frontend/src/api/client.ts`:
- Base URL: `/api` (proxied to backend:8000 via Vite)
- Error interceptor: logs errors, re-throws for React Query to handle

All API files use this shared client instance.

## File Structure Conventions

One API client file per backend domain:
```
api/
├── client.ts        ← shared Axios instance
├── cultures.ts      ← all culture + plant + action calls
├── graines.ts       ← seeds + packs + catalogue
└── ...
```

One page per route, modals co-located as separate files:
```
pages/Culture.tsx          ← page component
components/culture/        ← culture-specific components/modals
components/NouveauXxxModal.tsx  ← entity creation modals
```

## TypeScript

All API types are defined in the API client files (not in a separate `types/` directory).

Return types from API calls are inlined as TypeScript interfaces in each `api/*.ts` file.

## Common Components

| Component | Use |
|---|---|
| `StatCard` | Metric display cards on Dashboard and Stats tabs |
| `LoadingSpinner` | Loading state |
| `EmptyState` | Empty list state (no data) |
| `ImportExportModal` | CSV import/export for any entity |

## Tri des listes déroulantes

**Règle :** Toutes les listes déroulantes (`<select>`) alimentées par des données dynamiques (API) doivent être triées alphabétiquement à l'affichage, jamais dans l'ordre d'insertion en base.

Pattern à utiliser (ne pas muter le tableau original) :

```tsx
{[...items].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })).map(item => (
  <option key={item.id} value={item.id}>{item.nom}</option>
))}
```

**Localisation :** `'fr'` + `sensitivity: 'base'` → insensible à la casse et aux accents.

**Fichiers appliqués :**
- `NouveauPackModal.tsx` — breeders, variétés, fournisseurs
- `Croisement.tsx` — variétés, pollen stock
- `SuiviSolVivantModal.tsx` — recettes LSO, réamendement, engrais, TCO, fermentation

---

## See Also

- [[frontend/frontend-overview]] — routing and component structure
- [[frontend/pages]] — all pages
- [[architecture/patterns]] — React Query invalidation pattern
