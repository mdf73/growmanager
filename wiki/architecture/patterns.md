---
type: architecture
updated: 2026-04-09
sources: [main.py, routers/cultures.py, Documentation/claude.md]
---

# Architecture — Key Patterns

## 1. Database Migrations (No Alembic)

Tables are created via SQLAlchemy `metadata.create_all()` at startup.

New columns are added via raw SQL in `run_migrations()` in `main.py`:

```python
# Pattern: check INFORMATION_SCHEMA before altering
result = db.execute(text("""
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'growmanager'
    AND TABLE_NAME = 'mytable'
    AND COLUMN_NAME = 'my_column'
""")).scalar()

if result == 0:
    db.execute(text("ALTER TABLE mytable ADD COLUMN my_column VARCHAR(255)"))
    db.commit()
```

**Rule:** Never use Alembic. Every schema change goes through this pattern.

## 2. Router Enrichment Pattern

FastAPI routers don't just return raw ORM objects — they enrich them with related data before returning:

```python
# Example: culture router returns enriched plant data
plants = db.query(Plant).filter(Plant.id_culture == culture_id).all()
result = []
for plant in plants:
    plant_data = {
        **plant.__dict__,
        "variete_nom": plant.graine.variete.nom_variete if plant.graine else None,
        "breeder_nom": plant.graine.breeder.nom_breeder if plant.graine else None,
    }
    result.append(plant_data)
```

This keeps the frontend simple — it always gets fully-hydrated objects.

## 3. Static Routes Before Dynamic Routes

In every FastAPI router, static paths must be declared **before** parameterized ones:

```python
# CORRECT
@router.get("/utils/nb-pots")   # static — must come first
@router.get("/{plan_id}")       # dynamic — comes after

# WRONG — FastAPI would match "/utils/nb-pots" as /{plan_id}
@router.get("/{plan_id}")
@router.get("/utils/nb-pots")
```

**Rule:** Any `/utils/...` or other fixed-path endpoint must be declared before `/{id}`.

## 4. M2M Association Tables

Many entities have many-to-many relationships via explicit association tables:

- `CultureGraine` — which seeds are in a culture
- `CultureLampe`, `CulturePot`, `CultureIrrigation`, `CultureVentilation` — equipment used per culture
- `CultureEngrais` — fertilizers used per culture
- `RecolteCulture`, `RecolteGraine` — harvest records

These are plain SQLAlchemy `Table` objects (not models with their own class), used as `secondary=` in relationships.

## 5. JSON Columns

Complex or variable-length data is stored as JSON columns rather than normalized tables:

- `ActionCalendrier.parametres` — action parameters (varies by action type)
- `HashExtraction.passages`, `.sacs` — polinator/ice-o-lator pass data
- `PreparationSubstrat.configuration_pots`, `.resultat` — pot layout results
- `Materiel.caracteristiques` — equipment specs (varies by category)
- `Plant.id_recette_sol` — nullable FK to living soil recipe

## 6. Soft Deletes / Date Flags

Stock and equipment use date fields to mark "consumed" state rather than hard deletes:

- `Stock.date_fin_stock` — set when stock is used up (not deleted from DB)
- `Materiel.date_sortie_stock` — set when equipment is retired

This preserves history for statistics.

## 7. ActionCalendrier Type Flexibility

`ActionCalendrier.type_action` was originally an ENUM but was converted to `VARCHAR` via migration to allow arbitrary action types. Known action types include:

`graine_germee`, `debut_croissance`, `debut_floraison`, `passage_12_12`, `arrosage_eau`, `arrosage_engrais`, `taille`, `defoliation`, `recolte`, `observations`, `traitement`

The `global_culture` boolean flag marks whether an action applies to the whole culture vs. a single plant.

## 8. React Query Invalidation

After any mutation (POST/PUT/DELETE), the frontend must invalidate the relevant query keys:

```typescript
const qc = useQueryClient()
mutation.onSuccess(() => {
  qc.invalidateQueries({ queryKey: ['cultures'] })
  qc.invalidateQueries({ queryKey: ['plants', cultureId] })
})
```

## 9. Pot Count Formula

Used in culture planning to calculate how many pots fit in a grow space:

```python
nb_pots = round(surface_m2 * 20.8 * volume_l ** -0.59)
```

Calibrated for a 120×120cm space:
- 1L → 30 pots, 5.5L → 14, 11L → 12, 16L → 9, 35L → 4, 50L → 3

## See Also

- [[architecture/stack]] — tech stack
- [[architecture/decisions]] — why specific choices were made
- [[database/database-overview]] — all tables
- [[features/culture-lifecycle]] — culture status flow
