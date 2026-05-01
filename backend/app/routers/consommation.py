"""Router SessionConsommation — CRUD + stats"""
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import SessionConsommation, Vaporisateur, Stock, Variete
from app.schemas.consommation import (
    SessionConsommationCreate,
    SessionConsommationUpdate,
    SessionConsommationRead,
)

router = APIRouter(prefix="/api/consommation", tags=["consommation"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _enrich(s: SessionConsommation, db: Session) -> SessionConsommationRead:
    nom_vapo = None
    if s.id_vaporisateur:
        v = db.query(Vaporisateur).filter(Vaporisateur.id_vaporisateur == s.id_vaporisateur).first()
        if v:
            nom_vapo = v.nom or f"{v.marque or ''} {v.modele or ''}".strip()

    nom_variete = None
    if s.id_stock:
        st = db.query(Stock).filter(Stock.id_stock == s.id_stock).first()
        if st and st.variete:
            nom_variete = st.variete.nom_variete

    return SessionConsommationRead(
        id_session=s.id_session,
        date_heure=s.date_heure,
        id_vaporisateur=s.id_vaporisateur,
        nom_vaporisateur=nom_vapo,
        type_produit=s.type_produit,
        id_stock=s.id_stock,
        nom_variete=nom_variete,
        quantite_g=float(s.quantite_g),
        options_vapo=s.options_vapo,
        notes=s.notes,
        created_at=s.created_at,
    )


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SessionConsommationRead])
def get_sessions(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SessionConsommation)
        .order_by(SessionConsommation.date_heure.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_enrich(r, db) for r in rows]


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Statistiques agrégées : totaux par période, par produit, par vapo + projection stock."""
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start  = today_start - timedelta(days=today_start.weekday())
    month_start = datetime(now.year, now.month, 1)
    year_start  = datetime(now.year, 1, 1)

    def _sum_period(start: datetime) -> float:
        r = db.query(func.sum(SessionConsommation.quantite_g)).filter(
            SessionConsommation.date_heure >= start
        ).scalar()
        return float(r or 0)

    total_jour   = _sum_period(today_start)
    total_semaine = _sum_period(week_start)
    total_mois   = _sum_period(month_start)
    total_annee  = _sum_period(year_start)

    # Par type de produit (tous temps)
    by_type_rows = (
        db.query(SessionConsommation.type_produit, func.sum(SessionConsommation.quantite_g))
        .group_by(SessionConsommation.type_produit)
        .all()
    )
    by_type = {row[0]: float(row[1] or 0) for row in by_type_rows}

    # Par vaporisateur (tous temps)
    by_vapo_rows = (
        db.query(
            SessionConsommation.id_vaporisateur,
            func.sum(SessionConsommation.quantite_g),
        )
        .group_by(SessionConsommation.id_vaporisateur)
        .all()
    )
    by_vapo = []
    for id_v, total in by_vapo_rows:
        nom = "Sans vapo"
        if id_v:
            v = db.query(Vaporisateur).filter(Vaporisateur.id_vaporisateur == id_v).first()
            if v:
                nom = v.nom or f"{v.marque or ''} {v.modele or ''}".strip()
        by_vapo.append({"id_vaporisateur": id_v, "nom": nom, "total_g": float(total or 0)})

    # Moyenne mobile 7 derniers jours (g/jour)
    last7 = []
    for i in range(6, -1, -1):
        d = today_start - timedelta(days=i)
        d_end = d + timedelta(days=1)
        total_d = db.query(func.sum(SessionConsommation.quantite_g)).filter(
            SessionConsommation.date_heure >= d,
            SessionConsommation.date_heure < d_end,
        ).scalar()
        last7.append({"date": d.date().isoformat(), "total_g": float(total_d or 0)})

    # Moyenne 7j pour projection
    avg_7j = sum(d["total_g"] for d in last7) / 7 if last7 else 0

    # Stock disponible par type
    stocks_dispo = {}
    for type_p in ("fleur", "hash", "rosin"):
        type_map = {
            "fleur": ["fleur", "Fleur"],
            "hash":  ["hash",  "Hash"],
            "rosin": ["rosin", "Rosin"],
        }
        types = type_map.get(type_p, [type_p])
        q = db.query(func.sum(Stock.quantite_stock)).filter(
            Stock.type_stock.in_(types),
            Stock.date_fin_stock == None,
        ).scalar()
        stocks_dispo[type_p] = float(q or 0)

    total_stock = sum(stocks_dispo.values())
    jours_restants = round(total_stock / avg_7j) if avg_7j > 0 else None

    return {
        "periodes": {
            "jour":    total_jour,
            "semaine": total_semaine,
            "mois":    total_mois,
            "annee":   total_annee,
        },
        "by_type":       by_type,
        "by_vapo":       by_vapo,
        "last7":         last7,
        "avg_7j_g":      round(avg_7j, 3),
        "stock_dispo_g": stocks_dispo,
        "jours_restants": jours_restants,
    }


@router.get("/{session_id}", response_model=SessionConsommationRead)
def get_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(SessionConsommation).filter(SessionConsommation.id_session == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session introuvable")
    return _enrich(s, db)


@router.post("/", response_model=SessionConsommationRead, status_code=201)
def create_session(payload: SessionConsommationCreate, db: Session = Depends(get_db)):
    s = SessionConsommation(
        date_heure=payload.date_heure or datetime.utcnow(),
        id_vaporisateur=payload.id_vaporisateur,
        type_produit=payload.type_produit,
        id_stock=payload.id_stock,
        quantite_g=payload.quantite_g,
        options_vapo=payload.options_vapo,
        notes=payload.notes,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _enrich(s, db)


@router.put("/{session_id}", response_model=SessionConsommationRead)
def update_session(session_id: int, payload: SessionConsommationUpdate, db: Session = Depends(get_db)):
    s = db.query(SessionConsommation).filter(SessionConsommation.id_session == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session introuvable")
    for field in ("date_heure", "id_vaporisateur", "type_produit", "id_stock", "quantite_g", "options_vapo", "notes"):
        val = getattr(payload, field)
        if val is not None:
            setattr(s, field, val)
    db.commit()
    db.refresh(s)
    return _enrich(s, db)


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(SessionConsommation).filter(SessionConsommation.id_session == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session introuvable")
    db.delete(s)
    db.commit()
