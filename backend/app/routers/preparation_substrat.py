"""Router Préparation substrat — CRUD historique des mélanges de sol"""
import json
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import PreparationSubstrat
from app.schemas.preparation_substrat import (
    PreparationSubstratCreate,
    PreparationSubstratRead,
)

router = APIRouter(prefix="/api/preparation-substrat", tags=["preparation-substrat"])


def _serialize(obj):
    """Sérialise les listes Pydantic en JSON string pour stockage."""
    if obj is None:
        return None
    if isinstance(obj, list):
        return json.dumps([item.dict() if hasattr(item, 'dict') else item for item in obj])
    return json.dumps(obj)


def _to_read(prep: PreparationSubstrat) -> dict:
    return {
        "id_preparation":     prep.id_preparation,
        "date_preparation":   prep.date_preparation,
        "volume_total_l":     float(prep.volume_total_l),
        "type_sol":           prep.type_sol,
        "id_recette_lso":     prep.id_recette_lso,
        "nom_recette_lso":    prep.nom_recette_lso,
        "configuration_pots": json.loads(prep.configuration_pots) if prep.configuration_pots else None,
        "resultat":           json.loads(prep.resultat) if prep.resultat else None,
        "notes":              prep.notes,
        "created_at":         prep.created_at,
    }


@router.get("/", response_model=List[PreparationSubstratRead])
def get_all(db: Session = Depends(get_db)):
    items = db.query(PreparationSubstrat).order_by(
        PreparationSubstrat.date_preparation.desc(),
        PreparationSubstrat.created_at.desc(),
    ).all()
    return [_to_read(i) for i in items]


@router.post("/", response_model=PreparationSubstratRead, status_code=201)
def create(data: PreparationSubstratCreate, db: Session = Depends(get_db)):
    prep = PreparationSubstrat(
        date_preparation   = data.date_preparation or date.today(),
        volume_total_l     = data.volume_total_l,
        type_sol           = data.type_sol,
        id_recette_lso     = data.id_recette_lso,
        nom_recette_lso    = data.nom_recette_lso,
        configuration_pots = _serialize(data.configuration_pots),
        resultat           = _serialize(data.resultat),
        notes              = data.notes,
    )
    db.add(prep)
    db.commit()
    db.refresh(prep)
    return _to_read(prep)


@router.get("/{prep_id}", response_model=PreparationSubstratRead)
def get_one(prep_id: int, db: Session = Depends(get_db)):
    prep = db.query(PreparationSubstrat).filter(
        PreparationSubstrat.id_preparation == prep_id
    ).first()
    if not prep:
        raise HTTPException(status_code=404, detail="Préparation introuvable")
    return _to_read(prep)


@router.delete("/{prep_id}", status_code=204)
def delete(prep_id: int, db: Session = Depends(get_db)):
    prep = db.query(PreparationSubstrat).filter(
        PreparationSubstrat.id_preparation == prep_id
    ).first()
    if not prep:
        raise HTTPException(status_code=404, detail="Préparation introuvable")
    db.delete(prep)
    db.commit()
