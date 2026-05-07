"""Routers pour Breeder - CRUD complet"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Breeder, Graine
from app.schemas.breeder import BreederCreate, BreederRead

router = APIRouter(prefix="/api/breeders", tags=["breeders"])


@router.get("/", response_model=list[BreederRead])
def get_breeders(db: Session = Depends(get_db)):
    """Récupère tous les breeders"""
    return db.query(Breeder).all()


@router.get("/{breeder_id}", response_model=BreederRead)
def get_breeder(breeder_id: int, db: Session = Depends(get_db)):
    """Récupère un breeder par ID"""
    breeder = db.query(Breeder).filter(Breeder.id_breeder == breeder_id).first()
    if not breeder:
        raise HTTPException(status_code=404, detail="Breeder non trouvé")
    return breeder


@router.post("/", response_model=BreederRead)
def create_breeder(breeder: BreederCreate, db: Session = Depends(get_db)):
    """Crée un nouveau breeder"""
    db_breeder = Breeder(
        nom_breeder=breeder.nom_breeder,
        origine_breeder=breeder.origine_breeder,
        information_breeder=breeder.information_breeder,
    )
    db.add(db_breeder)
    db.commit()
    db.refresh(db_breeder)
    return db_breeder


@router.put("/{breeder_id}", response_model=BreederRead)
def update_breeder(
    breeder_id: int, breeder: BreederCreate, db: Session = Depends(get_db)
):
    """Met à jour un breeder"""
    db_breeder = db.query(Breeder).filter(Breeder.id_breeder == breeder_id).first()
    if not db_breeder:
        raise HTTPException(status_code=404, detail="Breeder non trouvé")

    db_breeder.nom_breeder = breeder.nom_breeder
    db_breeder.origine_breeder = breeder.origine_breeder
    db_breeder.information_breeder = breeder.information_breeder

    db.commit()
    db.refresh(db_breeder)
    return db_breeder


@router.delete("/{breeder_id}")
def delete_breeder(breeder_id: int, db: Session = Depends(get_db)):
    """Supprime un breeder"""
    db_breeder = db.query(Breeder).filter(Breeder.id_breeder == breeder_id).first()
    if not db_breeder:
        raise HTTPException(status_code=404, detail="Breeder non trouvé")

    # Vérifier qu'aucune graine n'est liée à ce breeder
    nb_graines = db.query(Graine).filter(Graine.id_breeder == breeder_id).count()
    if nb_graines:
        raise HTTPException(
            status_code=400,
            detail=f"Breeder lié à {nb_graines} graine(s), suppression bloquée"
        )

    db.delete(db_breeder)
    db.commit()
    return {"message": "Breeder supprimé"}
