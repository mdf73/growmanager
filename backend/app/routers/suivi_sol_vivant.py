"""Router SuiviSolVivant — Suivi complet des pots en sol vivant"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import (
    SuiviSolVivant, SuiviReamendement, SuiviArrosage, SuiviTCO,
    SuiviFermentation, SuiviCulture,
    RecetteLSO, RecetteLSOLigne, RecetteReamendement, RecetteReamendementLigne,
    RecetteEngrais, RecetteEngraisLigne, RecetteTCO,
    RecetteFermentation, Materiel, ProduitEngrais,
)
from app.schemas.suivi_sol_vivant import (
    SuiviSolVivantCreate, SuiviSolVivantUpdate, SuiviSolVivantRead,
    SuiviReamendementRead, SuiviArrosageRead, SuiviTCORead,
    SuiviFermentationRead, SuiviCultureRead,
)

router = APIRouter(prefix="/api/suivi-sols-vivants", tags=["suivi-sols-vivants"])


_UNIT_FACTORS = {
    "mL": 1,
    "L": 1000,
    "cL": 10,
    "g": 1,
    "Kg": 1000,
    "kg": 1000,
}


def _to_small_unit(value: float, unite: str | None) -> float:
    """Convertit une valeur vers son unité "petite" (mL ou g par défaut)."""
    factor = _UNIT_FACTORS.get(unite or "", 1)
    return float(value) * factor


def _extract_base_unit(unite: str | None) -> str | None:
    """Extrait l'unité de base (ex: 'mL' depuis 'mL/L')."""
    if not unite:
        return None
    return unite.split("/")[0]


def _ingredient_cost(quantite: float, unite_quantite: str | None, produit) -> float | None:
    """Calcule le coût d'un ingrédient en € en normalisant les unités.

    On convertit la quantité de la ligne de recette et le volume de conditionnement
    du produit dans leurs unités "petites" (mL ou g) avant d'appliquer le ratio
    prix_achat / volume_conditionnement.
    """
    if produit is None or produit.prix_achat is None or produit.volume_conditionnement is None:
        return None
    vc_small = _to_small_unit(float(produit.volume_conditionnement), produit.unite_volume)
    if vc_small == 0:
        return None
    q_small = _to_small_unit(float(quantite), unite_quantite)
    return round(q_small * (float(produit.prix_achat) / vc_small), 4)


def _deduire_stock(prod, quantite: float, unite_quantite: str | None) -> None:
    """Déduit une quantité du stock produit en respectant les unités.

    La quantité utilisée (unité de la ligne de recette) et le stock
    (prod.unite_quantite) sont convertis en petite unité (mL/g) avant
    soustraction, puis le résultat est réécrit dans l'unité du stock."""
    if prod is None or prod.quantite_stock is None:
        return
    qte_small = _to_small_unit(quantite, _extract_base_unit(unite_quantite))
    stock_factor = _UNIT_FACTORS.get(_extract_base_unit(prod.unite_quantite) or "", 1)
    stock_small = float(prod.quantite_stock) * stock_factor
    prod.quantite_stock = max(0.0, stock_small - qte_small) / stock_factor


def _enrich_reamend(e: SuiviReamendement, db: Session) -> SuiviReamendementRead:
    nom = None
    cout = None
    if e.id_recette_reamend:
        r = db.query(RecetteReamendement).filter(RecetteReamendement.id_recette_reamend == e.id_recette_reamend).first()
        nom = r.nom_recette if r else None
        if r:
            total = 0.0
            valid = True
            for ligne in db.query(RecetteReamendementLigne).filter(RecetteReamendementLigne.id_recette_reamend == r.id_recette_reamend).all():
                p = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne.id_produit).first()
                base_unit = _extract_base_unit(ligne.unite)
                c = _ingredient_cost(float(ligne.quantite), base_unit, p)
                if c is None:
                    valid = False
                    break
                total += c
            if valid:
                cout = round(total, 2)
    return SuiviReamendementRead(
        id_suivi_reamend=e.id_suivi_reamend,
        id_recette_reamend=e.id_recette_reamend,
        date_application=e.date_application,
        notes=e.notes,
        nom_recette_reamend=nom,
        cout_estime=cout,
    )


def _enrich_arrosage(e: SuiviArrosage, db: Session) -> SuiviArrosageRead:
    nom = None
    cout = None
    if e.id_recette_engrais:
        r = db.query(RecetteEngrais).filter(RecetteEngrais.id_recette == e.id_recette_engrais).first()
        nom = r.nom_recette if r else None
        if r and e.volume_eau_l is not None:
            total = 0.0
            valid = True
            volume_l = float(e.volume_eau_l)
            for ligne in db.query(RecetteEngraisLigne).filter(RecetteEngraisLigne.id_recette == r.id_recette).all():
                p = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne.id_produit).first()
                base_unit = _extract_base_unit(ligne.unite)
                qte_totale = float(ligne.dosage) * volume_l  # dosage en mL/L ou g/L
                c = _ingredient_cost(qte_totale, base_unit, p)
                if c is None:
                    valid = False
                    break
                total += c
            if valid:
                cout = round(total, 2)
    return SuiviArrosageRead(
        id_suivi_arrosage=e.id_suivi_arrosage,
        id_recette_engrais=e.id_recette_engrais,
        volume_eau_l=float(e.volume_eau_l) if e.volume_eau_l is not None else None,
        date_application=e.date_application,
        notes=e.notes,
        nom_recette_arrosage=nom,
        cout_estime=cout,
    )


def _enrich_tco(e: SuiviTCO, db: Session) -> SuiviTCORead:
    nom = None
    if e.id_recette_tco:
        r = db.query(RecetteTCO).filter(RecetteTCO.id_recette_tco == e.id_recette_tco).first()
        nom = r.nom_recette if r else None
    return SuiviTCORead(
        id_suivi_tco=e.id_suivi_tco,
        id_recette_tco=e.id_recette_tco,
        volume_applique=float(e.volume_applique) if e.volume_applique is not None else None,
        date_application=e.date_application,
        notes=e.notes,
        nom_recette_tco=nom,
    )


def _enrich_ferm(e: SuiviFermentation, db: Session) -> SuiviFermentationRead:
    nom = None
    if e.id_recette_ferm:
        r = db.query(RecetteFermentation).filter(RecetteFermentation.id_recette_ferm == e.id_recette_ferm).first()
        nom = r.nom_recette if r else None
    return SuiviFermentationRead(
        id_suivi_ferm=e.id_suivi_ferm,
        id_recette_ferm=e.id_recette_ferm,
        volume_applique=float(e.volume_applique) if e.volume_applique is not None else None,
        date_application=e.date_application,
        notes=e.notes,
        nom_recette_ferm=nom,
    )


def _enrich_culture(e: SuiviCulture) -> SuiviCultureRead:
    return SuiviCultureRead(
        id_suivi_culture=e.id_suivi_culture,
        description=e.description,
        date_debut=e.date_debut,
        date_fin=e.date_fin,
        notes=e.notes,
    )


def _enrich(s: SuiviSolVivant, db: Session) -> SuiviSolVivantRead:
    nom_lso = None
    cout_lso = None
    if s.id_recette_lso:
        lso = db.query(RecetteLSO).filter(RecetteLSO.id_recette_lso == s.id_recette_lso).first()
        nom_lso = lso.nom_recette if lso else None
        if lso:
            total = 0.0
            valid = True
            for ligne in db.query(RecetteLSOLigne).filter(RecetteLSOLigne.id_recette_lso == lso.id_recette_lso).all():
                p = db.query(ProduitEngrais).filter(ProduitEngrais.id_produit == ligne.id_produit).first()
                base_unit = _extract_base_unit(ligne.unite)
                c = _ingredient_cost(float(ligne.quantite), base_unit, p)
                if c is None:
                    valid = False
                    break
                total += c
            if valid:
                cout_lso = round(total, 2)

    nom_mat = None
    if s.id_materiel:
        mat = db.query(Materiel).filter(Materiel.id_materiel == s.id_materiel).first()
        nom_mat = mat.nom if mat else None

    reamendements_read = [_enrich_reamend(e, db) for e in s.reamendements]
    arrosages_read     = [_enrich_arrosage(e, db) for e in s.arrosages]

    # Coût total estimé = LSO + réamendements + arrosages (si tous calculables)
    all_parts = [cout_lso] + [r.cout_estime for r in reamendements_read] + [a.cout_estime for a in arrosages_read]
    cout_total = round(sum(v for v in all_parts if v is not None), 2) if any(v is not None for v in all_parts) else None

    return SuiviSolVivantRead(
        id_suivi=s.id_suivi,
        nom_pot=s.nom_pot,
        id_materiel=s.id_materiel,
        id_recette_lso=s.id_recette_lso,
        volume_pot_l=float(s.volume_pot_l) if s.volume_pot_l is not None else None,
        date_preparation=s.date_preparation,
        commentaires=s.commentaires,
        nom_recette_lso=nom_lso,
        nom_materiel=nom_mat,
        cout_lso_estime=cout_lso,
        cout_total_estime=cout_total,
        reamendements=reamendements_read,
        arrosages=arrosages_read,
        tcos=[_enrich_tco(e, db) for e in s.tcos],
        fermentations=[_enrich_ferm(e, db) for e in s.fermentations],
        cultures=[_enrich_culture(e) for e in s.cultures],
    )


def _create_children(s: SuiviSolVivant, payload, db: Session):
    for e in payload.reamendements:
        db.add(SuiviReamendement(id_suivi=s.id_suivi, **e.model_dump()))
    for e in payload.arrosages:
        db.add(SuiviArrosage(id_suivi=s.id_suivi, **e.model_dump()))
    for e in payload.tcos:
        db.add(SuiviTCO(id_suivi=s.id_suivi, **e.model_dump()))
    for e in payload.fermentations:
        db.add(SuiviFermentation(id_suivi=s.id_suivi, **e.model_dump()))
    for e in payload.cultures:
        db.add(SuiviCulture(id_suivi=s.id_suivi, **e.model_dump()))


@router.get("/", response_model=List[SuiviSolVivantRead])
def get_all(db: Session = Depends(get_db)):
    return [_enrich(s, db) for s in db.query(SuiviSolVivant).order_by(SuiviSolVivant.nom_pot).all()]


@router.get("/{suivi_id}", response_model=SuiviSolVivantRead)
def get_one(suivi_id: int, db: Session = Depends(get_db)):
    s = db.query(SuiviSolVivant).filter(SuiviSolVivant.id_suivi == suivi_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suivi sol vivant introuvable")
    return _enrich(s, db)


@router.post("/", response_model=SuiviSolVivantRead, status_code=201)
def create(payload: SuiviSolVivantCreate, db: Session = Depends(get_db)):
    s = SuiviSolVivant(
        nom_pot=payload.nom_pot,
        id_materiel=payload.id_materiel,
        id_recette_lso=payload.id_recette_lso,
        volume_pot_l=payload.volume_pot_l,
        date_preparation=payload.date_preparation,
        commentaires=payload.commentaires,
    )
    db.add(s)
    db.flush()
    _create_children(s, payload, db)
    db.commit()
    db.refresh(s)
    return _enrich(s, db)


@router.put("/{suivi_id}", response_model=SuiviSolVivantRead)
def update(suivi_id: int, payload: SuiviSolVivantUpdate, db: Session = Depends(get_db)):
    s = db.query(SuiviSolVivant).filter(SuiviSolVivant.id_suivi == suivi_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suivi sol vivant introuvable")
    for field in ("nom_pot", "id_materiel", "id_recette_lso", "volume_pot_l", "date_preparation", "commentaires"):
        val = getattr(payload, field)
        if val is not None:
            setattr(s, field, val)
    # Pour chaque collection, si fournie, on remplace
    if payload.reamendements is not None:
        for e in s.reamendements:
            db.delete(e)
        db.flush()
        for e in payload.reamendements:
            db.add(SuiviReamendement(id_suivi=s.id_suivi, **e.model_dump()))
    if payload.arrosages is not None:
        for e in s.arrosages:
            db.delete(e)
        db.flush()
        for e in payload.arrosages:
            db.add(SuiviArrosage(id_suivi=s.id_suivi, **e.model_dump()))
    if payload.tcos is not None:
        for e in s.tcos:
            db.delete(e)
        db.flush()
        for e in payload.tcos:
            db.add(SuiviTCO(id_suivi=s.id_suivi, **e.model_dump()))
    if payload.fermentations is not None:
        for e in s.fermentations:
            db.delete(e)
        db.flush()
        for e in payload.fermentations:
            db.add(SuiviFermentation(id_suivi=s.id_suivi, **e.model_dump()))
    if payload.cultures is not None:
        for e in s.cultures:
            db.delete(e)
        db.flush()
        for e in payload.cultures:
            db.add(SuiviCulture(id_suivi=s.id_suivi, **e.model_dump()))
    db.commit()
    db.refresh(s)
    return _enrich(s, db)


# ── Endpoints pour ajout individuel d'une entrée dans chaque liste ─────────────

@router.post("/{suivi_id}/reamendements", response_model=SuiviSolVivantRead, status_code=201)
def add_reamendement(suivi_id: int, payload: dict, db: Session = Depends(get_db)):
    s = db.query(SuiviSolVivant).filter(SuiviSolVivant.id_suivi == suivi_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suivi sol vivant introuvable")
    from app.schemas.suivi_sol_vivant import SuiviReamendementCreate
    from pydantic import TypeAdapter
    e = TypeAdapter(SuiviReamendementCreate).validate_python(payload)
    db.add(SuiviReamendement(id_suivi=suivi_id, **e.model_dump()))
    db.commit()
    db.refresh(s)
    return _enrich(s, db)


@router.post("/{suivi_id}/arrosages", response_model=SuiviSolVivantRead, status_code=201)
def add_arrosage(suivi_id: int, payload: dict, db: Session = Depends(get_db)):
    s = db.query(SuiviSolVivant).filter(SuiviSolVivant.id_suivi == suivi_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suivi sol vivant introuvable")
    from app.schemas.suivi_sol_vivant import SuiviArrosageCreate
    from pydantic import TypeAdapter
    e = TypeAdapter(SuiviArrosageCreate).validate_python(payload)
    db.add(SuiviArrosage(id_suivi=suivi_id, **e.model_dump()))

    # ── Déduction stock engrais ───────────────────────────────────────────────
    if e.id_recette_engrais and e.volume_eau_l:
        recette = db.query(RecetteEngrais).filter(
            RecetteEngrais.id_recette == e.id_recette_engrais
        ).first()
        if recette:
            volume_l = float(e.volume_eau_l)
            for ligne in db.query(RecetteEngraisLigne).filter(
                RecetteEngraisLigne.id_recette == recette.id_recette
            ).all():
                qte_calculee = float(ligne.dosage) * volume_l  # dosage en mL/L ou g/L
                prod = db.query(ProduitEngrais).filter(
                    ProduitEngrais.id_produit == ligne.id_produit
                ).first()
                _deduire_stock(prod, qte_calculee, ligne.unite)

    db.commit()
    db.refresh(s)
    return _enrich(s, db)


@router.post("/{suivi_id}/tcos", response_model=SuiviSolVivantRead, status_code=201)
def add_tco(suivi_id: int, payload: dict, db: Session = Depends(get_db)):
    s = db.query(SuiviSolVivant).filter(SuiviSolVivant.id_suivi == suivi_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suivi sol vivant introuvable")
    from app.schemas.suivi_sol_vivant import SuiviTCOCreate
    from pydantic import TypeAdapter
    e = TypeAdapter(SuiviTCOCreate).validate_python(payload)
    db.add(SuiviTCO(id_suivi=suivi_id, **e.model_dump()))
    db.commit()
    db.refresh(s)
    return _enrich(s, db)


@router.post("/{suivi_id}/fermentations", response_model=SuiviSolVivantRead, status_code=201)
def add_fermentation(suivi_id: int, payload: dict, db: Session = Depends(get_db)):
    s = db.query(SuiviSolVivant).filter(SuiviSolVivant.id_suivi == suivi_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suivi sol vivant introuvable")
    from app.schemas.suivi_sol_vivant import SuiviFermentationCreate
    from pydantic import TypeAdapter
    e = TypeAdapter(SuiviFermentationCreate).validate_python(payload)
    db.add(SuiviFermentation(id_suivi=suivi_id, **e.model_dump()))
    db.commit()
    db.refresh(s)
    return _enrich(s, db)


@router.post("/{suivi_id}/cultures", response_model=SuiviSolVivantRead, status_code=201)
def add_culture(suivi_id: int, payload: dict, db: Session = Depends(get_db)):
    s = db.query(SuiviSolVivant).filter(SuiviSolVivant.id_suivi == suivi_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suivi sol vivant introuvable")
    from app.schemas.suivi_sol_vivant import SuiviCultureCreate
    from pydantic import TypeAdapter
    e = TypeAdapter(SuiviCultureCreate).validate_python(payload)
    db.add(SuiviCulture(id_suivi=suivi_id, **e.model_dump()))
    db.commit()
    db.refresh(s)
    return _enrich(s, db)


@router.delete("/{suivi_id}", status_code=204)
def delete(suivi_id: int, db: Session = Depends(get_db)):
    s = db.query(SuiviSolVivant).filter(SuiviSolVivant.id_suivi == suivi_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suivi sol vivant introuvable")
    db.delete(s)
    db.commit()
