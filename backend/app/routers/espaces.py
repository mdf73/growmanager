"""Router EspaceCulture — CRUD espaces de culture + export CSV"""
import csv, io
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import EspaceCulture, EspaceMateriel, Materiel
from app.schemas.espaces import (
    EspaceCultureCreate, EspaceCultureUpdate, EspaceCultureRead,
    EspaceMaterielRead,
)

router = APIRouter(prefix="/api/espaces", tags=["espaces"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _enrich_equip(e: EspaceMateriel, db: Session) -> EspaceMaterielRead:
    m = db.query(Materiel).filter(Materiel.id_materiel == e.id_materiel).first()
    return EspaceMaterielRead(
        id_espace_materiel=e.id_espace_materiel,
        id_materiel=e.id_materiel,
        date_assignation=e.date_assignation,
        notes=e.notes,
        nom_materiel=m.nom       if m else None,
        categorie=   m.categorie if m else None,
        marque=      m.marque    if m else None,
        etat=        m.etat      if m else None,
    )


def _enrich(esp: EspaceCulture, db: Session) -> EspaceCultureRead:
    nom_mp = None
    if esp.id_materiel_principal:
        m = db.query(Materiel).filter(Materiel.id_materiel == esp.id_materiel_principal).first()
        nom_mp = m.nom if m else None
    return EspaceCultureRead(
        id_espace=              esp.id_espace,
        nom=                    esp.nom,
        type_espace=            esp.type_espace,
        id_materiel_principal=  esp.id_materiel_principal,
        nom_materiel_principal= nom_mp,
        dimensions=             esp.dimensions,
        surface_m2=             float(esp.surface_m2) if esp.surface_m2 is not None else None,
        hauteur_cm=             esp.hauteur_cm,
        statut=                 esp.statut,
        notes=                  esp.notes,
        equipements=            [_enrich_equip(e, db) for e in esp.equipements],
    )


def _load(db: Session, id: int) -> EspaceCulture:
    esp = db.query(EspaceCulture).filter(EspaceCulture.id_espace == id).first()
    if not esp:
        raise HTTPException(status_code=404, detail="Espace de culture introuvable")
    return esp


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[EspaceCultureRead])
def get_all(db: Session = Depends(get_db)):
    espaces = db.query(EspaceCulture).order_by(EspaceCulture.nom).all()
    return [_enrich(e, db) for e in espaces]


@router.get("/materiel-en-use")
def get_materiel_en_use(db: Session = Depends(get_db)):
    """Retourne tous les matériels déjà assignés à un espace de culture."""
    rows = (
        db.query(EspaceMateriel.id_materiel, EspaceCulture.id_espace, EspaceCulture.nom)
        .join(EspaceCulture, EspaceMateriel.id_espace == EspaceCulture.id_espace)
        .all()
    )
    return [{"id_materiel": r.id_materiel, "id_espace": r.id_espace, "nom_espace": r.nom} for r in rows]


@router.get("/{espace_id}", response_model=EspaceCultureRead)
def get_one(espace_id: int, db: Session = Depends(get_db)):
    return _enrich(_load(db, espace_id), db)


@router.post("/", response_model=EspaceCultureRead, status_code=201)
def create(payload: EspaceCultureCreate, db: Session = Depends(get_db)):
    esp = EspaceCulture(
        nom=payload.nom, type_espace=payload.type_espace,
        id_materiel_principal=payload.id_materiel_principal,
        dimensions=payload.dimensions, surface_m2=payload.surface_m2,
        hauteur_cm=payload.hauteur_cm, statut=payload.statut or "Actif",
        notes=payload.notes,
    )
    db.add(esp); db.flush()
    for eq in payload.equipements:
        db.add(EspaceMateriel(
            id_espace=esp.id_espace,
            id_materiel=eq.id_materiel,
            date_assignation=eq.date_assignation,
            notes=eq.notes,
        ))
    db.commit(); db.refresh(esp)
    return _enrich(esp, db)


@router.put("/{espace_id}", response_model=EspaceCultureRead)
def update(espace_id: int, payload: EspaceCultureUpdate, db: Session = Depends(get_db)):
    esp = _load(db, espace_id)
    for field in ("nom", "type_espace", "id_materiel_principal", "dimensions", "surface_m2", "hauteur_cm", "statut", "notes"):
        val = getattr(payload, field)
        if val is not None:
            setattr(esp, field, val)
    if payload.equipements is not None:
        for old in esp.equipements:
            db.delete(old)
        db.flush()
        for eq in payload.equipements:
            db.add(EspaceMateriel(
                id_espace=esp.id_espace,
                id_materiel=eq.id_materiel,
                date_assignation=eq.date_assignation,
                notes=eq.notes,
            ))
    db.commit(); db.refresh(esp)
    return _enrich(esp, db)


@router.delete("/{espace_id}", status_code=204)
def delete(espace_id: int, db: Session = Depends(get_db)):
    esp = _load(db, espace_id)
    db.delete(esp); db.commit()


# ── Export CSV ────────────────────────────────────────────────────────────────

@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    espaces = db.query(EspaceCulture).order_by(EspaceCulture.nom).all()
    output  = io.StringIO()
    writer  = csv.writer(output)

    writer.writerow(["id_espace", "nom", "type_espace", "dimensions",
                     "surface_m2", "hauteur_cm", "statut", "notes",
                     "nb_equipements"])
    for esp in espaces:
        writer.writerow([
            esp.id_espace, esp.nom, esp.type_espace or "",
            esp.dimensions or "",
            str(esp.surface_m2) if esp.surface_m2 else "",
            str(esp.hauteur_cm) if esp.hauteur_cm else "",
            esp.statut or "",
            esp.notes or "",
            len(esp.equipements),
        ])

    content  = output.getvalue()
    filename = f"espaces_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=content.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Import CSV ────────────────────────────────────────────────────────────────

@router.post("/import", status_code=201)
async def import_espaces(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Import CSV. Colonnes attendues : nom, type_espace, dimensions,
    surface_m2, hauteur_cm, statut, notes"""
    content = await file.read()
    text    = content.decode("utf-8-sig")
    reader  = csv.DictReader(io.StringIO(text))
    created = 0
    for row in reader:
        nom = row.get("nom", "").strip()
        if not nom:
            continue
        esp = EspaceCulture(
            nom=        nom,
            type_espace=row.get("type_espace", "").strip() or None,
            dimensions= row.get("dimensions",  "").strip() or None,
            surface_m2= float(row["surface_m2"]) if row.get("surface_m2", "").strip() else None,
            hauteur_cm= int(row["hauteur_cm"])   if row.get("hauteur_cm",  "").strip() else None,
            statut=     row.get("statut", "Actif").strip() or "Actif",
            notes=      row.get("notes", "").strip() or None,
        )
        db.add(esp)
        created += 1
    db.commit()
    return {"imported": created}
