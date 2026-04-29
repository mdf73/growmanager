"""Router Plan de culture — préparation d'une future session"""
import csv
import io
import logging
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EspaceCulture
from app.models.all_models import PlanCulture, PlanCultureVariete, PackGraine, Graine
from app.schemas.plan_culture import (
    PlanCultureCreate, PlanCultureUpdate, PlanCultureRead,
    PlanVarieteCreate, PlanVarieteUpdate, PlanVarieteRead,
    NbPotsResult,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/plan-culture", tags=["plan-culture"])


# ─── Formule de calcul du nombre de pots ────────────────────────────────────
# Calibrée sur données utilisateur (120x120 tent) :
#   nb_pots ≈ surface_m2 × 20.8 × volume_l^(-0.59)
# Résultat indicatif, modifiable manuellement par l'utilisateur.
_POT_K = 20.8
_POT_ALPHA = 0.59

def _calc_nb_pots(surface_m2: float, volume_l: float) -> int:
    if volume_l <= 0 or surface_m2 <= 0:
        return 0
    return max(0, round(surface_m2 * _POT_K * (volume_l ** -_POT_ALPHA)))


# ─── Enrichissement d'une ligne variété ──────────────────────────────────────

def _enrich_variete(pv: PlanCultureVariete, db: Session) -> dict:
    """Retourne PlanVarieteRead enrichi depuis PackGraine + Graine."""
    pack = db.query(PackGraine).filter(PackGraine.id_packgraine == pv.id_packgraine).first()
    graines = db.query(Graine).filter(Graine.id_packgraine == pv.id_packgraine).all()

    nom_variete = None
    nom_breeder = None
    type_graine = None
    duree_flo_min = None
    duree_flo_max = None
    stock_disponible = sum(1 for g in graines if not g.utilisee)
    paquet_ouvert = any(g.utilisee for g in graines)

    # Récupérer variété + breeder depuis la première graine
    first = next((g for g in graines), None)
    if first:
        type_graine = first.types_graines
        duree_flo_min = first.duree_flo_min
        duree_flo_max = first.duree_flo_max
        if first.variete:
            nom_variete = first.variete.nom_variete
        if first.breeder:
            nom_breeder = first.breeder.nom_breeder

    return {
        "id_plan_variete": pv.id_plan_variete,
        "id_packgraine": pv.id_packgraine,
        "nb_plantes": pv.nb_plantes,
        "taille_pot_l": float(pv.taille_pot_l) if pv.taille_pot_l else None,
        "ordre": pv.ordre or 0,
        "nom_variete": nom_variete,
        "nom_breeder": nom_breeder,
        "type_graine": type_graine,
        "duree_flo_min": duree_flo_min,
        "duree_flo_max": duree_flo_max,
        "stock_disponible": stock_disponible,
        "paquet_ouvert": paquet_ouvert,
        "prix_achat_pack": float(pack.prix_achat) if pack and pack.prix_achat else None,
        "date_achat_pack": str(pack.date_achat) if pack and pack.date_achat else None,
        "duree_conservation_mois": pack.duree_conservation_mois if pack else None,
    }


def _enrich_plan(plan: PlanCulture, db: Session) -> dict:
    nom_espace = None
    surface_m2 = None
    if plan.id_espace:
        esp = db.query(EspaceCulture).filter(EspaceCulture.id_espace == plan.id_espace).first()
        if esp:
            nom_espace = esp.nom
            surface_m2 = esp.surface_m2

    varietes_enrichies = [_enrich_variete(pv, db) for pv in plan.varietes]
    nb_plantes_total = sum(pv.nb_plantes for pv in plan.varietes)

    return {
        "id_plan": plan.id_plan,
        "nom": plan.nom,
        "id_espace": plan.id_espace,
        "nom_espace": nom_espace,
        "surface_m2": surface_m2,
        "statut": plan.statut or "brouillon",
        "notes": plan.notes,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
        "varietes": varietes_enrichies,
        "nb_plantes_total": nb_plantes_total,
    }


# ─── Routes utilitaires (DOIVENT être avant /{plan_id} pour éviter conflit) ──

@router.get("/utils/nb-pots", response_model=NbPotsResult)
def calc_nb_pots(
    surface_m2: float = Query(..., gt=0),
    taille_pot_l: float = Query(..., gt=0),
):
    return NbPotsResult(
        surface_m2=surface_m2,
        taille_pot_l=taille_pot_l,
        nb_pots_recommande=_calc_nb_pots(surface_m2, taille_pot_l),
    )


@router.get("/utils/catalogue")
def get_catalogue(
    db: Session = Depends(get_db),
    breeder: Optional[str] = None,
    variete: Optional[str] = None,
    type_graine: Optional[str] = None,
    flo_min: Optional[int] = None,
    flo_max: Optional[int] = None,
    stock_seulement: bool = True,
):
    """Retourne les packs avec graines disponibles, enrichis, pour le sélecteur de plan."""
    packs = db.query(PackGraine).all()
    results = []
    for pack in packs:
        graines = db.query(Graine).filter(Graine.id_packgraine == pack.id_packgraine).all()
        stock = sum(1 for g in graines if not g.utilisee)
        if stock_seulement and stock == 0:
            continue

        first = next((g for g in graines), None)
        if not first:
            continue

        nom_v = first.variete.nom_variete if first.variete else None
        nom_b = first.breeder.nom_breeder if first.breeder else None
        type_g = first.types_graines
        flo_mn = first.duree_flo_min
        flo_mx = first.duree_flo_max

        # Filtres
        if breeder and nom_b and breeder.lower() not in nom_b.lower():
            continue
        if variete and nom_v and variete.lower() not in nom_v.lower():
            continue
        if type_graine and type_g and type_graine.lower() not in type_g.lower():
            continue
        if flo_min and flo_mx and flo_mx < flo_min:
            continue
        if flo_max and flo_mn and flo_mn > flo_max:
            continue

        results.append({
            "id_packgraine": pack.id_packgraine,
            "nom_variete": nom_v,
            "nom_breeder": nom_b,
            "type_graine": type_g,
            "duree_flo_min": flo_mn,
            "duree_flo_max": flo_mx,
            "stock_disponible": stock,
            "paquet_ouvert": any(g.utilisee for g in graines),
            "prix_achat": float(pack.prix_achat) if pack.prix_achat else None,
            "date_achat": str(pack.date_achat) if pack.date_achat else None,
            "duree_conservation_mois": pack.duree_conservation_mois,
            "nbr_graines_total": pack.nbr_graines,
        })

    results.sort(key=lambda x: (x["nom_variete"] or "", x["nom_breeder"] or ""))
    return results


# ─── Routes plans ─────────────────────────────────────────────────────────────

@router.get("/", response_model=list[PlanCultureRead])
def list_plans(db: Session = Depends(get_db)):
    plans = db.query(PlanCulture).order_by(PlanCulture.updated_at.desc()).all()
    return [_enrich_plan(p, db) for p in plans]


@router.post("/", response_model=PlanCultureRead, status_code=201)
def create_plan(payload: PlanCultureCreate, db: Session = Depends(get_db)):
    plan = PlanCulture(
        nom=payload.nom,
        id_espace=payload.id_espace,
        notes=payload.notes,
        statut="brouillon",
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _enrich_plan(plan, db)


@router.get("/{plan_id}/export/csv")
def export_plan_csv(plan_id: int, db: Session = Depends(get_db)):
    """Exporte le plan de culture en CSV (breeder, variété, type, floraison, nb plantes, taille pot, nb pots estimé)."""
    plan = db.query(PlanCulture).filter(PlanCulture.id_plan == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable")

    enriched = _enrich_plan(plan, db)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Breeder", "Variété", "Type", "Floraison (j)", "Nb plantes", "Taille pot (L)", "Nb pots estimé"])

    for v in enriched["varietes"]:
        nb_pots = ""
        if enriched.get("surface_m2") and v.get("taille_pot_l"):
            nb_pots = _calc_nb_pots(enriched["surface_m2"], v["taille_pot_l"])

        flo_min = v.get("duree_flo_min")
        flo_max = v.get("duree_flo_max")
        if flo_min and flo_max:
            flo = f"{flo_min}–{flo_max}"
        elif flo_min or flo_max:
            flo = str(flo_min or flo_max)
        else:
            flo = ""

        writer.writerow([
            v.get("nom_breeder") or "",
            v.get("nom_variete") or "",
            v.get("type_graine") or "",
            flo,
            v["nb_plantes"],
            v.get("taille_pot_l") or "",
            nb_pots,
        ])

    output.seek(0)
    nom_fichier = f"plan_{plan.nom.replace(' ', '_').replace('/', '-')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'},
    )


@router.get("/{plan_id}", response_model=PlanCultureRead)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(PlanCulture).filter(PlanCulture.id_plan == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable")
    return _enrich_plan(plan, db)


@router.put("/{plan_id}", response_model=PlanCultureRead)
def update_plan(plan_id: int, payload: PlanCultureUpdate, db: Session = Depends(get_db)):
    plan = db.query(PlanCulture).filter(PlanCulture.id_plan == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable")
    for f in ["nom", "id_espace", "statut", "notes"]:
        v = getattr(payload, f)
        if v is not None:
            setattr(plan, f, v)
    db.commit()
    db.refresh(plan)
    return _enrich_plan(plan, db)


@router.delete("/{plan_id}", status_code=204)
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(PlanCulture).filter(PlanCulture.id_plan == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable")
    db.delete(plan)
    db.commit()


# ─── Routes variétés d'un plan ───────────────────────────────────────────────

@router.post("/{plan_id}/varietes", response_model=PlanVarieteRead, status_code=201)
def add_variete(plan_id: int, payload: PlanVarieteCreate, db: Session = Depends(get_db)):
    plan = db.query(PlanCulture).filter(PlanCulture.id_plan == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable")

    # Vérifier que ce pack n'est pas déjà dans le plan
    existing = db.query(PlanCultureVariete).filter(
        PlanCultureVariete.id_plan == plan_id,
        PlanCultureVariete.id_packgraine == payload.id_packgraine,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ce pack est déjà dans le plan.")

    # Ordre = max ordre actuel + 1
    max_ordre = max((pv.ordre or 0 for pv in plan.varietes), default=-1)
    pv = PlanCultureVariete(
        id_plan=plan_id,
        id_packgraine=payload.id_packgraine,
        nb_plantes=payload.nb_plantes,
        taille_pot_l=payload.taille_pot_l,
        ordre=max_ordre + 1,
    )
    db.add(pv)
    db.commit()
    db.refresh(pv)
    return _enrich_variete(pv, db)


@router.put("/{plan_id}/varietes/{pv_id}", response_model=PlanVarieteRead)
def update_variete(plan_id: int, pv_id: int, payload: PlanVarieteUpdate, db: Session = Depends(get_db)):
    pv = db.query(PlanCultureVariete).filter(
        PlanCultureVariete.id_plan_variete == pv_id,
        PlanCultureVariete.id_plan == plan_id,
    ).first()
    if not pv:
        raise HTTPException(status_code=404, detail="Variété introuvable dans ce plan")
    if payload.nb_plantes is not None:
        pv.nb_plantes = payload.nb_plantes
    if payload.taille_pot_l is not None:
        pv.taille_pot_l = payload.taille_pot_l
    if payload.ordre is not None:
        pv.ordre = payload.ordre
    db.commit()
    db.refresh(pv)
    return _enrich_variete(pv, db)


@router.delete("/{plan_id}/varietes/{pv_id}", status_code=204)
def remove_variete(plan_id: int, pv_id: int, db: Session = Depends(get_db)):
    pv = db.query(PlanCultureVariete).filter(
        PlanCultureVariete.id_plan_variete == pv_id,
        PlanCultureVariete.id_plan == plan_id,
    ).first()
    if not pv:
        raise HTTPException(status_code=404, detail="Variété introuvable")
    db.delete(pv)
    db.commit()


