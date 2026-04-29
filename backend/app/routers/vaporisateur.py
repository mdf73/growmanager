"""Routes FastAPI pour Vaporisateurs et Consommables"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Vaporisateur, VapoConsommable
from app.schemas.vaporisateur import (
    VaporisateurCreate, VaporisateurRead,
    VapoConsommableCreate, VapoConsommableRead,
)

router = APIRouter(prefix="/api/vaporisateurs", tags=["vaporisateurs"])


# ── Utils (routes statiques AVANT /{id}) ─────────────────────────────────────

@router.get("/marques", response_model=list[str])
def get_marques(db: Session = Depends(get_db)):
    """Liste des marques existantes pour l'auto-complétion."""
    rows = db.query(Vaporisateur.marque).filter(Vaporisateur.marque != None).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


@router.get("/modeles", response_model=list[str])
def get_modeles(db: Session = Depends(get_db)):
    """Liste des modèles existants pour l'auto-complétion."""
    rows = db.query(Vaporisateur.modele).filter(Vaporisateur.modele != None).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


# ── CRUD Vaporisateurs ────────────────────────────────────────────────────────

@router.get("/", response_model=list[VaporisateurRead])
def get_vaporisateurs(db: Session = Depends(get_db)):
    return (
        db.query(Vaporisateur)
        .options(joinedload(Vaporisateur.consommables))
        .order_by(Vaporisateur.marque, Vaporisateur.modele)
        .all()
    )


@router.get("/{vapo_id}", response_model=VaporisateurRead)
def get_vaporisateur(vapo_id: int, db: Session = Depends(get_db)):
    vapo = (
        db.query(Vaporisateur)
        .options(joinedload(Vaporisateur.consommables))
        .filter(Vaporisateur.id_vaporisateur == vapo_id)
        .first()
    )
    if not vapo:
        raise HTTPException(status_code=404, detail="Vaporisateur non trouvé")
    return vapo


@router.post("/", response_model=VaporisateurRead)
def create_vaporisateur(data: VaporisateurCreate, db: Session = Depends(get_db)):
    vapo = Vaporisateur(**data.model_dump())
    db.add(vapo)
    db.commit()
    db.refresh(vapo)
    return vapo


@router.put("/{vapo_id}", response_model=VaporisateurRead)
def update_vaporisateur(vapo_id: int, data: VaporisateurCreate, db: Session = Depends(get_db)):
    vapo = db.query(Vaporisateur).filter(Vaporisateur.id_vaporisateur == vapo_id).first()
    if not vapo:
        raise HTTPException(status_code=404, detail="Vaporisateur non trouvé")
    for field, value in data.model_dump().items():
        setattr(vapo, field, value)
    db.commit()
    db.refresh(vapo)
    return vapo


@router.delete("/{vapo_id}")
def delete_vaporisateur(vapo_id: int, db: Session = Depends(get_db)):
    vapo = db.query(Vaporisateur).filter(Vaporisateur.id_vaporisateur == vapo_id).first()
    if not vapo:
        raise HTTPException(status_code=404, detail="Vaporisateur non trouvé")
    db.delete(vapo)
    db.commit()
    return {"message": "Vaporisateur supprimé"}


@router.post("/{vapo_id}/session")
def increment_session(vapo_id: int, db: Session = Depends(get_db)):
    """Incrémente le compteur de sessions du vaporisateur."""
    vapo = db.query(Vaporisateur).filter(Vaporisateur.id_vaporisateur == vapo_id).first()
    if not vapo:
        raise HTTPException(status_code=404, detail="Vaporisateur non trouvé")
    vapo.nbr_sessions = (vapo.nbr_sessions or 0) + 1
    db.commit()
    return {"nbr_sessions": vapo.nbr_sessions}


# ── CRUD Consommables ────────────────────────────────────────────────────────

@router.get("/{vapo_id}/consommables", response_model=list[VapoConsommableRead])
def get_consommables(vapo_id: int, db: Session = Depends(get_db)):
    return (
        db.query(VapoConsommable)
        .filter(VapoConsommable.id_vaporisateur == vapo_id)
        .order_by(VapoConsommable.date_achat.desc())
        .all()
    )


@router.post("/consommables", response_model=VapoConsommableRead)
def create_consommable(data: VapoConsommableCreate, db: Session = Depends(get_db)):
    conso = VapoConsommable(**data.model_dump())
    db.add(conso)
    db.commit()
    db.refresh(conso)
    return conso


@router.put("/consommables/{conso_id}", response_model=VapoConsommableRead)
def update_consommable(conso_id: int, data: VapoConsommableCreate, db: Session = Depends(get_db)):
    conso = db.query(VapoConsommable).filter(VapoConsommable.id_consommable == conso_id).first()
    if not conso:
        raise HTTPException(status_code=404, detail="Consommable non trouvé")
    for field, value in data.model_dump().items():
        setattr(conso, field, value)
    db.commit()
    db.refresh(conso)
    return conso


@router.delete("/consommables/{conso_id}")
def delete_consommable(conso_id: int, db: Session = Depends(get_db)):
    conso = db.query(VapoConsommable).filter(VapoConsommable.id_consommable == conso_id).first()
    if not conso:
        raise HTTPException(status_code=404, detail="Consommable non trouvé")
    db.delete(conso)
    db.commit()
    return {"message": "Consommable supprimé"}
