"""Router Materiel — CRUD + export CSV"""
from datetime import date, datetime
from typing import List, Optional
import csv, io

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel

from sqlalchemy import exists
from app.database import get_db
from app.models.all_models import (
    Materiel, Stock, SessionCuring, SessionSechage,
    PlantCuring, PlantSechage, Plant, Culture, Graine, Variete, Breeder,
)
from app.schemas.materiel import MaterielCreate, MaterielRead, MaterielUpdate

router = APIRouter(prefix="/api/materiel", tags=["materiel"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _age(d: date | None) -> int | None:
    if not d:
        return None
    return (date.today() - d).days


def _enrich(row: Materiel) -> MaterielRead:
    obj = MaterielRead.model_validate(row)
    obj.age_jours = _age(row.date_achat)
    return obj


def _load(db: Session, id: int) -> Materiel:
    row = db.query(Materiel).filter(Materiel.id_materiel == id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Matériel introuvable")
    return row


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[MaterielRead])
def get_all(
    categorie: str = None,
    disponibles_seulement: bool = False,
    inclure_id: int = None,          # toujours inclure ce bocal même si occupé (pour édition)
    db: Session = Depends(get_db),
):
    q = db.query(Materiel)
    if categorie:
        q = q.filter(Materiel.categorie == categorie)

    if disponibles_seulement:
        # Bocaux occupés par un stock actif
        id_en_stock = db.query(Stock.id_materiel_bocal).filter(
            Stock.id_materiel_bocal.isnot(None),
            Stock.date_fin_stock.is_(None),
        ).subquery()
        # Bocaux occupés par une session de curing active
        id_en_curing = db.query(SessionCuring.id_materiel_bocal).filter(
            SessionCuring.id_materiel_bocal.isnot(None),
            SessionCuring.statut == "active",
        ).subquery()

        from sqlalchemy import and_, or_
        q = q.filter(
            or_(
                # Disponible : pas en stock ET pas en curing
                and_(
                    ~exists().where(id_en_stock.c.id_materiel_bocal == Materiel.id_materiel),
                    ~exists().where(id_en_curing.c.id_materiel_bocal == Materiel.id_materiel),
                ),
                # Exception : toujours inclure le bocal courant de la session en édition
                Materiel.id_materiel == inclure_id if inclure_id else False,
            )
        )

    rows = q.order_by(Materiel.categorie, Materiel.nom).all()
    return [_enrich(r) for r in rows]


@router.get("/{id_materiel}", response_model=MaterielRead)
def get_one(id_materiel: int, db: Session = Depends(get_db)):
    return _enrich(_load(db, id_materiel))


@router.post("", response_model=MaterielRead, status_code=201)
def create(payload: MaterielCreate, db: Session = Depends(get_db)):
    row = Materiel(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return _enrich(row)


@router.patch("/{id_materiel}", response_model=MaterielRead)
def update(id_materiel: int, payload: MaterielUpdate, db: Session = Depends(get_db)):
    row = _load(db, id_materiel)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    return _enrich(_load(db, id_materiel))


@router.delete("/{id_materiel}", status_code=204)
def delete(id_materiel: int, db: Session = Depends(get_db)):
    row = _load(db, id_materiel)
    db.delete(row)
    db.commit()


# ── Timeline traçabilité bocal ─────────────────────────────────────────────────

class _VarieteMin(BaseModel):
    id_variete: int
    nom_variete: str

class _BreederMin(BaseModel):
    id_breeder: int
    nom_breeder: str

class _GraineMin(BaseModel):
    id_graine: int
    types_graines: Optional[str]
    variete: Optional[_VarieteMin]
    breeder: Optional[_BreederMin]

class _CultureMin(BaseModel):
    id_culture: int
    nom: str
    date_debut: Optional[date]
    date_passage_12_12: Optional[date]
    date_debut_floraison: Optional[date]
    date_recolte_estimee: Optional[date]

class _SechageMin(BaseModel):
    id_session_sechage: int
    nom: Optional[str]
    date_debut: Optional[date]
    date_fin: Optional[date]

class _PlantTimeline(BaseModel):
    id_plant: int
    nom_affichage: str
    date_recolte: Optional[date]
    poids_recolte_g: Optional[float]
    poids_debut_curing_g: Optional[float]
    poids_final_curing_g: Optional[float]
    graine: Optional[_GraineMin]
    culture: Optional[_CultureMin]
    sechage: Optional[_SechageMin]

class _SessionCuringTimeline(BaseModel):
    id_session_curing: int
    nom: Optional[str]
    date_debut: Optional[date]
    date_fin: Optional[date]
    statut: Optional[str]
    plants: List[_PlantTimeline]

class _StockTimeline(BaseModel):
    id_stock: int
    type_stock: Optional[str]
    sous_type_stock: Optional[str]
    quantite_stock: Optional[float]
    date_stock: Optional[date]
    date_fin_stock: Optional[date]
    variete: Optional[_VarieteMin]

class BocalTimelineResponse(BaseModel):
    bocal: MaterielRead
    sessions_curing: List[_SessionCuringTimeline]
    stocks: List[_StockTimeline]


@router.get("/{id_materiel}/bocal-timeline", response_model=BocalTimelineResponse)
def bocal_timeline(id_materiel: int, db: Session = Depends(get_db)):
    """Retourne la chaîne de traçabilité complète d'un bocal : sessions curing → plantes → graines/cultures/séchage + stocks liés."""
    bocal = _load(db, id_materiel)

    # ── Sessions de curing liées ───────────────────────────────────────────────
    sessions_curing_rows = db.query(SessionCuring).filter(
        SessionCuring.id_materiel_bocal == id_materiel
    ).order_by(SessionCuring.date_debut.desc()).all()

    sessions_out = []
    for sc in sessions_curing_rows:
        plants_out = []
        for pc in sc.plants:
            plant = db.query(Plant).filter(Plant.id_plant == pc.id_plant).first()
            if not plant:
                continue

            # Graine + variete + breeder
            graine_out = None
            if plant.id_graine:
                g = db.query(Graine).filter(Graine.id_graine == plant.id_graine).first()
                if g:
                    variete_out = None
                    breeder_out = None
                    if g.id_variete:
                        v = db.query(Variete).filter(Variete.id_variete == g.id_variete).first()
                        if v:
                            variete_out = _VarieteMin(id_variete=v.id_variete, nom_variete=v.nom_variete)
                    if g.id_breeder:
                        b = db.query(Breeder).filter(Breeder.id_breeder == g.id_breeder).first()
                        if b:
                            breeder_out = _BreederMin(id_breeder=b.id_breeder, nom_breeder=b.nom_breeder)
                    graine_out = _GraineMin(
                        id_graine=g.id_graine,
                        types_graines=g.types_graines,
                        variete=variete_out,
                        breeder=breeder_out,
                    )

            # Culture
            culture_out = None
            if plant.id_culture:
                c = db.query(Culture).filter(Culture.id_culture == plant.id_culture).first()
                if c:
                    culture_out = _CultureMin(
                        id_culture=c.id_culture,
                        nom=c.nom,
                        date_debut=c.date_debut,
                        date_passage_12_12=c.date_passage_12_12,
                        date_debut_floraison=c.date_debut_floraison,
                        date_recolte_estimee=c.date_recolte_estimee,
                    )

            # Séchage (chercher la session de séchage la plus récente pour cette plante)
            sechage_out = None
            ps = db.query(PlantSechage).filter(
                PlantSechage.id_plant == plant.id_plant
            ).order_by(PlantSechage.date_mise_sechage.desc()).first()
            if ps:
                ss = db.query(SessionSechage).filter(
                    SessionSechage.id_session_sechage == ps.id_session_sechage
                ).first()
                if ss:
                    # date_fin du séchage = date explicite si renseignée,
                    # sinon on utilise la date de début de la session curing
                    # (entrée en bocal = fin du séchage)
                    date_fin_sechage = ss.date_fin or sc.date_debut
                    sechage_out = _SechageMin(
                        id_session_sechage=ss.id_session_sechage,
                        nom=ss.nom,
                        date_debut=ss.date_debut,
                        date_fin=date_fin_sechage,
                    )

            plants_out.append(_PlantTimeline(
                id_plant=plant.id_plant,
                nom_affichage=plant.nom_affichage,
                date_recolte=plant.date_recolte,
                poids_recolte_g=float(plant.poids_recolte_g) if plant.poids_recolte_g else None,
                poids_debut_curing_g=float(pc.poids_debut_g) if pc.poids_debut_g else None,
                poids_final_curing_g=float(pc.poids_final_g) if pc.poids_final_g else None,
                graine=graine_out,
                culture=culture_out,
                sechage=sechage_out,
            ))

        sessions_out.append(_SessionCuringTimeline(
            id_session_curing=sc.id_session_curing,
            nom=sc.nom,
            date_debut=sc.date_debut,
            date_fin=sc.date_fin,
            statut=sc.statut,
            plants=plants_out,
        ))

    # ── Stocks liés ───────────────────────────────────────────────────────────
    stocks_rows = db.query(Stock).filter(
        Stock.id_materiel_bocal == id_materiel
    ).order_by(Stock.date_stock.desc()).all()

    stocks_out = []
    for s in stocks_rows:
        variete_out = None
        if s.id_variete:
            v = db.query(Variete).filter(Variete.id_variete == s.id_variete).first()
            if v:
                variete_out = _VarieteMin(id_variete=v.id_variete, nom_variete=v.nom_variete)
        stocks_out.append(_StockTimeline(
            id_stock=s.id_stock,
            type_stock=s.type_stock,
            sous_type_stock=s.sous_type_stock,
            quantite_stock=float(s.quantite_stock) if s.quantite_stock else None,
            date_stock=s.date_stock,
            date_fin_stock=s.date_fin_stock,
            variete=variete_out,
        ))

    return BocalTimelineResponse(
        bocal=_enrich(bocal),
        sessions_curing=sessions_out,
        stocks=stocks_out,
    )


# ── Export CSV ────────────────────────────────────────────────────────────────

@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    rows = db.query(Materiel).order_by(Materiel.categorie, Materiel.nom).all()
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        "id_materiel", "categorie", "nom", "marque", "code_barre_serial",
        "date_achat", "prix_achat", "site_achat", "etat", "notes",
        "caracteristiques"
    ]
    writer.writerow(headers)

    import json
    for r in rows:
        writer.writerow([
            r.id_materiel, r.categorie, r.nom, r.marque or "",
            r.code_barre_serial or "",
            r.date_achat.isoformat() if r.date_achat else "",
            str(r.prix_achat) if r.prix_achat is not None else "",
            r.site_achat or "", r.etat or "", r.notes or "",
            json.dumps(r.caracteristiques, ensure_ascii=False) if r.caracteristiques else "",
        ])

    content = output.getvalue()
    filename = f"materiel_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=content.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
