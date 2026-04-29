"""Routers pour Stock"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app.models import Stock, Variete, Bocal
from app.models.all_models import Materiel
from app.schemas.stock import StockCreate, StockRead, StockWithVariete, BocalDisponible
import json

router = APIRouter(prefix="/api/stock", tags=["stock"])


# ── Helper : enrichit un Stock avec variété + bocal ──────────────────────────

def _enrich(stock: Stock, db: Session) -> StockWithVariete:
    variete = db.query(Variete).filter(Variete.id_variete == stock.id_variete).first() \
              if stock.id_variete else None
    bocal   = db.query(Bocal).filter(Bocal.id_bocal == stock.id_bocal).first() \
              if stock.id_bocal else None
    mat_bocal = db.query(Materiel).filter(Materiel.id_materiel == stock.id_materiel_bocal).first() \
                if stock.id_materiel_bocal else None

    bocal_volume_ml = None
    if mat_bocal and mat_bocal.caracteristiques:
        try:
            c = mat_bocal.caracteristiques if isinstance(mat_bocal.caracteristiques, dict) \
                else json.loads(mat_bocal.caracteristiques)
            bocal_volume_ml = c.get("volume_ml")
        except Exception:
            pass

    return StockWithVariete(
        id_stock=          stock.id_stock,
        id_variete=        stock.id_variete,
        id_bocal=          stock.id_bocal,
        id_materiel_bocal= stock.id_materiel_bocal,
        type_stock=        stock.type_stock,
        sous_type_stock=   stock.sous_type_stock,
        lampe_type=        stock.lampe_type,
        engrais_type=      stock.engrais_type,
        maillage=          stock.maillage,
        type_hash=         stock.type_hash,
        type_rosin=        stock.type_rosin,
        date_stock=        stock.date_stock,
        date_fin_stock=    stock.date_fin_stock,
        quantite_stock=    float(stock.quantite_stock),
        variete_nom=       variete.nom_variete if variete else None,
        bocal_taille=      bocal.taille_bocal  if bocal   else None,
        bocal_nom=         mat_bocal.nom        if mat_bocal else None,
        bocal_volume_ml=   bocal_volume_ml,
    )


# ── Helper : clôture automatique si stock ≤ 0 ───────────────────────────────

def _auto_cloture(stock: Stock, db: Session):
    """Si quantite_stock tombe à 0, enregistre la date de fin."""
    if float(stock.quantite_stock) <= 0 and stock.date_fin_stock is None:
        stock.quantite_stock = 0
        stock.date_fin_stock = date.today()


# ── GET all ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[StockWithVariete])
def get_stock(db: Session = Depends(get_db)):
    stocks = db.query(Stock).all()
    return [_enrich(s, db) for s in stocks]


# ── GET bocaux disponibles (Materiel categorie=Bocaux, non utilisés) ─────────

@router.get("/bocaux-disponibles", response_model=list[BocalDisponible])
def get_bocaux_disponibles(
    current_stock_id: int | None = None,
    db: Session = Depends(get_db),
):
    """
    Retourne les bocaux Materiel (categorie='Bocaux') disponibles :
    - non liés à un stock actif (quantite_stock > 0 ET date_fin_stock IS NULL)
    - ou liés uniquement au stock courant (pour l'édition)
    """
    # IDs de bocaux déjà occupés
    occupied = db.query(Stock.id_materiel_bocal).filter(
        Stock.id_materiel_bocal.isnot(None),
        Stock.quantite_stock > 0,
        Stock.date_fin_stock.is_(None),
    )
    if current_stock_id is not None:
        occupied = occupied.filter(Stock.id_stock != current_stock_id)
    occupied_ids = {row[0] for row in occupied.all()}

    bocaux = db.query(Materiel).filter(
        Materiel.categorie == "Bocaux",
    ).order_by(Materiel.nom).all()

    result = []
    for b in bocaux:
        if b.id_materiel in occupied_ids:
            continue
        volume_ml = None
        try:
            c = b.caracteristiques if isinstance(b.caracteristiques, dict) \
                else json.loads(b.caracteristiques or '{}')
            volume_ml = c.get("volume_ml")
        except Exception:
            pass
        label = b.nom
        result.append(BocalDisponible(
            id_materiel=b.id_materiel,
            nom=b.nom,
            volume_ml=volume_ml,
            label=label,
        ))
    return result


# ── GET one ──────────────────────────────────────────────────────────────────

@router.get("/{stock_id}", response_model=StockWithVariete)
def get_stock_item(stock_id: int, db: Session = Depends(get_db)):
    stock = db.query(Stock).filter(Stock.id_stock == stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock non trouvé")
    return _enrich(stock, db)


# ── POST create ──────────────────────────────────────────────────────────────

@router.post("/", response_model=StockRead)
def create_stock(stock: StockCreate, db: Session = Depends(get_db)):
    db_stock = Stock(
        id_variete=        stock.id_variete,
        id_bocal=          stock.id_bocal,
        id_materiel_bocal= stock.id_materiel_bocal,
        type_stock=        stock.type_stock,
        sous_type_stock=   stock.sous_type_stock,
        lampe_type=        stock.lampe_type,
        engrais_type=      stock.engrais_type,
        maillage=          stock.maillage,
        type_hash=         stock.type_hash,
        type_rosin=        stock.type_rosin,
        date_stock=        stock.date_stock,
        date_fin_stock=    stock.date_fin_stock,
        quantite_stock=    stock.quantite_stock,
    )
    db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock


# ── PUT update ───────────────────────────────────────────────────────────────

@router.put("/{stock_id}", response_model=StockRead)
def update_stock(stock_id: int, stock: StockCreate, db: Session = Depends(get_db)):
    db_stock = db.query(Stock).filter(Stock.id_stock == stock_id).first()
    if not db_stock:
        raise HTTPException(status_code=404, detail="Stock non trouvé")

    db_stock.id_variete        = stock.id_variete
    db_stock.id_bocal          = stock.id_bocal
    db_stock.id_materiel_bocal = stock.id_materiel_bocal
    db_stock.type_stock        = stock.type_stock
    db_stock.sous_type_stock   = stock.sous_type_stock
    db_stock.lampe_type        = stock.lampe_type
    db_stock.engrais_type      = stock.engrais_type
    db_stock.maillage          = stock.maillage
    db_stock.type_hash         = stock.type_hash
    db_stock.type_rosin        = stock.type_rosin
    db_stock.date_stock        = stock.date_stock
    db_stock.quantite_stock    = stock.quantite_stock

    _auto_cloture(db_stock, db)
    db.commit()
    db.refresh(db_stock)
    return db_stock


# ── POST sortie stock ────────────────────────────────────────────────────────

@router.post("/{stock_id}/sortie", response_model=StockWithVariete)
def sortie_stock(stock_id: int, db: Session = Depends(get_db)):
    """
    Déclare le stock comme terminé :
    - quantite_stock → 0
    - date_fin_stock → aujourd'hui
    - libère le bocal Materiel associé (il redevient disponible)
    La durée de consommation = date_fin_stock - date_stock.
    """
    db_stock = db.query(Stock).filter(Stock.id_stock == stock_id).first()
    if not db_stock:
        raise HTTPException(status_code=404, detail="Stock non trouvé")
    if db_stock.date_fin_stock is not None:
        raise HTTPException(status_code=400, detail="Ce stock est déjà clôturé")

    db_stock.quantite_stock = 0
    db_stock.date_fin_stock = date.today()
    # Le bocal est libéré implicitement (date_fin_stock IS NOT NULL → non occupé)

    db.commit()
    db.refresh(db_stock)
    return _enrich(db_stock, db)


# ── DELETE ───────────────────────────────────────────────────────────────────

@router.delete("/{stock_id}", status_code=204)
def delete_stock(stock_id: int, db: Session = Depends(get_db)):
    db_stock = db.query(Stock).filter(Stock.id_stock == stock_id).first()
    if not db_stock:
        raise HTTPException(status_code=404, detail="Stock non trouvé")
    # Le bocal est libéré automatiquement car la ligne est supprimée
    db.delete(db_stock)
    db.commit()
