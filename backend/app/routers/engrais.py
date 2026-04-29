"""Router Sols & Engrais — CRUD produits engrais/amendements"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import ProduitEngrais, AchatEngrais
from app.schemas.engrais import (
    ProduitEngraisCreate, ProduitEngraisUpdate, ProduitEngraisRead,
    AchatEngraisRead, RechargePayload,
)

router = APIRouter(prefix="/api/engrais", tags=["engrais"])


@router.get("/", response_model=List[ProduitEngraisRead])
def get_all(db: Session = Depends(get_db)):
    return db.query(ProduitEngrais).order_by(ProduitEngrais.nom_produit).all()


@router.get("/{produit_id}", response_model=ProduitEngraisRead)
def get_one(produit_id: int, db: Session = Depends(get_db)):
    row = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == produit_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return row


@router.post("/", response_model=ProduitEngraisRead, status_code=201)
def create(payload: ProduitEngraisCreate, db: Session = Depends(get_db)):
    row = ProduitEngrais(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{produit_id}", response_model=ProduitEngraisRead)
def update(produit_id: int, payload: ProduitEngraisUpdate, db: Session = Depends(get_db)):
    row = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == produit_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{produit_id}", status_code=204)
def delete(produit_id: int, db: Session = Depends(get_db)):
    row = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == produit_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    db.delete(row)
    db.commit()


# ── Gestion du stock ──────────────────────────────────────────────────────────

@router.get("/{produit_id}/achats", response_model=List[AchatEngraisRead])
def get_achats(produit_id: int, db: Session = Depends(get_db)):
    """Retourne l'historique des achats d'un produit."""
    prod = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == produit_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return (
        db.query(AchatEngrais)
        .filter(AchatEngrais.id_produit == produit_id)
        .order_by(AchatEngrais.date_achat.desc(), AchatEngrais.id_achat.desc())
        .all()
    )


@router.post("/{produit_id}/recharger", response_model=ProduitEngraisRead)
def recharger(produit_id: int, payload: RechargePayload, db: Session = Depends(get_db)):
    """
    Enregistre un nouvel achat et ajoute son volume au stock existant.
    Met aussi à jour les infos du dernier achat (prix, dates, conditionnement).
    """
    prod = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == produit_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    # Créer l'entrée historique
    achat = AchatEngrais(
        id_produit      = produit_id,
        date_achat      = payload.date_achat,
        volume_achat    = payload.volume_achat,
        unite_volume    = payload.unite_volume,
        prix_achat      = payload.prix_achat,
        date_peremption = payload.date_peremption,
        conditionnement = payload.conditionnement,
        notes           = payload.notes,
    )
    db.add(achat)

    # Ajouter le volume au stock existant (même unité supposée)
    if payload.volume_achat is not None:
        stock_actuel = float(prod.quantite_stock or 0)
        prod.quantite_stock = stock_actuel + float(payload.volume_achat)

    # Mettre à jour les infos du produit avec cet achat
    if payload.prix_achat      is not None: prod.prix_achat      = payload.prix_achat
    if payload.date_achat      is not None: prod.date_achat      = payload.date_achat
    if payload.date_peremption is not None: prod.date_peremption = payload.date_peremption
    if payload.conditionnement is not None: prod.conditionnement = payload.conditionnement
    if payload.volume_achat    is not None: prod.volume_conditionnement = payload.volume_achat
    if payload.unite_volume    is not None:
        prod.unite_volume    = payload.unite_volume
        prod.unite_quantite  = payload.unite_volume  # même unité pour le stock

    db.commit()
    db.refresh(prod)
    return prod


@router.post("/{produit_id}/vider-stock", response_model=ProduitEngraisRead)
def vider_stock(produit_id: int, db: Session = Depends(get_db)):
    """Déclare manuellement le stock de ce produit à 0."""
    prod = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == produit_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    prod.quantite_stock = 0
    db.commit()
    db.refresh(prod)
    return prod
