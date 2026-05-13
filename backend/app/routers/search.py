"""
GET /api/search?q=...
Recherche globale sur cultures, plantes, variétés, breeders, stock.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.all_models import Culture, Plant, Variete, Breeder, Stock

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def global_search(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    q_like = f"%{q}%"
    results: dict = {
        "cultures": [],
        "plantes": [],
        "varietes": [],
        "breeders": [],
        "stock": [],
    }

    # ── Cultures ─────────────────────────────────────────────────────────────
    cultures = (
        db.query(Culture)
        .filter(Culture.nom.ilike(q_like))
        .limit(8)
        .all()
    )
    for c in cultures:
        results["cultures"].append({
            "id": c.id_culture,
            "label": c.nom or f"Culture #{c.id_culture}",
            "sub": c.statut or "",
            "url": "/culture",
        })

    # ── Plantes ──────────────────────────────────────────────────────────────
    plants = (
        db.query(Plant)
        .filter(Plant.nom_affichage.ilike(q_like))
        .limit(8)
        .all()
    )
    for p in plants:
        results["plantes"].append({
            "id": p.id_plant,
            "label": p.nom_affichage,
            "sub": p.statut or "",
            "url": "/culture",
        })

    # ── Variétés ─────────────────────────────────────────────────────────────
    varietes = (
        db.query(Variete)
        .filter(Variete.nom_variete.ilike(q_like))
        .limit(8)
        .all()
    )
    for v in varietes:
        results["varietes"].append({
            "id": v.id_variete,
            "label": v.nom_variete,
            "sub": v.croisement_variete or "",
            "url": "/graines",
        })

    # ── Breeders ─────────────────────────────────────────────────────────────
    breeders = (
        db.query(Breeder)
        .filter(Breeder.nom_breeder.ilike(q_like))
        .limit(5)
        .all()
    )
    for b in breeders:
        results["breeders"].append({
            "id": b.id_breeder,
            "label": b.nom_breeder,
            "sub": "Breeder",
            "url": "/graines",
        })

    # ── Stock ─────────────────────────────────────────────────────────────────
    stocks = (
        db.query(Stock)
        .join(Variete, Stock.id_variete == Variete.id_variete, isouter=True)
        .filter(Variete.nom_variete.ilike(q_like))
        .filter(Stock.date_fin_stock.is_(None))  # stock actif uniquement
        .limit(8)
        .all()
    )
    for s in stocks:
        nom = s.variete.nom_variete if s.variete else f"Stock #{s.id_stock}"
        results["stock"].append({
            "id": s.id_stock,
            "label": nom,
            "sub": f"{s.type_stock} · {float(s.quantite_stock):.0f}g" if s.quantite_stock else s.type_stock or "",
            "url": "/stock",
        })

    return results
