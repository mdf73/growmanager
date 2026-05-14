"""Routers pour Stock"""
from datetime import date
from typing import Optional, List
import io
import json
import os
import tempfile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from app.database import get_db
from app.models import Stock, Variete, Bocal
from app.models.all_models import (
    Materiel, Plant, Culture, Graine, Breeder,
    SessionCuring, PlantCuring, PlantSechage, SessionSechage, Variete as VarieteModel,
)
from app.schemas.stock import StockCreate, StockRead, StockWithVariete, BocalDisponible

# ── Imports QR / PDF (optionnels — ne plante pas si lib absente) ─────────────
try:
    import qrcode
    from fpdf import FPDF
    _QR_AVAILABLE = True
except ImportError:
    _QR_AVAILABLE = False

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

    # V4-F — enrichissement plante
    plant_nom = None
    plant_culture_nom = None
    if stock.id_plant:
        plant = db.query(Plant).filter(Plant.id_plant == stock.id_plant).first()
        if plant:
            plant_nom = plant.nom_affichage
            culture = db.query(Culture).filter(Culture.id_culture == plant.id_culture).first()
            if culture:
                plant_culture_nom = culture.nom

    return StockWithVariete(
        id_stock=          stock.id_stock,
        id_variete=        stock.id_variete,
        id_bocal=          stock.id_bocal,
        id_materiel_bocal= stock.id_materiel_bocal,
        id_plant=          stock.id_plant,
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
        plant_nom=         plant_nom,
        plant_culture_nom= plant_culture_nom,
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
        id_plant=          stock.id_plant,
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
        quantite_initiale= stock.quantite_stock,   # V4-G — référence pour alertes %
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
    db_stock.id_plant          = stock.id_plant
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


# ── GET origine (traçabilité) ──────────────────────────────────────────────────

class _BreederMin(BaseModel):
    id_breeder: int
    nom_breeder: str

class _VarieteDetail(BaseModel):
    id_variete: int
    nom_variete: str
    croisement_variete: Optional[str]
    informations_variete: Optional[str]
    lien_web: Optional[str]

class _GrainePlant(BaseModel):
    id_graine: int
    types_graines: Optional[str]
    breeder: Optional[_BreederMin]

class _PlantOrigine(BaseModel):
    id_plant: int
    nom_affichage: str
    date_recolte: Optional[date]
    poids_recolte_g: Optional[float]
    statut: Optional[str]
    graine: Optional[_GrainePlant]
    sechage_date_debut: Optional[date]
    sechage_date_fin: Optional[date]
    curing_date_debut: Optional[date]
    poids_debut_curing_g: Optional[float]
    poids_final_curing_g: Optional[float]

class _CultureSource(BaseModel):
    id_culture: int
    nom: str
    statut: Optional[str]
    date_debut: Optional[date]
    date_passage_12_12: Optional[date]
    date_debut_floraison: Optional[date]
    plants: List[_PlantOrigine]

class _BocalInfo(BaseModel):
    id_materiel: int
    nom: str
    volume_ml: Optional[float]

class StockOrigineResponse(BaseModel):
    stock: StockWithVariete
    variete: Optional[_VarieteDetail]
    bocal: Optional[_BocalInfo]
    cultures_source: List[_CultureSource]


def _build_plant_origine(plant: Plant, db: Session) -> _PlantOrigine:
    """Enrichit une plante avec graine, breeder, séchage, curing."""
    graine_out = None
    if plant.id_graine:
        g = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
        if g:
            breeder_out = None
            if g.id_breeder:
                b = db.query(Breeder).filter(Breeder.id_breeder == g.id_breeder).first()
                if b:
                    breeder_out = _BreederMin(id_breeder=b.id_breeder, nom_breeder=b.nom_breeder)
            graine_out = _GrainePlant(
                id_graine=g.id_graine,
                types_graines=g.types_graines,
                breeder=breeder_out,
            )

    # Séchage le plus récent
    sech_debut = sech_fin = None
    ps = db.query(PlantSechage).filter(
        PlantSechage.id_plant == plant.id_plant
    ).order_by(PlantSechage.date_mise_sechage.desc()).first()
    if ps:
        ss = db.query(SessionSechage).filter(
            SessionSechage.id_session_sechage == ps.id_session_sechage
        ).first()
        if ss:
            sech_debut, sech_fin = ss.date_debut, ss.date_fin

    # Curing le plus récent
    cur_debut = poids_debut = poids_final = None
    pc = db.query(PlantCuring).filter(
        PlantCuring.id_plant == plant.id_plant
    ).order_by(PlantCuring.date_mise_curing.desc()).first()
    if pc:
        sc = db.query(SessionCuring).filter(
            SessionCuring.id_session_curing == pc.id_session_curing
        ).first()
        if sc:
            cur_debut = sc.date_debut
        poids_debut  = float(pc.poids_debut_g)  if pc.poids_debut_g  else None
        poids_final  = float(pc.poids_final_g)  if pc.poids_final_g  else None

    return _PlantOrigine(
        id_plant=plant.id_plant,
        nom_affichage=plant.nom_affichage,
        date_recolte=plant.date_recolte,
        poids_recolte_g=float(plant.poids_recolte_g) if plant.poids_recolte_g else None,
        statut=plant.statut,
        graine=graine_out,
        sechage_date_debut=sech_debut,
        sechage_date_fin=sech_fin,
        curing_date_debut=cur_debut,
        poids_debut_curing_g=poids_debut,
        poids_final_curing_g=poids_final,
    )


@router.get("/{stock_id}/origine", response_model=StockOrigineResponse)
def stock_origine(stock_id: int, db: Session = Depends(get_db)):
    """Retourne la traçabilité complète d'un stock : variété, bocal, cultures source et leurs plantes."""
    s = db.query(Stock).filter(Stock.id_stock == stock_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Stock non trouvé")

    enriched = _enrich(s, db)

    # ── Variété ───────────────────────────────────────────────────────────────
    variete_out = None
    if s.id_variete:
        v = db.query(Variete).filter(Variete.id_variete == s.id_variete).first()
        if v:
            variete_out = _VarieteDetail(
                id_variete=v.id_variete,
                nom_variete=v.nom_variete,
                croisement_variete=v.croisement_variete,
                informations_variete=v.informations_variete,
                lien_web=v.lien_web,
            )

    # ── Bocal ─────────────────────────────────────────────────────────────────
    bocal_out = None
    if s.id_materiel_bocal:
        mat = db.query(Materiel).filter(Materiel.id_materiel == s.id_materiel_bocal).first()
        if mat:
            vol = None
            try:
                c = mat.caracteristiques if isinstance(mat.caracteristiques, dict) \
                    else json.loads(mat.caracteristiques or '{}')
                vol = c.get("volume_ml")
            except Exception:
                pass
            bocal_out = _BocalInfo(id_materiel=mat.id_materiel, nom=mat.nom, volume_ml=vol)

    # ── Cultures source ───────────────────────────────────────────────────────
    # Si id_plant connu → culture unique, plante unique (traçabilité précise)
    # Sinon → toutes les cultures qui ont cultivé cette variété
    cultures_out: List[_CultureSource] = []

    if s.id_plant:
        # Chemin précis : on connaît la plante exacte
        direct_plant = db.query(Plant).filter(Plant.id_plant == s.id_plant).first()
        if direct_plant and direct_plant.id_culture:
            c = db.query(Culture).filter(Culture.id_culture == direct_plant.id_culture).first()
            if c:
                cultures_out.append(_CultureSource(
                    id_culture=c.id_culture,
                    nom=c.nom,
                    statut=c.statut,
                    date_debut=c.date_debut,
                    date_passage_12_12=c.date_passage_12_12,
                    date_debut_floraison=c.date_debut_floraison,
                    plants=[_build_plant_origine(direct_plant, db)],
                ))
    elif s.id_variete:
        # Chemin large : toutes les plantes de cette variété (héritage / stock sans plante)
        plants_with_variete = (
            db.query(Plant)
            .join(Graine, Graine.id_graine == Plant.id_graine)
            .filter(Graine.id_variete == s.id_variete)
            .all()
        )
        culture_map: dict[int, list[Plant]] = {}
        for plant in plants_with_variete:
            culture_map.setdefault(plant.id_culture, []).append(plant)

        for id_culture, culture_plants in culture_map.items():
            c = db.query(Culture).filter(Culture.id_culture == id_culture).first()
            if not c:
                continue
            plants_out = [_build_plant_origine(p, db) for p in culture_plants]
            cultures_out.append(_CultureSource(
                id_culture=c.id_culture,
                nom=c.nom,
                statut=c.statut,
                date_debut=c.date_debut,
                date_passage_12_12=c.date_passage_12_12,
                date_debut_floraison=c.date_debut_floraison,
                plants=plants_out,
            ))
        # Tri par date de début (plus récente en premier)
        cultures_out.sort(key=lambda x: x.date_debut or date.min, reverse=True)

    return StockOrigineResponse(
        stock=enriched,
        variete=variete_out,
        bocal=bocal_out,
        cultures_source=cultures_out,
    )


# ── GET label PDF ─────────────────────────────────────────────────────────────

@router.get("/{stock_id}/label")
def stock_label(stock_id: int, db: Session = Depends(get_db)):
    """
    Génère un PDF étiquette imprimable (100×60 mm) pour un bocal de stock.
    Contient : QR code (id stock), variété, type, quantité, date, bocal.
    """
    if not _QR_AVAILABLE:
        raise HTTPException(
            status_code=501,
            detail="Librairies qrcode / fpdf2 non installées dans le conteneur."
        )

    s = db.query(Stock).filter(Stock.id_stock == stock_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Stock non trouvé")

    enriched = _enrich(s, db)

    # ── Données label ─────────────────────────────────────────────────────────
    variete_label = enriched.variete_nom or "—"
    if enriched.plant_nom:
        variete_label = f"{enriched.plant_nom} ({variete_label})"

    # Type : "Fleur LSO", "Hash · 73µ · Ice-o-lator", "Engrais · BioBizz"…
    is_lso = enriched.sous_type_stock and "lso" in enriched.sous_type_stock.lower()
    type_label = enriched.type_stock or ""
    if is_lso:
        type_label += " LSO"
    elif enriched.sous_type_stock:
        type_label += f" · {enriched.sous_type_stock}"
    if enriched.maillage:
        type_label += f" · {enriched.maillage}"
    if enriched.type_hash:
        type_label += f" · {enriched.type_hash}"
    if enriched.type_rosin:
        type_label += f" · {enriched.type_rosin}"

    # Engrais
    engrais_label = enriched.engrais_type or None

    bocal_label = enriched.bocal_nom or enriched.bocal_taille or "—"
    if enriched.bocal_volume_ml:
        bocal_label += f" ({int(enriched.bocal_volume_ml)} ml)"

    quantite_label = f"{enriched.quantite_stock:.1f} g"
    date_label = enriched.date_stock.strftime("%d/%m/%Y") if enriched.date_stock else "—"

    base_url = os.getenv("GROWMANAGER_URL", "http://growmanager").rstrip("/")
    qr_data = f"{base_url}/stock?id={stock_id}"

    # ── QR code → fichier temp PNG ────────────────────────────────────────────
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    tmp_qr = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    try:
        qr_img.save(tmp_qr.name)
        tmp_qr.close()

        # ── PDF 100×60 mm ─────────────────────────────────────────────────────
        pdf = FPDF(orientation="L", unit="mm", format=(60, 100))
        pdf.add_page()
        pdf.set_margins(3, 3, 3)
        pdf.set_auto_page_break(False)

        # Ligne décorative supérieure
        pdf.set_fill_color(34, 139, 34)          # vert forêt
        pdf.rect(0, 0, 100, 5, style="F")

        # QR code (côté gauche)
        qr_size = 42
        pdf.image(tmp_qr.name, x=3, y=7, w=qr_size, h=qr_size)

        # Texte (côté droit)
        x_txt = qr_size + 6
        w_txt = 100 - x_txt - 3

        # ID stock petit
        pdf.set_xy(x_txt, 7)
        pdf.set_font("Helvetica", style="", size=7)
        pdf.set_text_color(120, 120, 120)
        pdf.cell(w_txt, 4, f"#{stock_id}", ln=True)

        # Variété — gros titre
        pdf.set_xy(x_txt, 12)
        pdf.set_font("Helvetica", style="B", size=11)
        pdf.set_text_color(20, 20, 20)
        pdf.multi_cell(w_txt, 5, variete_label, ln=True)

        # Type
        pdf.set_x(x_txt)
        pdf.set_font("Helvetica", style="", size=9)
        pdf.set_text_color(50, 50, 50)
        pdf.multi_cell(w_txt, 4, type_label, ln=True)

        # Séparateur
        y_sep = pdf.get_y() + 1
        pdf.set_draw_color(200, 200, 200)
        pdf.line(x_txt, y_sep, 97, y_sep)

        # Quantité + date
        pdf.set_xy(x_txt, y_sep + 2)
        pdf.set_font("Helvetica", style="B", size=10)
        pdf.set_text_color(34, 139, 34)
        pdf.cell(w_txt / 2, 5, quantite_label)
        pdf.set_font("Helvetica", style="", size=8)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(w_txt / 2, 5, date_label, ln=True)

        # Bocal
        pdf.set_x(x_txt)
        pdf.set_font("Helvetica", style="", size=7)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(w_txt, 4, f"Bocal : {bocal_label}", ln=True)

        # Engrais (si renseigné)
        if engrais_label:
            pdf.set_x(x_txt)
            pdf.set_font("Helvetica", style="", size=7)
            pdf.set_text_color(100, 100, 100)
            pdf.cell(w_txt, 4, f"Engrais : {engrais_label}", ln=True)

        # Ligne décorative inférieure
        pdf.set_fill_color(34, 139, 34)
        pdf.rect(0, 55, 100, 5, style="F")

        # Watermark GrowManager
        pdf.set_xy(0, 55.5)
        pdf.set_font("Helvetica", style="I", size=6)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(100, 3, "GrowManager", align="R")

        pdf_bytes = pdf.output()

    finally:
        os.unlink(tmp_qr.name)

    filename = f"label_stock_{stock_id}.pdf"
    return StreamingResponse(
        io.BytesIO(bytes(pdf_bytes)),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
