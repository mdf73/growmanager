"""Router RecetteFermentation — CRUD recettes de fermentation"""
import csv, io, json
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import RecetteFermentation, RecetteFermentationLigne, ProduitEngrais
from app.schemas.recette_fermentation import (
    RecetteFermentationCreate, RecetteFermentationUpdate, RecetteFermentationRead,
    RecetteFermentationLigneRead,
)

router = APIRouter(prefix="/api/recettes-fermentation", tags=["recettes-fermentation"])


def _enrich_ligne(l: RecetteFermentationLigne, db: Session) -> RecetteFermentationLigneRead:
    p = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == l.id_produit).first()
    return RecetteFermentationLigneRead(
        id_ligne=l.id_ligne, id_produit=l.id_produit,
        quantite=float(l.quantite), unite=l.unite,
        note_ligne=l.note_ligne, ordre=l.ordre,
        nom_produit=p.nom_produit if p else None,
        type_produit=p.type_produit if p else None,
    )


def _enrich(r: RecetteFermentation, db: Session) -> RecetteFermentationRead:
    return RecetteFermentationRead(
        id_recette_ferm=r.id_recette_ferm,
        nom_recette=r.nom_recette, type_fermentation=r.type_fermentation,
        volume_total=float(r.volume_total) if r.volume_total is not None else None,
        unite_volume=r.unite_volume,
        duree_fermentation=r.duree_fermentation,
        notes=r.notes,
        lignes=[_enrich_ligne(l, db) for l in r.lignes],
    )


@router.get("/", response_model=List[RecetteFermentationRead])
def get_all(db: Session = Depends(get_db)):
    return [_enrich(r, db) for r in db.query(RecetteFermentation).order_by(RecetteFermentation.nom_recette).all()]


@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    recettes = db.query(RecetteFermentation).order_by(RecetteFermentation.nom_recette).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["nom_recette", "type_fermentation", "volume_total", "unite_volume",
                     "duree_fermentation", "notes", "lignes_json"])
    for r in recettes:
        lignes = [{"nom_produit": _get_nom_produit(l, db), "quantite": float(l.quantite),
                   "unite": l.unite or "", "note_ligne": l.note_ligne or ""} for l in r.lignes]
        writer.writerow([r.nom_recette, r.type_fermentation or "",
                         str(r.volume_total) if r.volume_total is not None else "",
                         r.unite_volume or "",
                         str(r.duree_fermentation) if r.duree_fermentation is not None else "",
                         r.notes or "", json.dumps(lignes, ensure_ascii=False)])
    content  = output.getvalue()
    filename = f"recettes_fermentation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(content=content.encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _get_nom_produit(ligne: RecetteFermentationLigne, db: Session) -> str:
    p = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne.id_produit).first()
    return p.nom_produit if p else ""


@router.post("/import", status_code=201)
async def import_recettes(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    created = 0
    for row in reader:
        nom = row.get("nom_recette", "").strip()
        if not nom:
            continue
        r = RecetteFermentation(
            nom_recette=nom,
            type_fermentation=row.get("type_fermentation", "").strip() or None,
            volume_total=float(row["volume_total"]) if row.get("volume_total", "").strip() else None,
            unite_volume=row.get("unite_volume", "").strip() or None,
            duree_fermentation=int(row["duree_fermentation"]) if row.get("duree_fermentation", "").strip() else None,
            notes=row.get("notes", "").strip() or None,
        )
        db.add(r); db.flush()
        lignes_raw = row.get("lignes_json", "").strip()
        if lignes_raw:
            for i, l in enumerate(json.loads(lignes_raw)):
                nom_p = l.get("nom_produit", "")
                p = db.query(ProduitEngrais).filter(ProduitEngrais.nom_produit == nom_p).first()
                if p:
                    db.add(RecetteFermentationLigne(
                        id_recette_ferm=r.id_recette_ferm, id_produit=p.id_produit,
                        quantite=l.get("quantite", 0), unite=l.get("unite", ""),
                        note_ligne=l.get("note_ligne") or None, ordre=i,
                    ))
        created += 1
    db.commit()
    return {"imported": created}


@router.get("/{recette_id}", response_model=RecetteFermentationRead)
def get_one(recette_id: int, db: Session = Depends(get_db)):
    r = db.query(RecetteFermentation).filter(RecetteFermentation.id_recette_ferm == recette_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recette fermentation introuvable")
    return _enrich(r, db)


@router.post("/", response_model=RecetteFermentationRead, status_code=201)
def create(payload: RecetteFermentationCreate, db: Session = Depends(get_db)):
    r = RecetteFermentation(
        nom_recette=payload.nom_recette, type_fermentation=payload.type_fermentation,
        volume_total=payload.volume_total, unite_volume=payload.unite_volume,
        duree_fermentation=payload.duree_fermentation, notes=payload.notes,
    )
    db.add(r); db.flush()
    for i, l in enumerate(payload.lignes):
        db.add(RecetteFermentationLigne(
            id_recette_ferm=r.id_recette_ferm, id_produit=l.id_produit,
            quantite=l.quantite, unite=l.unite,
            note_ligne=l.note_ligne, ordre=l.ordre if l.ordre else i,
        ))
    db.commit(); db.refresh(r)
    return _enrich(r, db)


@router.put("/{recette_id}", response_model=RecetteFermentationRead)
def update(recette_id: int, payload: RecetteFermentationUpdate, db: Session = Depends(get_db)):
    r = db.query(RecetteFermentation).filter(RecetteFermentation.id_recette_ferm == recette_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recette fermentation introuvable")
    for field in ("nom_recette", "type_fermentation", "volume_total", "unite_volume", "duree_fermentation", "notes"):
        val = getattr(payload, field)
        if val is not None:
            setattr(r, field, val)
    if payload.lignes is not None:
        for old in r.lignes:
            db.delete(old)
        db.flush()
        for i, l in enumerate(payload.lignes):
            db.add(RecetteFermentationLigne(
                id_recette_ferm=r.id_recette_ferm, id_produit=l.id_produit,
                quantite=l.quantite, unite=l.unite,
                note_ligne=l.note_ligne, ordre=l.ordre if l.ordre else i,
            ))
    db.commit(); db.refresh(r)
    return _enrich(r, db)


@router.delete("/{recette_id}", status_code=204)
def delete(recette_id: int, db: Session = Depends(get_db)):
    r = db.query(RecetteFermentation).filter(RecetteFermentation.id_recette_ferm == recette_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recette fermentation introuvable")
    db.delete(r); db.commit()
