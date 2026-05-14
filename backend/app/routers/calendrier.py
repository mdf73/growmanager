"""Router Calendrier Global — Vue mensuelle de tous les events de toutes les cultures"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract

from app.database import get_db
from app.models import Culture, Plant, ActionCalendrier

router = APIRouter(prefix="/api/calendrier", tags=["calendrier"])


@router.get("/")
def get_calendrier(
    year: int = Query(..., description="Année (ex: 2026)"),
    month: int = Query(..., description="Mois (1-12)"),
    db: Session = Depends(get_db),
):
    """
    Retourne tous les events ActionCalendrier pour toutes les cultures
    pour le mois/année donnés.
    """
    actions = (
        db.query(ActionCalendrier)
        .filter(
            extract("year",  ActionCalendrier.date_action) == year,
            extract("month", ActionCalendrier.date_action) == month,
        )
        .order_by(ActionCalendrier.date_action)
        .all()
    )

    # Pré-charger les cultures et plantes référencées
    culture_ids = {a.id_culture for a in actions}
    plant_ids   = {a.id_plant   for a in actions if a.id_plant}

    cultures_map: dict = {}
    if culture_ids:
        cultures_db = db.query(Culture).filter(Culture.id_culture.in_(culture_ids)).all()
        for c in cultures_db:
            cultures_map[c.id_culture] = c

    plants_map: dict = {}
    if plant_ids:
        plants_db = db.query(Plant).filter(Plant.id_plant.in_(plant_ids)).all()
        for p in plants_db:
            plants_map[p.id_plant] = p

    result = []
    for a in actions:
        culture = cultures_map.get(a.id_culture)
        plant   = plants_map.get(a.id_plant) if a.id_plant else None

        result.append({
            "id_action":      a.id_action,
            "date_action":    a.date_action.isoformat() if a.date_action else None,
            "type_action":    a.type_action,
            "global_culture": a.global_culture,
            "parametres":     a.parametres,
            "note":           a.note,
            # Culture
            "id_culture":     a.id_culture,
            "culture_nom":    culture.nom if culture else f"Culture #{a.id_culture}",
            "culture_statut": culture.statut if culture else None,
            # Plant
            "id_plant":       a.id_plant,
            "plant_nom":      plant.nom_affichage if plant else None,
        })

    return result


@router.get("/cultures-actives")
def get_cultures_avec_events(db: Session = Depends(get_db)):
    """
    Retourne la liste de toutes les cultures qui ont au moins un event
    (pour construire les filtres couleur).
    """
    cultures = db.query(Culture).order_by(Culture.date_debut.desc()).all()
    return [
        {
            "id_culture":  c.id_culture,
            "nom":         c.nom or f"Culture #{c.id_culture}",
            "statut":      c.statut,
            "date_debut":  c.date_debut.isoformat() if c.date_debut else None,
            "date_fin":    c.date_fin.isoformat() if c.date_fin else None,
        }
        for c in cultures
    ]
