"""Routes FastAPI pour Vaporisateurs et Consommables"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Vaporisateur, VapoConsommable, Stock, Variete
from app.schemas.vaporisateur import (
    VaporisateurCreate, VaporisateurRead,
    VapoConsommableCreate, VapoConsommableRead,
)

router = APIRouter(prefix="/api/vaporisateurs", tags=["vaporisateurs"])


# -- Schemas locaux -----------------------------------------------------------

class SessionBody(BaseModel):
    id_stock:   Optional[int]   = None
    quantite_g: Optional[float] = None


class StockVapoRead(BaseModel):
    id_stock:       int
    type_stock:     Optional[str]
    id_variete:     Optional[int]
    variete_nom:    Optional[str]
    quantite_stock: float
    maillage:       Optional[str]
    type_hash:      Optional[str]
    type_rosin:     Optional[str]

    class Config:
        from_attributes = True


# -- Routes statiques AVANT /{id} --------------------------------------------

@router.get("/stocks-vapo", response_model=list[StockVapoRead])
def get_stocks_vapo(db: Session = Depends(get_db)):
    TYPES_VAPO = ("Fleur", "Hash", "Rosin", "Trim", "WPFF", "Poussière")
    rows = (
        db.query(Stock)
        .filter(
            Stock.type_stock.in_(TYPES_VAPO),
            Stock.quantite_stock > 0,
            Stock.date_fin_stock.is_(None),
        )
        .order_by(Stock.type_stock, Stock.date_stock.desc())
        .all()
    )
    result = []
    for s in rows:
        variete_nom = None
        if s.id_variete:
            v = db.query(Variete).filter(Variete.id_variete == s.id_variete).first()
            variete_nom = v.nom_variete if v else None
        result.append(StockVapoRead(
            id_stock=s.id_stock,
            type_stock=s.type_stock,
            id_variete=s.id_variete,
            variete_nom=variete_nom,
            quantite_stock=float(s.quantite_stock),
            maillage=s.maillage,
            type_hash=s.type_hash,
            type_rosin=s.type_rosin,
        ))
    return result


@router.get("/marques", response_model=list[str])
def get_marques(db: Session = Depends(get_db)):
    rows = db.query(Vaporisateur.marque).filter(Vaporisateur.marque != None).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


@router.get("/modeles", response_model=list[str])
def get_modeles(db: Session = Depends(get_db)):
    rows = db.query(Vaporisateur.modele).filter(Vaporisateur.modele != None).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


# -- CRUD Vaporisateurs -------------------------------------------------------

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
        raise HTTPException(status_code=404, detail="Vaporisateur non trouve")
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
        raise HTTPException(status_code=404, detail="Vaporisateur non trouve")
    for field, value in data.model_dump().items():
        setattr(vapo, field, value)
    db.commit()
    db.refresh(vapo)
    return vapo


@router.delete("/{vapo_id}")
def delete_vaporisateur(vapo_id: int, db: Session = Depends(get_db)):
    vapo = db.query(Vaporisateur).filter(Vaporisateur.id_vaporisateur == vapo_id).first()
    if not vapo:
        raise HTTPException(status_code=404, detail="Vaporisateur non trouve")
    db.delete(vapo)
    db.commit()
    return {"message": "Vaporisateur supprime"}


@router.post("/{vapo_id}/session")
def increment_session(vapo_id: int, body: SessionBody = SessionBody(), db: Session = Depends(get_db)):
    vapo = db.query(Vaporisateur).filter(Vaporisateur.id_vaporisateur == vapo_id).first()
    if not vapo:
        raise HTTPException(status_code=404, detail="Vaporisateur non trouve")
    vapo.nbr_sessions = (vapo.nbr_sessions or 0) + 1
    if body.id_stock and body.quantite_g:
        stock = db.query(Stock).filter(Stock.id_stock == body.id_stock).first()
        if not stock:
            raise HTTPException(status_code=404, detail="Stock non trouve")
        if stock.date_fin_stock is not None:
            raise HTTPException(status_code=400, detail="Ce stock est deja epuise")
        nouvelle_quantite = float(stock.quantite_stock) - body.quantite_g
        if nouvelle_quantite < 0:
            raise HTTPException(status_code=400, detail="Quantite insuffisante")
        stock.quantite_stock = round(nouvelle_quantite, 3)
        if stock.quantite_stock <= 0:
            stock.quantite_stock = 0
            stock.date_fin_stock = date.today()
    db.commit()
    return {"nbr_sessions": vapo.nbr_sessions}


# -- CRUD Consommables --------------------------------------------------------

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
        raise HTTPException(status_code=404, detail="Consommable non trouve")
    for field, value in data.model_dump().items():
        setattr(conso, field, value)
    db.commit()
    db.refresh(conso)
    return conso


@router.delete("/consommables/{conso_id}")
def delete_consommable(conso_id: int, db: Session = Depends(get_db)):
    conso = db.query(VapoConsommable).filter(VapoConsommable.id_consommable == conso_id).first()
    if not conso:
        raise HTTPException(status_code=404, detail="Consommable non trouve")
    db.delete(conso)
    db.commit()
    return {"message": "Consommable supprime"}
