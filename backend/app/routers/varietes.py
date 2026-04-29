"""Routers pour Variete - CRUD complet"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Variete
from app.schemas.variete import VarieteCreate, VarieteRead

router = APIRouter(prefix="/api/varietes", tags=["varietes"])


@router.get("/", response_model=list[VarieteRead])
def get_varietes(db: Session = Depends(get_db)):
    """Récupère toutes les variétés"""
    return db.query(Variete).all()


@router.get("/{variete_id}", response_model=VarieteRead)
def get_variete(variete_id: int, db: Session = Depends(get_db)):
    """Récupère une variété par ID"""
    variete = db.query(Variete).filter(Variete.id_variete == variete_id).first()
    if not variete:
        raise HTTPException(status_code=404, detail="Variété non trouvée")
    return variete


@router.post("/", response_model=VarieteRead)
def create_variete(variete: VarieteCreate, db: Session = Depends(get_db)):
    """Crée une nouvelle variété"""
    db_variete = Variete(
        nom_variete=variete.nom_variete,
        croisement_variete=variete.croisement_variete,
        informations_variete=variete.informations_variete,
        lien_web=variete.lien_web,
    )
    db.add(db_variete)
    db.commit()
    db.refresh(db_variete)
    return db_variete


@router.put("/{variete_id}", response_model=VarieteRead)
def update_variete(
    variete_id: int, variete: VarieteCreate, db: Session = Depends(get_db)
):
    """Met à jour une variété"""
    db_variete = db.query(Variete).filter(Variete.id_variete == variete_id).first()
    if not db_variete:
        raise HTTPException(status_code=404, detail="Variété non trouvée")

    db_variete.nom_variete = variete.nom_variete
    db_variete.croisement_variete = variete.croisement_variete
    db_variete.informations_variete = variete.informations_variete
    db_variete.lien_web = variete.lien_web

    db.commit()
    db.refresh(db_variete)
    return db_variete


@router.delete("/{variete_id}")
def delete_variete(variete_id: int, db: Session = Depends(get_db)):
    """Supprime une variété"""
    db_variete = db.query(Variete).filter(Variete.id_variete == variete_id).first()
    if not db_variete:
        raise HTTPException(status_code=404, detail="Variété non trouvée")

    db.delete(db_variete)
    db.commit()
    return {"message": "Variété supprimée"}
