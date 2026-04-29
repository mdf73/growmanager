"""Router RecetteEngrais — CRUD recettes engrais/amendements"""
import csv, io, json
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import RecetteEngrais, RecetteEngraisLigne, ProduitEngrais
from app.schemas.recette_engrais import (
    RecetteEngraisCreate, RecetteEngraisUpdate, RecetteEngraisRead, RecetteEngraisLigneRead,
)

router = APIRouter(prefix="/api/recettes-engrais", tags=["recettes-engrais"])


def _enrich_ligne(ligne: RecetteEngraisLigne, db: Session) -> RecetteEngraisLigneRead:
    """Enrichit une ligne avec nom et type du produit."""
    produit = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne.id_produit).first()
    return RecetteEngraisLigneRead(
        id_ligne=ligne.id_ligne,
        id_produit=ligne.id_produit,
        dosage=float(ligne.dosage),
        unite=ligne.unite,
        ordre=ligne.ordre,
        nom_produit=produit.nom_produit if produit else None,
        type_produit=produit.type_produit if produit else None,
    )


def _enrich(recette: RecetteEngrais, db: Session) -> RecetteEngraisRead:
    return RecetteEngraisRead(
        id_recette=recette.id_recette,
        nom_recette=recette.nom_recette,
        type_recette=recette.type_recette,
        periode=recette.periode,
        semaine=recette.semaine,
        ph_cible=float(recette.ph_cible) if recette.ph_cible is not None else None,
        notes=recette.notes,
        lignes=[_enrich_ligne(l, db) for l in recette.lignes],
    )


@router.get("/", response_model=List[RecetteEngraisRead])
def get_all(db: Session = Depends(get_db)):
    recettes = db.query(RecetteEngrais).order_by(RecetteEngrais.nom_recette).all()
    return [_enrich(r, db) for r in recettes]


@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    recettes = db.query(RecetteEngrais).order_by(RecetteEngrais.nom_recette).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["nom_recette", "type_recette", "periode", "semaine", "ph_cible", "notes", "lignes_json"])
    for r in recettes:
        lignes = [{"nom_produit": _get_nom_produit(l, db),
                   "dosage": float(l.dosage), "unite": l.unite or ""} for l in r.lignes]
        writer.writerow([r.nom_recette, r.type_recette or "", r.periode or "",
                         str(r.semaine) if r.semaine is not None else "",
                         str(r.ph_cible) if r.ph_cible is not None else "",
                         r.notes or "", json.dumps(lignes, ensure_ascii=False)])
    content  = output.getvalue()
    filename = f"recettes_engrais_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(content=content.encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _get_nom_produit(ligne: RecetteEngraisLigne, db: Session) -> str:
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
        r = RecetteEngrais(
            nom_recette=nom,
            type_recette=row.get("type_recette", "").strip() or None,
            periode=row.get("periode", "").strip() or None,
            semaine=int(row["semaine"]) if row.get("semaine", "").strip() else None,
            ph_cible=float(row["ph_cible"]) if row.get("ph_cible", "").strip() else None,
            notes=row.get("notes", "").strip() or None,
        )
        db.add(r); db.flush()
        lignes_raw = row.get("lignes_json", "").strip()
        if lignes_raw:
            for i, l in enumerate(json.loads(lignes_raw)):
                nom_p = l.get("nom_produit", "")
                p = db.query(ProduitEngrais).filter(ProduitEngrais.nom_produit == nom_p).first()
                if p:
                    db.add(RecetteEngraisLigne(
                        id_recette=r.id_recette, id_produit=p.id_produit,
                        dosage=l.get("dosage", 0), unite=l.get("unite", ""), ordre=i,
                    ))
        created += 1
    db.commit()
    return {"imported": created}


@router.get("/{recette_id}", response_model=RecetteEngraisRead)
def get_one(recette_id: int, db: Session = Depends(get_db)):
    row = db.query(RecetteEngrais).filter(RecetteEngrais.id_recette == recette_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    return _enrich(row, db)


@router.post("/", response_model=RecetteEngraisRead, status_code=201)
def create(payload: RecetteEngraisCreate, db: Session = Depends(get_db)):
    recette = RecetteEngrais(
        nom_recette=payload.nom_recette,
        type_recette=payload.type_recette,
        periode=payload.periode,
        semaine=payload.semaine,
        ph_cible=payload.ph_cible,
        notes=payload.notes,
    )
    db.add(recette)
    db.flush()   # pour obtenir id_recette avant d'ajouter les lignes

    for i, l in enumerate(payload.lignes):
        ligne = RecetteEngraisLigne(
            id_recette=recette.id_recette,
            id_produit=l.id_produit,
            dosage=l.dosage,
            unite=l.unite,
            ordre=l.ordre if l.ordre else i,
        )
        db.add(ligne)

    db.commit()
    db.refresh(recette)
    return _enrich(recette, db)


@router.put("/{recette_id}", response_model=RecetteEngraisRead)
def update(recette_id: int, payload: RecetteEngraisUpdate, db: Session = Depends(get_db)):
    recette = db.query(RecetteEngrais).filter(RecetteEngrais.id_recette == recette_id).first()
    if not recette:
        raise HTTPException(status_code=404, detail="Recette introuvable")

    for field in ("nom_recette", "type_recette", "periode", "semaine", "ph_cible", "notes"):
        val = getattr(payload, field)
        if val is not None:
            setattr(recette, field, val)

    # Remplace les lignes si fournies
    if payload.lignes is not None:
        for old in recette.lignes:
            db.delete(old)
        db.flush()
        for i, l in enumerate(payload.lignes):
            ligne = RecetteEngraisLigne(
                id_recette=recette.id_recette,
                id_produit=l.id_produit,
                dosage=l.dosage,
                unite=l.unite,
                ordre=l.ordre if l.ordre else i,
            )
            db.add(ligne)

    db.commit()
    db.refresh(recette)
    return _enrich(recette, db)


@router.delete("/{recette_id}", status_code=204)
def delete(recette_id: int, db: Session = Depends(get_db)):
    row = db.query(RecetteEngrais).filter(RecetteEngrais.id_recette == recette_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    db.delete(row)
    db.commit()
