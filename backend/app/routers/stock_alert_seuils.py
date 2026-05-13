"""Router StockAlertSeuil — seuils d'alerte par type de stock (Feature G — V4)"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from decimal import Decimal

from sqlalchemy import text
from app.database import get_db
from app.models.all_models import StockAlertSeuil, Stock

router = APIRouter(prefix="/api/stock-alert-seuils", tags=["stock-alert-seuils"])

# ── Valeurs par défaut ────────────────────────────────────────────────────────
SEUILS_DEFAULTS = [
    {
        "type_stock":      "Fleur",
        "seuil_bocal_g":   10.0,
        "seuil_bocal_pct": 10.0,
        "seuil_total_g":   100.0,
        "actif":           True,
    },
]

# Colonnes attendues par le modèle (nom → DDL pour ALTER TABLE)
_REQUIRED_COLUMNS = {
    "seuil_bocal_g":   "DECIMAL(10,2) NULL",
    "seuil_bocal_pct": "DECIMAL(5,1)  NULL",
    "seuil_total_g":   "DECIMAL(10,2) NULL",
    "actif":           "BOOLEAN NOT NULL DEFAULT TRUE",
}


def migrate_schema(db: Session):
    """Ajoute les colonnes manquantes sur StockAlertSeuil (sans Alembic)."""
    try:
        result = db.execute(text(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_NAME = 'StockAlertSeuil' AND TABLE_SCHEMA = DATABASE()"
        ))
        existing_cols = {row[0] for row in result}
        for col, ddl in _REQUIRED_COLUMNS.items():
            if col not in existing_cols:
                db.execute(text(f"ALTER TABLE `StockAlertSeuil` ADD COLUMN `{col}` {ddl}"))
                db.commit()
    except Exception:
        db.rollback()


def seed_defaults(db: Session):
    """Migre le schéma puis insère les seuils par défaut s'ils n'existent pas encore."""
    migrate_schema(db)
    for s in SEUILS_DEFAULTS:
        existing = db.query(StockAlertSeuil).filter(
            StockAlertSeuil.type_stock == s["type_stock"]
        ).first()
        if not existing:
            db.add(StockAlertSeuil(**s))
    db.commit()


# ── Schémas ───────────────────────────────────────────────────────────────────

class SeuilRead(BaseModel):
    type_stock:      str
    seuil_bocal_g:   Optional[float] = None
    seuil_bocal_pct: Optional[float] = None
    seuil_total_g:   Optional[float] = None
    actif:           bool

    class Config:
        from_attributes = True


class SeuilUpsert(BaseModel):
    seuil_bocal_g:   Optional[float] = None
    seuil_bocal_pct: Optional[float] = None
    seuil_total_g:   Optional[float] = None
    actif:           bool = True


class BocalAlertDetail(BaseModel):
    id_stock:          int
    variete_nom:       Optional[str] = None
    quantite_stock:    float
    quantite_initiale: Optional[float] = None
    pct_restant:       Optional[float] = None
    raison:            str


class StockAlertResult(BaseModel):
    type_stock:      str
    seuil_bocal_g:   Optional[float] = None
    seuil_bocal_pct: Optional[float] = None
    seuil_total_g:   Optional[float] = None
    nb_bocaux_bas:   int
    bocaux_bas:      List[BocalAlertDetail]
    total_g:         float
    alerte_total:    bool


# ── Endpoints CRUD ────────────────────────────────────────────────────────────

@router.get("", response_model=List[SeuilRead])
def get_all(db: Session = Depends(get_db)):
    return db.query(StockAlertSeuil).order_by(StockAlertSeuil.type_stock).all()


@router.put("/{type_stock}", response_model=SeuilRead)
def upsert(type_stock: str, payload: SeuilUpsert, db: Session = Depends(get_db)):
    row = db.query(StockAlertSeuil).filter(StockAlertSeuil.type_stock == type_stock).first()
    if row:
        row.seuil_bocal_g   = payload.seuil_bocal_g
        row.seuil_bocal_pct = payload.seuil_bocal_pct
        row.seuil_total_g   = payload.seuil_total_g
        row.actif           = payload.actif
    else:
        row = StockAlertSeuil(
            type_stock=type_stock,
            seuil_bocal_g=payload.seuil_bocal_g,
            seuil_bocal_pct=payload.seuil_bocal_pct,
            seuil_total_g=payload.seuil_total_g,
            actif=payload.actif,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{type_stock}", status_code=204)
def delete(type_stock: str, db: Session = Depends(get_db)):
    row = db.query(StockAlertSeuil).filter(StockAlertSeuil.type_stock == type_stock).first()
    if not row:
        raise HTTPException(status_code=404, detail="Seuil introuvable")
    db.delete(row)
    db.commit()


# ── Endpoint de calcul des alertes ───────────────────────────────────────────

@router.get("/check", response_model=List[StockAlertResult])
def check_alerts(db: Session = Depends(get_db)):
    """Calcule les alertes stock actives pour tous les types configurés."""
    seuils = db.query(StockAlertSeuil).filter(StockAlertSeuil.actif == True).all()
    results = []

    for seuil in seuils:
        stocks = db.query(Stock).filter(
            Stock.type_stock == seuil.type_stock,
            Stock.date_fin_stock.is_(None),
            Stock.quantite_stock > 0,
        ).all()

        total_g = sum(float(s.quantite_stock or 0) for s in stocks)

        bocaux_bas: List[BocalAlertDetail] = []
        for s in stocks:
            qte      = float(s.quantite_stock or 0)
            initiale = float(s.quantite_initiale) if s.quantite_initiale else None
            pct      = round(qte / initiale * 100, 1) if initiale and initiale > 0 else None

            alerte_g   = seuil.seuil_bocal_g   is not None and qte < float(seuil.seuil_bocal_g)
            alerte_pct = (seuil.seuil_bocal_pct is not None
                          and pct is not None
                          and pct < float(seuil.seuil_bocal_pct))

            if alerte_g or alerte_pct:
                raison = "g+pct" if (alerte_g and alerte_pct) else ("g" if alerte_g else "pct")
                bocaux_bas.append(BocalAlertDetail(
                    id_stock=s.id_stock,
                    variete_nom=s.variete.nom_variete if s.variete else None,
                    quantite_stock=qte,
                    quantite_initiale=initiale,
                    pct_restant=pct,
                    raison=raison,
                ))

        alerte_total = (
            seuil.seuil_total_g is not None
            and total_g < float(seuil.seuil_total_g)
        )

        results.append(StockAlertResult(
            type_stock=seuil.type_stock,
            seuil_bocal_g=float(seuil.seuil_bocal_g) if seuil.seuil_bocal_g else None,
            seuil_bocal_pct=float(seuil.seuil_bocal_pct) if seuil.seuil_bocal_pct else None,
            seuil_total_g=float(seuil.seuil_total_g) if seuil.seuil_total_g else None,
            nb_bocaux_bas=len(bocaux_bas),
            bocaux_bas=bocaux_bas,
            total_g=round(total_g, 1),
            alerte_total=alerte_total,
        ))

    return results
