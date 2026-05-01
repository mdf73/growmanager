"""Router CRUD pour HistoriqueCulture + HistoriquePlant"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func

from app.database import get_db
from app.models.all_models import HistoriqueCulture, HistoriquePlant, Graine, Variete
from app.schemas.historique_culture import (
    HistoriqueCultureCreate, HistoriqueCultureRead, HistoriqueCultureUpdate,
    HistoriquePlantCreate, HistoriquePlantRead,
)

router = APIRouter(prefix="/api/historique-cultures", tags=["historique_culture"])


# ─────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────

def _enrich(row: HistoriqueCulture) -> HistoriqueCultureRead:
    """Ajoute les champs calculés à la lecture d'une culture."""
    obj = HistoriqueCultureRead.model_validate(row)

    # Durée
    if row.date_debut and row.date_fin:
        obj.duree_jours = max((row.date_fin - row.date_debut).days, 0)

    # Agrégats plantes
    obj.nb_plants = len(row.plants)

    recoltes = [float(p.quantite_recoltee) for p in row.plants if p.quantite_recoltee is not None]
    prix     = [float(p.prix_graine)       for p in row.plants if p.prix_graine       is not None]

    obj.quantite_totale    = round(sum(recoltes), 2) if recoltes else None
    obj.prix_total_graines = round(sum(prix),     2) if prix     else None

    if obj.quantite_totale and row.puissance and row.puissance > 0:
        obj.g_par_watt = round(obj.quantite_totale / float(row.puissance), 3)

    # Coûts (stockés en DB)
    if row.cout_engrais      is not None: obj.cout_engrais     = float(row.cout_engrais)
    if row.cout_electricite  is not None: obj.cout_electricite = float(row.cout_electricite)
    if row.cout_graines      is not None: obj.cout_graines     = float(row.cout_graines)
    if row.cout_total        is not None: obj.cout_total       = float(row.cout_total)
    if row.cout_par_gramme   is not None: obj.cout_par_gramme  = float(row.cout_par_gramme)

    # Label variétés (dédupliqué, trié)
    noms = list(dict.fromkeys(
        p.variete_nom for p in row.plants if p.variete_nom
    ))
    obj.varietes_label = ", ".join(noms) if noms else "—"

    return obj


def _load(db: Session, id_: int) -> HistoriqueCulture:
    row = (
        db.query(HistoriqueCulture)
        .options(selectinload(HistoriqueCulture.plants))
        .filter(HistoriqueCulture.id_historique_culture == id_)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Culture introuvable")
    return row


# ─────────────────────────────────────────
# Prix graine pour une variété
# ─────────────────────────────────────────

@router.get("/prix-graine/{id_variete}")
def get_prix_graine(id_variete: int, db: Session = Depends(get_db)):
    """
    Retourne le prix moyen d'une graine pour une variété donnée.
    Cherche dans les graines non utilisées, ou toutes si aucune dispo.
    """
    # Graines non utilisées en priorité
    q = db.query(func.avg(Graine.prix_achat)).filter(
        Graine.id_variete == id_variete,
        Graine.prix_achat.isnot(None),
        Graine.utilisee == False,
    ).scalar()

    if q is None:
        # Sinon toutes les graines
        q = db.query(func.avg(Graine.prix_achat)).filter(
            Graine.id_variete == id_variete,
            Graine.prix_achat.isnot(None),
        ).scalar()

    return {"prix_graine": float(q) if q is not None else None}


# ─────────────────────────────────────────
# CRUD Cultures
# ─────────────────────────────────────────

@router.get("", response_model=List[HistoriqueCultureRead])
def get_all(db: Session = Depends(get_db)):
    rows = (
        db.query(HistoriqueCulture)
        .options(selectinload(HistoriqueCulture.plants))
        .order_by(HistoriqueCulture.date_debut.desc())
        .all()
    )
    return [_enrich(r) for r in rows]


@router.get("/{id_historique_culture}", response_model=HistoriqueCultureRead)
def get_one(id_historique_culture: int, db: Session = Depends(get_db)):
    return _enrich(_load(db, id_historique_culture))


@router.post("", response_model=HistoriqueCultureRead, status_code=201)
def create(payload: HistoriqueCultureCreate, db: Session = Depends(get_db)):
    culture_data = payload.model_dump(exclude={"plants"}, exclude_unset=True)
    culture = HistoriqueCulture(**culture_data)
    db.add(culture)
    db.flush()  # génère l'id sans commit

    # Insérer les plantes
    for i, p in enumerate(payload.plants, start=1):
        plant_data = p.model_dump(exclude_unset=True)
        if "numero_plant" not in plant_data:
            plant_data["numero_plant"] = i
        # Dénormaliser variete_nom si non fourni mais id_variete présent
        if not plant_data.get("variete_nom") and plant_data.get("id_variete"):
            v = db.query(Variete).filter(Variete.id_variete == plant_data["id_variete"]).first()
            if v:
                plant_data["variete_nom"] = v.nom_variete
        plant = HistoriquePlant(id_historique_culture=culture.id_historique_culture, **plant_data)
        db.add(plant)

    db.commit()
    return _enrich(_load(db, culture.id_historique_culture))


@router.patch("/{id_historique_culture}", response_model=HistoriqueCultureRead)
def update(
    id_historique_culture: int,
    payload: HistoriqueCultureUpdate,
    db: Session = Depends(get_db),
):
    row = _load(db, id_historique_culture)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    return _enrich(_load(db, id_historique_culture))


@router.delete("/{id_historique_culture}", status_code=204)
def delete(id_historique_culture: int, db: Session = Depends(get_db)):
    row = _load(db, id_historique_culture)
    db.delete(row)
    db.commit()


# ─────────────────────────────────────────
# CRUD Plants (ajout / suppression sur une culture existante)
# ─────────────────────────────────────────

@router.post("/{id_historique_culture}/plants", response_model=HistoriquePlantRead, status_code=201)
def add_plant(
    id_historique_culture: int,
    payload: HistoriquePlantCreate,
    db: Session = Depends(get_db),
):
    _load(db, id_historique_culture)   # vérifie que la culture existe
    data = payload.model_dump(exclude_unset=True)

    if not data.get("variete_nom") and data.get("id_variete"):
        v = db.query(Variete).filter(Variete.id_variete == data["id_variete"]).first()
        if v:
            data["variete_nom"] = v.nom_variete

    if "numero_plant" not in data:
        max_num = db.query(func.max(HistoriquePlant.numero_plant)).filter(
            HistoriquePlant.id_historique_culture == id_historique_culture
        ).scalar() or 0
        data["numero_plant"] = max_num + 1

    plant = HistoriquePlant(id_historique_culture=id_historique_culture, **data)
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return plant


@router.delete("/{id_historique_culture}/plants/{id_historique_plant}", status_code=204)
def delete_plant(
    id_historique_culture: int,
    id_historique_plant: int,
    db: Session = Depends(get_db),
):
    plant = db.query(HistoriquePlant).filter(
        HistoriquePlant.id_historique_plant   == id_historique_plant,
        HistoriquePlant.id_historique_culture == id_historique_culture,
    ).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plante introuvable")
    db.delete(plant)
    db.commit()
