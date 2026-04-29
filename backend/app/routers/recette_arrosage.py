"""Router RecetteArrosage — CRUD recettes d'arrosage"""
import csv, io, json
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import RecetteArrosage, RecetteArrosageLigne, ProduitEngrais
from app.schemas.recette_arrosage import (
    RecetteArrosageCreate, RecetteArrosageUpdate, RecetteArrosageRead,
    RecetteArrosageLigneRead,
)

router = APIRouter(prefix="/api/recettes-arrosage", tags=["recettes-arrosage"])


def _enrich_ligne(l: RecetteArrosageLigne, db: Session) -> RecetteArrosageLigneRead:
    p = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == l.id_produit).first()
    return RecetteArrosageLigneRead(
        id_ligne=l.id_ligne, id_produit=l.id_produit,
        quantite=float(l.quantite), unite=l.unite,
        note_ligne=l.note_ligne, ordre=l.ordre,
        nom_produit=p.nom_produit if p else None,
        type_produit=p.type_produit if p else None,
    )


def _enrich(r: RecetteArrosage, db: Session) -> RecetteArrosageRead:
    return RecetteArrosageRead(
        id_recette_arrosage=r.id_recette_arrosage,
        nom_recette=r.nom_recette, type_arrosage=r.type_arrosage,
        quantite_eau=float(r.quantite_eau) if r.quantite_eau is not None else None,
        unite_eau=r.unite_eau, notes=r.notes,
        lignes=[_enrich_ligne(l, db) for l in r.lignes],
    )


@router.get("/", response_model=List[RecetteArrosageRead])
def get_all(db: Session = Depends(get_db)):
    return [_enrich(r, db) for r in db.query(RecetteArrosage).order_by(RecetteArrosage.nom_recette).all()]


@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    recettes = db.query(RecetteArrosage).order_by(RecetteArrosage.nom_recette).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["nom_recette", "type_arrosage", "quantite_eau", "unite_eau", "notes", "lignes_json"])
    for r in recettes:
        lignes = [{"nom_produit": _get_nom_produit(l, db), "quantite": float(l.quantite),
                   "unite": l.unite or "", "note_ligne": l.note_ligne or ""} for l in r.lignes]
        writer.writerow([r.nom_recette, r.type_arrosage or "",
                         str(r.quantite_eau) if r.quantite_eau is not None else "",
                         r.unite_eau or "", r.notes or "", json.dumps(lignes, ensure_ascii=False)])
    content  = output.getvalue()
    filename = f"recettes_arrosage_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(content=content.encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _get_nom_produit(ligne: RecetteArrosageLigne, db: Session) -> str:
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
        r = RecetteArrosage(
            nom_recette=nom,
            type_arrosage=row.get("type_arrosage", "").strip() or None,
            quantite_eau=float(row["quantite_eau"]) if row.get("quantite_eau", "").strip() else None,
            unite_eau=row.get("unite_eau", "").strip() or None,
            notes=row.get("notes", "").strip() or None,
        )
        db.add(r); db.flush()
        lignes_raw = row.get("lignes_json", "").strip()
        if lignes_raw:
            for i, l in enumerate(json.loads(lignes_raw)):
                nom_p = l.get("nom_produit", "")
                p = db.query(ProduitEngrais).filter(ProduitEngrais.nom_produit == nom_p).first()
                if p:
                    db.add(RecetteArrosageLigne(
                        id_recette_arrosage=r.id_recette_arrosage, id_produit=p.id_produit,
                        quantite=l.get("quantite", 0), unite=l.get("unite", ""),
                        note_ligne=l.get("note_ligne") or None, ordre=i,
                    ))
        created += 1
    db.commit()
    return {"imported": created}


@router.get("/{recette_id}", response_model=RecetteArrosageRead)
def get_one(recette_id: int, db: Session = Depends(get_db)):
    r = db.query(RecetteArrosage).filter(RecetteArrosage.id_recette_arrosage == recette_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recette arrosage introuvable")
    return _enrich(r, db)


@router.post("/", response_model=RecetteArrosageRead, status_code=201)
def create(payload: RecetteArrosageCreate, db: Session = Depends(get_db)):
    r = RecetteArrosage(
        nom_recette=payload.nom_recette, type_arrosage=payload.type_arrosage,
        quantite_eau=payload.quantite_eau, unite_eau=payload.unite_eau, notes=payload.notes,
    )
    db.add(r); db.flush()
    for i, l in enumerate(payload.lignes):
        db.add(RecetteArrosageLigne(
            id_recette_arrosage=r.id_recette_arrosage, id_produit=l.id_produit,
            quantite=l.quantite, unite=l.unite,
            note_ligne=l.note_ligne, ordre=l.ordre if l.ordre else i,
        ))
    db.commit(); db.refresh(r)
    return _enrich(r, db)


@router.put("/{recette_id}", response_model=RecetteArrosageRead)
def update(recette_id: int, payload: RecetteArrosageUpdate, db: Session = Depends(get_db)):
    r = db.query(RecetteArrosage).filter(RecetteArrosage.id_recette_arrosage == recette_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recette arrosage introuvable")
    for field in ("nom_recette", "type_arrosage", "quantite_eau", "unite_eau", "notes"):
        val = getattr(payload, field)
        if val is not None:
            setattr(r, field, val)
    if payload.lignes is not None:
        for old in r.lignes:
            db.delete(old)
        db.flush()
        for i, l in enumerate(payload.lignes):
            db.add(RecetteArrosageLigne(
                id_recette_arrosage=r.id_recette_arrosage, id_produit=l.id_produit,
                quantite=l.quantite, unite=l.unite,
                note_ligne=l.note_ligne, ordre=l.ordre if l.ordre else i,
            ))
    db.commit(); db.refresh(r)
    return _enrich(r, db)


@router.delete("/{recette_id}", status_code=204)
def delete(recette_id: int, db: Session = Depends(get_db)):
    r = db.query(RecetteArrosage).filter(RecetteArrosage.id_recette_arrosage == recette_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recette arrosage introuvable")
    db.delete(r); db.commit()
