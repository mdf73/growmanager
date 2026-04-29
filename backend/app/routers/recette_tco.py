"""Router RecetteTCO — CRUD recettes Thé de Compost"""
import csv, io, json
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import RecetteTCO, RecetteTCOLigne, ProduitEngrais
from app.schemas.recette_tco import (
    RecetteTCOCreate, RecetteTCOUpdate, RecetteTCORead, RecetteTCOLigneRead,
)

router = APIRouter(prefix="/api/recettes-tco", tags=["recettes-tco"])


def _enrich_ligne(ligne: RecetteTCOLigne, db: Session) -> RecetteTCOLigneRead:
    produit = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne.id_produit).first()
    return RecetteTCOLigneRead(
        id_ligne=ligne.id_ligne,
        id_produit=ligne.id_produit,
        quantite=float(ligne.quantite),
        unite=ligne.unite,
        note_ligne=ligne.note_ligne,
        ordre=ligne.ordre,
        nom_produit=produit.nom_produit if produit else None,
        type_produit=produit.type_produit if produit else None,
    )


def _enrich(recette: RecetteTCO, db: Session) -> RecetteTCORead:
    return RecetteTCORead(
        id_recette_tco=recette.id_recette_tco,
        nom_recette=recette.nom_recette,
        type_tco=recette.type_tco,
        quantite_tco=float(recette.quantite_tco) if recette.quantite_tco is not None else None,
        unite_tco=recette.unite_tco,
        duree_oxygenation_h=recette.duree_oxygenation_h,
        notes=recette.notes,
        lignes=[_enrich_ligne(l, db) for l in recette.lignes],
    )


@router.get("/", response_model=List[RecetteTCORead])
def get_all(db: Session = Depends(get_db)):
    recettes = db.query(RecetteTCO).order_by(RecetteTCO.nom_recette).all()
    return [_enrich(r, db) for r in recettes]


@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    recettes = db.query(RecetteTCO).order_by(RecetteTCO.nom_recette).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["nom_recette", "type_tco", "quantite_tco", "unite_tco", "notes", "lignes_json"])
    for r in recettes:
        lignes = [{"nom_produit": _get_nom_produit(l, db), "quantite": float(l.quantite),
                   "unite": l.unite or "", "note_ligne": l.note_ligne or ""} for l in r.lignes]
        writer.writerow([r.nom_recette, r.type_tco or "",
                         str(r.quantite_tco) if r.quantite_tco is not None else "",
                         r.unite_tco or "", r.notes or "", json.dumps(lignes, ensure_ascii=False)])
    content  = output.getvalue()
    filename = f"recettes_tco_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(content=content.encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _get_nom_produit(ligne: RecetteTCOLigne, db: Session) -> str:
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
        r = RecetteTCO(
            nom_recette=nom,
            type_tco=row.get("type_tco", "").strip() or None,
            quantite_tco=float(row["quantite_tco"]) if row.get("quantite_tco", "").strip() else None,
            unite_tco=row.get("unite_tco", "").strip() or None,
            notes=row.get("notes", "").strip() or None,
        )
        db.add(r); db.flush()
        lignes_raw = row.get("lignes_json", "").strip()
        if lignes_raw:
            for i, l in enumerate(json.loads(lignes_raw)):
                nom_p = l.get("nom_produit", "")
                p = db.query(ProduitEngrais).filter(ProduitEngrais.nom_produit == nom_p).first()
                if p:
                    db.add(RecetteTCOLigne(
                        id_recette_tco=r.id_recette_tco, id_produit=p.id_produit,
                        quantite=l.get("quantite", 0), unite=l.get("unite", ""),
                        note_ligne=l.get("note_ligne") or None, ordre=i,
                    ))
        created += 1
    db.commit()
    return {"imported": created}


@router.get("/{recette_id}", response_model=RecetteTCORead)
def get_one(recette_id: int, db: Session = Depends(get_db)):
    row = db.query(RecetteTCO).filter(RecetteTCO.id_recette_tco == recette_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Recette TCO introuvable")
    return _enrich(row, db)


@router.post("/", response_model=RecetteTCORead, status_code=201)
def create(payload: RecetteTCOCreate, db: Session = Depends(get_db)):
    recette = RecetteTCO(
        nom_recette=payload.nom_recette,
        type_tco=payload.type_tco,
        quantite_tco=payload.quantite_tco,
        unite_tco=payload.unite_tco,
        notes=payload.notes,
    )
    db.add(recette)
    db.flush()

    for i, l in enumerate(payload.lignes):
        ligne = RecetteTCOLigne(
            id_recette_tco=recette.id_recette_tco,
            id_produit=l.id_produit,
            quantite=l.quantite,
            unite=l.unite,
            note_ligne=l.note_ligne,
            ordre=l.ordre if l.ordre else i,
        )
        db.add(ligne)

    db.commit()
    db.refresh(recette)
    return _enrich(recette, db)


@router.put("/{recette_id}", response_model=RecetteTCORead)
def update(recette_id: int, payload: RecetteTCOUpdate, db: Session = Depends(get_db)):
    recette = db.query(RecetteTCO).filter(RecetteTCO.id_recette_tco == recette_id).first()
    if not recette:
        raise HTTPException(status_code=404, detail="Recette TCO introuvable")

    for field in ("nom_recette", "type_tco", "quantite_tco", "unite_tco", "notes"):
        val = getattr(payload, field)
        if val is not None:
            setattr(recette, field, val)

    if payload.lignes is not None:
        for old in recette.lignes:
            db.delete(old)
        db.flush()
        for i, l in enumerate(payload.lignes):
            ligne = RecetteTCOLigne(
                id_recette_tco=recette.id_recette_tco,
                id_produit=l.id_produit,
                quantite=l.quantite,
                unite=l.unite,
                note_ligne=l.note_ligne,
                ordre=l.ordre if l.ordre else i,
            )
            db.add(ligne)

    db.commit()
    db.refresh(recette)
    return _enrich(recette, db)


@router.delete("/{recette_id}", status_code=204)
def delete(recette_id: int, db: Session = Depends(get_db)):
    row = db.query(RecetteTCO).filter(RecetteTCO.id_recette_tco == recette_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Recette TCO introuvable")
    db.delete(row)
    db.commit()
