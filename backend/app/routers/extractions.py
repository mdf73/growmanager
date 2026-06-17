"""Routers pour les extractions Rosin et Hash"""
from datetime import date as dt_date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import RosinExtraction, HashExtraction, Stock, Variete
from app.schemas.extraction import (
    RosinExtractionCreate,
    RosinExtractionUpdate,
    RosinExtractionRead,
    HashExtractionCreate,
    HashExtractionRead,
    ExtractionStats,
)

router = APIRouter(prefix="/api", tags=["extractions"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _deduct_sources(sources: list, quantite_totale: float, db: Session):
    """
    Valide et retourne les objets Stock pour chaque source.
    Lève une HTTPException si un stock est introuvable ou insuffisant.
    """
    stock_objects = []
    for src in sources:
        id_stock = src.get("id_stock") if isinstance(src, dict) else src.id_stock
        quantite = float(src.get("quantite") if isinstance(src, dict) else src.quantite)
        stock = db.query(Stock).filter(Stock.id_stock == id_stock).first()
        if not stock:
            raise HTTPException(status_code=404, detail=f"Stock {id_stock} introuvable")
        if float(stock.quantite_stock) < quantite:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuffisant pour {stock.id_stock} : {float(stock.quantite_stock):.1f}g disponibles, {quantite:.1f}g demandés"
            )
        stock_objects.append((stock, quantite))
    return stock_objects


def _apply_deductions(stock_objects: list, date_fin: dt_date):
    """Applique les déductions de stock et clôture automatiquement si épuisé."""
    for stock, quantite in stock_objects:
        stock.quantite_stock = float(stock.quantite_stock) - quantite
        if float(stock.quantite_stock) <= 0:
            stock.quantite_stock = 0
            if stock.date_fin_stock is None:
                stock.date_fin_stock = date_fin


def _enrich_rosin(extraction: RosinExtraction, db: Session) -> RosinExtractionRead:
    """Enrichit une extraction avec le nom de variété depuis le stock source."""
    variete_nom = None
    if extraction.id_stock_source:
        stock = db.query(Stock).filter(Stock.id_stock == extraction.id_stock_source).first()
        if stock and stock.id_variete:
            variete = db.query(Variete).filter(Variete.id_variete == stock.id_variete).first()
            if variete:
                variete_nom = variete.nom_variete
    # Fallback sur nom_variete_extract si pas de FK
    if not variete_nom:
        variete_nom = extraction.nom_variete_extract

    def _f(v) -> Optional[float]:
        return float(v) if v is not None else None

    return RosinExtractionRead(
        id_rosinextraction=extraction.id_rosinextraction,
        id_bocal=extraction.id_bocal,
        id_rosinbag=extraction.id_rosinbag,
        id_press=extraction.id_press,
        id_stock_source=extraction.id_stock_source,
        nom_variete_extract=extraction.nom_variete_extract,
        date_rosinextraction=extraction.date_rosinextraction,
        sources=extraction.sources,
        temperature_extraction=extraction.temperature_extraction,
        maillage=extraction.maillage,
        duree_preheat=extraction.duree_preheat,
        duree_extraction=extraction.duree_extraction,
        sac_1_poids=_f(extraction.sac_1_poids),
        sac_2_poids=_f(extraction.sac_2_poids),
        sac_3_poids=_f(extraction.sac_3_poids),
        sac_4_poids=_f(extraction.sac_4_poids),
        quantite_utilisee=float(extraction.quantite_utilisee),
        presse_1_poids=_f(extraction.presse_1_poids),
        presse_2_poids=_f(extraction.presse_2_poids),
        presse_3_poids=_f(extraction.presse_3_poids),
        presse_4_poids=_f(extraction.presse_4_poids),
        quantite_extraite=float(extraction.quantite_extraite),
        info_rosinextraction=extraction.info_rosinextraction,
        variete_nom=variete_nom,
    )


# ═══════════════════════════ Rosin Extraction ════════════════════════════════

@router.get("/rosin", response_model=list[RosinExtractionRead])
def get_rosin_extractions(db: Session = Depends(get_db)):
    """Récupère toutes les extractions rosin, enrichies avec variete_nom."""
    extractions = (
        db.query(RosinExtraction)
        .order_by(RosinExtraction.date_rosinextraction.desc())
        .all()
    )
    return [_enrich_rosin(e, db) for e in extractions]


@router.get("/rosin/stats", response_model=ExtractionStats)
def get_rosin_stats(db: Session = Depends(get_db)):
    """Statistiques d'extraction rosin."""
    extractions = db.query(RosinExtraction).all()

    if not extractions:
        return ExtractionStats(
            ratio_moyen_rosin=0.0,
            total_presse_g=0.0,
            total_extrait_rosin_g=0.0,
            total_extrait_hash_g=0.0,
            nombre_extractions=0,
        )

    total_presse = sum(float(e.quantite_utilisee or 0) for e in extractions)
    total_extrait_rosin = sum(float(e.quantite_extraite or 0) for e in extractions)

    hash_extractions = db.query(HashExtraction).all()
    total_extrait_hash = sum(float(e.quantite_extraite or 0) for e in hash_extractions)

    ratio_moyen = (total_extrait_rosin / total_presse * 100) if total_presse > 0 else 0

    return ExtractionStats(
        ratio_moyen_rosin=ratio_moyen,
        total_presse_g=total_presse,
        total_extrait_rosin_g=total_extrait_rosin,
        total_extrait_hash_g=total_extrait_hash,
        nombre_extractions=len(extractions),
    )


@router.post("/rosin", response_model=RosinExtractionRead)
def create_rosin_extraction(
    extraction: RosinExtractionCreate, db: Session = Depends(get_db)
):
    """
    Crée une extraction rosin.
    - Multi-sources : déduit quantite_utilisee de chaque stock source
    - Crée une nouvelle entrée Stock (type Rosin) avec quantite_extraite
    """
    # ── Maillage obligatoire ──────────────────────────────────────────────
    if not (extraction.maillage or "").strip():
        raise HTTPException(status_code=400, detail="Le maillage du sac est obligatoire")

    # ── Résoudre les sources (multi ou legacy mono-source) ────────────────
    sources = extraction.sources or []
    if not sources and extraction.id_stock_source:
        # Backward compat : ancien mode mono-source
        sources = [{"id_stock": extraction.id_stock_source, "quantite": extraction.quantite_utilisee}]

    if not sources:
        raise HTTPException(status_code=400, detail="Aucun produit source sélectionné")

    # Valider stocks et quantités
    stock_objects = _deduct_sources(sources, extraction.quantite_utilisee, db)

    # Stock de référence = premier de la liste (pour les métadonnées du stock Rosin créé)
    stock_source_ref = stock_objects[0][0] if stock_objects else None

    # id_stock_source = premier stock (backward compat pour affichage)
    id_stock_source_save = stock_source_ref.id_stock if stock_source_ref else extraction.id_stock_source

    # ── Créer l'extraction ────────────────────────────────────────────────
    db_extraction = RosinExtraction(
        id_bocal=extraction.id_bocal,
        id_rosinbag=extraction.id_rosinbag,
        id_press=extraction.id_press,
        id_stock_source=id_stock_source_save,
        nom_variete_extract=extraction.nom_variete_extract,
        date_rosinextraction=extraction.date_rosinextraction,
        sources=[{"id_stock": s["id_stock"] if isinstance(s, dict) else s.id_stock,
                   "quantite": float(s["quantite"] if isinstance(s, dict) else s.quantite)}
                  for s in sources],
        temperature_extraction=extraction.temperature_extraction,
        maillage=extraction.maillage,
        duree_preheat=extraction.duree_preheat,
        duree_extraction=extraction.duree_extraction,
        sac_1_poids=extraction.sac_1_poids,
        sac_2_poids=extraction.sac_2_poids,
        sac_3_poids=extraction.sac_3_poids,
        sac_4_poids=extraction.sac_4_poids,
        quantite_utilisee=extraction.quantite_utilisee,
        presse_1_poids=extraction.presse_1_poids,
        presse_2_poids=extraction.presse_2_poids,
        presse_3_poids=extraction.presse_3_poids,
        presse_4_poids=extraction.presse_4_poids,
        quantite_extraite=extraction.quantite_extraite,
        info_rosinextraction=extraction.info_rosinextraction,
    )
    db.add(db_extraction)

    # ── Déduire de chaque stock source ────────────────────────────────────
    _apply_deductions(stock_objects, extraction.date_rosinextraction)

    # ── Déterminer le type de rosin depuis la source de référence ─────────
    type_rosin = None
    if stock_source_ref:
        src_type = (stock_source_ref.type_stock or "").lower()
        type_rosin = "Hash Rosin" if "hash" in src_type else "Flower Rosin"

    # ── Créer l'entrée Rosin dans le stock ────────────────────────────────
    rosin_stock = Stock(
        id_variete=stock_source_ref.id_variete if stock_source_ref else None,
        type_stock="Rosin",
        sous_type_stock=stock_source_ref.sous_type_stock if stock_source_ref else None,
        lampe_type=stock_source_ref.lampe_type if stock_source_ref else None,
        engrais_type=stock_source_ref.engrais_type if stock_source_ref else None,
        type_rosin=type_rosin,
        maillage=extraction.maillage,
        date_stock=extraction.date_rosinextraction,
        quantite_stock=extraction.quantite_extraite,
    )
    db.add(rosin_stock)
    db.flush()  # obtenir l'id du stock produit pour le lier à l'extraction

    # Lier le stock produit à l'extraction (pour la synchro lors de l'édition)
    db_extraction.id_stock_produit = rosin_stock.id_stock

    db.commit()
    db.refresh(db_extraction)
    return _enrich_rosin(db_extraction, db)


@router.put("/rosin/{extraction_id}", response_model=RosinExtractionRead)
def update_rosin_extraction(
    extraction_id: int,
    extraction: RosinExtractionUpdate,
    db: Session = Depends(get_db),
):
    """
    Met à jour une extraction rosin (maillage, poids sortie, paramètres…).
    Ne re-déduit PAS les stocks sources (l'entrée a déjà été consommée).
    Synchronise le stock Rosin produit lié : quantité (= poids sortie) + maillage.
    """
    db_extraction = db.query(RosinExtraction).filter(
        RosinExtraction.id_rosinextraction == extraction_id
    ).first()
    if not db_extraction:
        raise HTTPException(status_code=404, detail="Extraction introuvable")

    if not (extraction.maillage or "").strip():
        raise HTTPException(status_code=400, detail="Le maillage du sac est obligatoire")

    # ── Mémoriser les anciennes valeurs pour la synchro stock ─────────────
    old_quantite = float(db_extraction.quantite_extraite or 0)
    old_maillage = db_extraction.maillage

    # ── Appliquer les modifications (pas de re-déduction des sources) ─────
    db_extraction.date_rosinextraction   = extraction.date_rosinextraction
    db_extraction.temperature_extraction = extraction.temperature_extraction
    db_extraction.maillage               = extraction.maillage
    db_extraction.duree_preheat          = extraction.duree_preheat
    db_extraction.duree_extraction       = extraction.duree_extraction
    db_extraction.sac_1_poids            = extraction.sac_1_poids
    db_extraction.sac_2_poids            = extraction.sac_2_poids
    db_extraction.sac_3_poids            = extraction.sac_3_poids
    db_extraction.sac_4_poids            = extraction.sac_4_poids
    db_extraction.quantite_utilisee      = extraction.quantite_utilisee
    db_extraction.presse_1_poids         = extraction.presse_1_poids
    db_extraction.presse_2_poids         = extraction.presse_2_poids
    db_extraction.presse_3_poids         = extraction.presse_3_poids
    db_extraction.presse_4_poids         = extraction.presse_4_poids
    db_extraction.quantite_extraite      = extraction.quantite_extraite
    db_extraction.info_rosinextraction   = extraction.info_rosinextraction

    # ── Synchroniser le stock Rosin produit ───────────────────────────────
    stock_produit = None
    if db_extraction.id_stock_produit:
        stock_produit = db.query(Stock).filter(
            Stock.id_stock == db_extraction.id_stock_produit
        ).first()
    # Best-effort pour les extractions créées avant le lien : on retrouve le
    # stock Rosin par date + maillage + ancienne quantité, encore intact.
    if stock_produit is None:
        stock_produit = (
            db.query(Stock)
            .filter(
                Stock.type_stock == "Rosin",
                Stock.date_stock == db_extraction.date_rosinextraction,
                Stock.maillage == old_maillage,
                Stock.quantite_stock == old_quantite,
            )
            .first()
        )
        if stock_produit:
            db_extraction.id_stock_produit = stock_produit.id_stock

    if stock_produit:
        # On reporte l'écart de poids sortie pour préserver une éventuelle
        # consommation déjà effectuée sur ce stock.
        delta = float(extraction.quantite_extraite) - old_quantite
        nouvelle_qte = float(stock_produit.quantite_stock or 0) + delta
        stock_produit.quantite_stock = max(nouvelle_qte, 0)
        stock_produit.maillage = extraction.maillage

    db.commit()
    db.refresh(db_extraction)
    return _enrich_rosin(db_extraction, db)


@router.delete("/rosin/{extraction_id}", status_code=204)
def delete_rosin_extraction(extraction_id: int, db: Session = Depends(get_db)):
    """Supprime une extraction rosin (ne restaure pas le stock)."""
    db_extraction = db.query(RosinExtraction).filter(
        RosinExtraction.id_rosinextraction == extraction_id
    ).first()
    if not db_extraction:
        raise HTTPException(status_code=404, detail="Extraction introuvable")
    db.delete(db_extraction)
    db.commit()


# ═══════════════════════════ Hash Extraction ═════════════════════════════════

def _enrich_hash(extraction: HashExtraction, db: Session) -> HashExtractionRead:
    """Enrichit une extraction hash avec le nom de variété."""
    variete_nom = None
    # Priorité : variété liée au stock source, puis id_variete direct, puis nom libre
    if extraction.id_stock_source:
        stock = db.query(Stock).filter(Stock.id_stock == extraction.id_stock_source).first()
        if stock and stock.id_variete:
            variete = db.query(Variete).filter(Variete.id_variete == stock.id_variete).first()
            if variete:
                variete_nom = variete.nom_variete
    if not variete_nom and extraction.id_variete:
        variete = db.query(Variete).filter(Variete.id_variete == extraction.id_variete).first()
        if variete:
            variete_nom = variete.nom_variete
    if not variete_nom:
        variete_nom = extraction.nom_variete_hash

    def _f(v) -> Optional[float]:
        return float(v) if v is not None else None

    return HashExtractionRead(
        id_hashextraction=extraction.id_hashextraction,
        id_variete=extraction.id_variete,
        id_iceobag=extraction.id_iceobag,
        id_stock_source=extraction.id_stock_source,
        nom_variete_hash=extraction.nom_variete_hash,
        date_hashextraction=extraction.date_hashextraction,
        type_extraction=extraction.type_extraction,
        duree_polinator=extraction.duree_polinator,
        passages=extraction.passages,
        sacs=extraction.sacs,
        sources=extraction.sources,
        quantite_utilisee=_f(extraction.quantite_utilisee) or 0.0,
        quantite_extraite=_f(extraction.quantite_extraite) or 0.0,
        info_hashextraction=extraction.info_hashextraction,
        variete_nom=variete_nom,
    )


@router.get("/hash", response_model=list[HashExtractionRead])
def get_hash_extractions(db: Session = Depends(get_db)):
    """Récupère toutes les extractions hash, enrichies avec variete_nom."""
    extractions = db.query(HashExtraction).order_by(HashExtraction.date_hashextraction.desc()).all()
    return [_enrich_hash(e, db) for e in extractions]


@router.get("/hash/stats")
def get_hash_stats(db: Session = Depends(get_db)):
    """Statistiques d'extraction hash."""
    extractions = db.query(HashExtraction).all()
    if not extractions:
        return {"nombre_extractions": 0, "total_entree_g": 0.0, "total_hash_g": 0.0, "ratio_moyen": 0.0}
    total_entree = sum(float(e.quantite_utilisee or 0) for e in extractions)
    total_hash   = sum(float(e.quantite_extraite or 0) for e in extractions)
    ratio_moyen  = (total_hash / total_entree * 100) if total_entree > 0 else 0
    return {
        "nombre_extractions": len(extractions),
        "total_entree_g": total_entree,
        "total_hash_g": total_hash,
        "ratio_moyen": ratio_moyen,
    }


@router.post("/hash", response_model=HashExtractionRead)
def create_hash_extraction(
    extraction: HashExtractionCreate, db: Session = Depends(get_db)
):
    """
    Crée une extraction hash (Polinator ou Ice-o-lator).
    - Multi-sources : déduit quantite_utilisee de chaque stock source
    - Polinator → crée 1 entrée Stock "Hash Polinator"
    - Ice-o-lator → crée 1 entrée Stock par maillage utilisé
    """
    # ── Résoudre les sources (multi ou legacy mono-source) ────────────────
    sources = extraction.sources or []
    if not sources and extraction.id_stock_source:
        sources = [{"id_stock": extraction.id_stock_source, "quantite": extraction.quantite_utilisee}]

    if not sources:
        raise HTTPException(status_code=400, detail="Aucun produit source sélectionné")

    # Valider stocks et quantités
    stock_objects = _deduct_sources(sources, extraction.quantite_utilisee, db)

    # Stock de référence = premier (pour métadonnées)
    stock_source_ref = stock_objects[0][0] if stock_objects else None
    id_stock_source_save = stock_source_ref.id_stock if stock_source_ref else extraction.id_stock_source

    # ── Résoudre id_variete depuis le stock source de référence ──────────
    id_variete = extraction.id_variete
    if not id_variete and stock_source_ref and stock_source_ref.id_variete:
        id_variete = stock_source_ref.id_variete

    # ── Résoudre le nom de variété pour nommer les stocks ─────────────────
    variete_nom_stock = None
    if id_variete:
        variete_obj = db.query(Variete).filter(Variete.id_variete == id_variete).first()
        if variete_obj:
            variete_nom_stock = variete_obj.nom_variete
    if not variete_nom_stock:
        variete_nom_stock = extraction.nom_variete_hash or "Hash"

    # ── Déterminer le type_hash automatiquement ───────────────────────────
    src_type = (stock_source_ref.type_stock or "").lower() if stock_source_ref else ""
    if extraction.type_extraction == "Polinator":
        auto_type_hash = "Pollinator"
    elif extraction.type_extraction == "Ice-o-lator":
        auto_type_hash = "Ice-o-Lator WPFF" if "wpff" in src_type else "Ice-O-Lator Dry"
    else:
        auto_type_hash = None

    # ── Créer l'extraction ────────────────────────────────────────────────
    db_extraction = HashExtraction(
        id_variete=id_variete,
        id_iceobag=extraction.id_iceobag,
        id_stock_source=id_stock_source_save,
        nom_variete_hash=extraction.nom_variete_hash,
        date_hashextraction=extraction.date_hashextraction,
        type_extraction=extraction.type_extraction,
        duree_polinator=extraction.duree_polinator,
        passages=extraction.passages,
        sacs=extraction.sacs,
        sources=[{"id_stock": s["id_stock"] if isinstance(s, dict) else s.id_stock,
                   "quantite": float(s["quantite"] if isinstance(s, dict) else s.quantite)}
                  for s in sources],
        quantite_utilisee=extraction.quantite_utilisee,
        quantite_extraite=extraction.quantite_extraite,
        info_hashextraction=extraction.info_hashextraction,
    )
    db.add(db_extraction)

    # ── Déduire de chaque stock source ────────────────────────────────────
    _apply_deductions(stock_objects, extraction.date_hashextraction)

    # ── Créer les entrées de stock hash ───────────────────────────────────
    stock_kwargs = dict(
        id_variete=id_variete,
        date_stock=extraction.date_hashextraction,
        sous_type_stock=stock_source_ref.sous_type_stock if stock_source_ref else None,
        lampe_type=stock_source_ref.lampe_type if stock_source_ref else None,
        engrais_type=stock_source_ref.engrais_type if stock_source_ref else None,
    )

    if extraction.type_extraction == "Polinator":
        db.add(Stock(
            type_stock="Hash",
            quantite_stock=extraction.quantite_extraite,
            maillage="120µ",
            type_hash=auto_type_hash,
            **stock_kwargs
        ))

    elif extraction.type_extraction == "Ice-o-lator" and extraction.sacs:
        for sac in extraction.sacs:
            maillage = sac.get("maillage", "")
            poids    = float(sac.get("poids", 0) or 0)
            if poids > 0:
                db.add(Stock(
                    type_stock="Hash",
                    quantite_stock=poids,
                    maillage=maillage,
                    type_hash=auto_type_hash,
                    **stock_kwargs
                ))

    db.commit()
    db.refresh(db_extraction)
    return _enrich_hash(db_extraction, db)


@router.delete("/hash/{extraction_id}", status_code=204)
def delete_hash_extraction(extraction_id: int, db: Session = Depends(get_db)):
    """Supprime une extraction hash."""
    db_extraction = db.query(HashExtraction).filter(
        HashExtraction.id_hashextraction == extraction_id
    ).first()
    if not db_extraction:
        raise HTTPException(status_code=404, detail="Extraction hash introuvable")
    db.delete(db_extraction)
    db.commit()
