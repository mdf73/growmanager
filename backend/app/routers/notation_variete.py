"""Router Classement des variétés — CRUD + import/export CSV."""
import csv
import io
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import NotationVariete, RosinExtraction, HashExtraction, Stock, Variete
from app.schemas.notation_variete import NotationCreate, NotationUpdate, NotationRead

router = APIRouter(prefix="/api/notations", tags=["notations"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calc_scores(n: NotationVariete) -> dict:
    """Calcule total_culture, total_consommation et note_finale."""
    tc = (
        (n.vigueur_sante or 0)
        + (n.productivite_structure or 0)
        + (n.soif or 0)
    )
    tco = (
        (n.apparence_structure or 0)
        + (n.profil_aromatique or 0)
        + (n.saveur_qualite or 0)
        + (n.effet_puissance or 0)
    )
    return {
        "total_culture":      round(tc, 2),
        "total_consommation": round(tco, 2),
        "note_finale":        round(tc + tco, 2),
    }


def _to_read(n: NotationVariete) -> dict:
    scores = _calc_scores(n)
    return {
        "id_notation":          n.id_notation,
        "nom_variete":          n.nom_variete,
        "breeder":              n.breeder,
        "date_notation":        n.date_notation,
        "vigueur_sante":        n.vigueur_sante,
        "productivite_structure": n.productivite_structure,
        "soif":      n.soif,
        "apparence_structure":  n.apparence_structure,
        "profil_aromatique":    n.profil_aromatique,
        "saveur_qualite":       n.saveur_qualite,
        "effet_puissance":      n.effet_puissance,
        "taux_thc":             n.taux_thc,
        "taux_cbd":             n.taux_cbd,
        "terpene_dominant":     n.terpene_dominant,
        "commentaire_labo":     n.commentaire_labo,
        "notes_generales":      n.notes_generales,
        "created_at":           n.created_at,
        "updated_at":           n.updated_at,
        **scores,
    }


# ── Routes utilitaires (AVANT /{id}) ─────────────────────────────────────────

@router.get("/utils/extraction-stats")
def get_extraction_stats(db: Session = Depends(get_db)):
    """
    Retourne les taux d'extraction moyens (Rosin et Hash) groupés par nom de variété.
    Stratégie de résolution du nom :
      - Rosin : nom_variete_extract en priorité, sinon Stock→Variete
      - Hash  : nom_variete_hash en priorité, sinon id_variete→Variete, sinon Stock→Variete
    """

    # ── Pré-chargement des variétés (id → nom) ────────────────────────────────
    varietes_map: dict[int, str] = {
        v.id_variete: v.nom_variete
        for v in db.query(Variete).all()
    }
    # Stock (id → id_variete)
    stocks_map: dict[int, Optional[int]] = {
        s.id_stock: s.id_variete
        for s in db.query(Stock).all()
    }

    def _nom_from_stock(id_stock: Optional[int]) -> Optional[str]:
        if not id_stock:
            return None
        id_variete = stocks_map.get(id_stock)
        if not id_variete:
            return None
        return varietes_map.get(id_variete)

    # ── Rosin ─────────────────────────────────────────────────────────────────
    rosin_buckets: dict[str, list[float]] = {}
    for r in db.query(RosinExtraction).all():
        if not r.quantite_utilisee or not r.quantite_extraite:
            continue
        if float(r.quantite_utilisee) <= 0:
            continue
        name = (r.nom_variete_extract or "").strip() or _nom_from_stock(r.id_stock_source)
        if not name:
            continue
        rate = float(r.quantite_extraite) / float(r.quantite_utilisee) * 100
        rosin_buckets.setdefault(name, []).append(round(rate, 2))

    # ── Hash ──────────────────────────────────────────────────────────────────
    hash_buckets: dict[str, list[float]] = {}
    for h in db.query(HashExtraction).all():
        if not h.quantite_utilisee or not h.quantite_extraite:
            continue
        if float(h.quantite_utilisee) <= 0:
            continue
        # Résolution nom : hash_variete_hash → id_variete → stock_source
        name = (h.nom_variete_hash or "").strip()
        if not name and h.id_variete:
            name = varietes_map.get(h.id_variete, "")
        if not name:
            name = _nom_from_stock(h.id_stock_source) or ""
        if not name:
            continue
        rate = float(h.quantite_extraite) / float(h.quantite_utilisee) * 100
        hash_buckets.setdefault(name, []).append(round(rate, 2))

    # ── Fusion ────────────────────────────────────────────────────────────────
    all_names = set(list(rosin_buckets.keys()) + list(hash_buckets.keys()))
    result = {}
    for name in all_names:
        rosin_rates = rosin_buckets.get(name, [])
        hash_rates  = hash_buckets.get(name, [])
        result[name] = {
            "avg_rosin_pct": round(sum(rosin_rates) / len(rosin_rates), 1) if rosin_rates else None,
            "nb_rosin":      len(rosin_rates),
            "avg_hash_pct":  round(sum(hash_rates) / len(hash_rates), 1) if hash_rates else None,
            "nb_hash":       len(hash_rates),
        }
    return result


@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    """Export de toutes les notations au format CSV."""
    notations = (
        db.query(NotationVariete)
        .order_by(NotationVariete.nom_variete)
        .all()
    )
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")

    headers = [
        "ID", "Variété", "Breeder", "Date",
        "Vigueur/Santé (/10)", "Productivité/Structure (/10)", "Soif (/10)",
        "Apparence/Structure (/15)", "Profil Aromatique (/15)",
        "Saveur/Qualité (/20)", "Effet/Puissance (/20)",
        "Total Culture (/30)", "Total Conso (/70)", "Note Finale (/100)",
        "THC %", "CBD %", "Terpène dominant", "Commentaire labo", "Notes",
    ]
    writer.writerow(headers)

    for n in notations:
        scores = _calc_scores(n)
        writer.writerow([
            n.id_notation, n.nom_variete, n.breeder or "", str(n.date_notation or ""),
            n.vigueur_sante or "", n.productivite_structure or "", n.soif or "",
            n.apparence_structure or "", n.profil_aromatique or "",
            n.saveur_qualite or "", n.effet_puissance or "",
            scores["total_culture"], scores["total_consommation"], scores["note_finale"],
            n.taux_thc or "", n.taux_cbd or "",
            n.terpene_dominant or "", n.commentaire_labo or "", n.notes_generales or "",
        ])

    output.seek(0)
    filename = f"classement_varietes_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import/csv", status_code=201)
async def import_csv(
    file: bytes = None,
    db: Session = Depends(get_db),
):
    """Import de notations depuis un CSV (même format que l'export)."""
    from fastapi import UploadFile, File
    return {"detail": "Utiliser le formulaire multipart/form-data avec le champ 'file'."}


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[NotationRead])
def list_notations(db: Session = Depends(get_db)):
    """Retourne toutes les notations triées par note finale décroissante."""
    notations = db.query(NotationVariete).order_by(NotationVariete.nom_variete).all()
    result = [_to_read(n) for n in notations]
    # Tri par note_finale décroissante (calculée)
    result.sort(key=lambda x: x["note_finale"], reverse=True)
    return result


@router.post("/", response_model=NotationRead, status_code=201)
def create_notation(payload: NotationCreate, db: Session = Depends(get_db)):
    n = NotationVariete(
        nom_variete=payload.nom_variete,
        breeder=payload.breeder,
        date_notation=payload.date_notation or date.today(),
        vigueur_sante=payload.vigueur_sante,
        productivite_structure=payload.productivite_structure,
        soif=payload.soif,
        apparence_structure=payload.apparence_structure,
        profil_aromatique=payload.profil_aromatique,
        saveur_qualite=payload.saveur_qualite,
        effet_puissance=payload.effet_puissance,
        taux_thc=payload.taux_thc,
        taux_cbd=payload.taux_cbd,
        terpene_dominant=payload.terpene_dominant,
        commentaire_labo=payload.commentaire_labo,
        notes_generales=payload.notes_generales,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return _to_read(n)


@router.get("/{notation_id}", response_model=NotationRead)
def get_notation(notation_id: int, db: Session = Depends(get_db)):
    n = db.query(NotationVariete).filter(NotationVariete.id_notation == notation_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notation introuvable")
    return _to_read(n)


@router.put("/{notation_id}", response_model=NotationRead)
def update_notation(notation_id: int, payload: NotationUpdate, db: Session = Depends(get_db)):
    n = db.query(NotationVariete).filter(NotationVariete.id_notation == notation_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notation introuvable")
    fields = [
        "nom_variete", "breeder", "date_notation",
        "vigueur_sante", "productivite_structure", "soif",
        "apparence_structure", "profil_aromatique", "saveur_qualite", "effet_puissance",
        "taux_thc", "taux_cbd", "terpene_dominant", "commentaire_labo", "notes_generales",
    ]
    for f in fields:
        v = getattr(payload, f)
        if v is not None:
            setattr(n, f, v)
    n.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(n)
    return _to_read(n)


@router.delete("/{notation_id}", status_code=204)
def delete_notation(notation_id: int, db: Session = Depends(get_db)):
    n = db.query(NotationVariete).filter(NotationVariete.id_notation == notation_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notation introuvable")
    db.delete(n)
    db.commit()
