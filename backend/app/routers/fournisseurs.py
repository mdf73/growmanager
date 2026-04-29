"""Routers pour Fournisseur - CRUD complet"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Fournisseur
from app.schemas.fournisseur import FournisseurCreate, FournisseurRead

router = APIRouter(prefix="/api/fournisseurs", tags=["fournisseurs"])


@router.get("/", response_model=list[FournisseurRead])
def get_fournisseurs(db: Session = Depends(get_db)):
    """Récupère tous les fournisseurs"""
    return db.query(Fournisseur).order_by(Fournisseur.nom_fournisseur).all()


@router.get("/{fournisseur_id}", response_model=FournisseurRead)
def get_fournisseur(fournisseur_id: int, db: Session = Depends(get_db)):
    """Récupère un fournisseur par ID"""
    f = db.query(Fournisseur).filter(Fournisseur.id_fournisseur == fournisseur_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")
    return f


@router.post("/", response_model=FournisseurRead)
def create_fournisseur(fournisseur: FournisseurCreate, db: Session = Depends(get_db)):
    """Crée un nouveau fournisseur"""
    db_f = Fournisseur(
        nom_fournisseur=fournisseur.nom_fournisseur,
        site_web=fournisseur.site_web,
    )
    db.add(db_f)
    db.commit()
    db.refresh(db_f)
    return db_f


@router.put("/{fournisseur_id}", response_model=FournisseurRead)
def update_fournisseur(
    fournisseur_id: int, fournisseur: FournisseurCreate, db: Session = Depends(get_db)
):
    """Met à jour un fournisseur"""
    db_f = db.query(Fournisseur).filter(Fournisseur.id_fournisseur == fournisseur_id).first()
    if not db_f:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")

    db_f.nom_fournisseur = fournisseur.nom_fournisseur
    db_f.site_web = fournisseur.site_web

    db.commit()
    db.refresh(db_f)
    return db_f


@router.delete("/{fournisseur_id}")
def delete_fournisseur(fournisseur_id: int, db: Session = Depends(get_db)):
    """Supprime un fournisseur"""
    db_f = db.query(Fournisseur).filter(Fournisseur.id_fournisseur == fournisseur_id).first()
    if not db_f:
        raise HTTPException(status_code=404, detail="Fournisseur non trouvé")

    db.delete(db_f)
    db.commit()
    return {"message": "Fournisseur supprimé"}
