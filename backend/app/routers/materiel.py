"""Router Materiel — CRUD + export CSV"""
from datetime import date, datetime
from typing import List
import csv, io

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from sqlalchemy import exists
from app.database import get_db
from app.models.all_models import Materiel, Stock, SessionCuring
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
