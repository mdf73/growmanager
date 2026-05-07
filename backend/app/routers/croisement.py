"""Router FastAPI pour Croisements et Pollen."""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.all_models import Pollen, Croisement, Variete, PackGraine, Breeder, Graine
from app.schemas.croisement import (
    PollenCreate, PollenUpdate, PollenRead,
    CroisementCreate, CroisementUpdate, CroisementRead,
    RecolteGrainesInput,
)

router = APIRouter(prefix="/api/croisements", tags=["croisements"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _peremption_auto(date_collecte: Optional[date], stockage: Optional[str]) -> Optional[date]:
    """Calcule une date de péremption estimée selon le mode de stockage."""
    if not date_collecte:
        return None
    if stockage == "frigo":
        return date_collecte + timedelta(days=180)    # ~6 mois
    if stockage == "congelateur":
        return date_collecte + timedelta(days=540)    # ~18 mois
    if stockage == "ambiant":
        return date_collecte + timedelta(days=30)     # ~1 mois
    return None


def _enrich_pollen(p: Pollen) -> dict:
    today = date.today()
    perime = bool(p.date_peremption and p.date_peremption < today)
    epuise = bool(p.quantite_restante_g is not None and float(p.quantite_restante_g) <= 0)
    return {
        "id_pollen": p.id_pollen,
        "nom_pollen": p.nom_pollen,
        "id_variete_source": p.id_variete_source,
        "nom_variete_source": p.variete_source.nom_variete if p.variete_source else None,
        "pheno_source": p.pheno_source,
        "reverse": bool(p.reverse),
        "date_collecte": p.date_collecte,
        "quantite_initiale_g": float(p.quantite_initiale_g) if p.quantite_initiale_g is not None else None,
        "quantite_restante_g": float(p.quantite_restante_g) if p.quantite_restante_g is not None else None,
        "stockage": p.stockage,
        "date_peremption": p.date_peremption,
        "actif": bool(p.actif) and not perime and not epuise,
        "notes": p.notes,
        "created_at": p.created_at,
        "perime": perime,
        "epuise": epuise,
    }


def _enrich_croisement(c: Croisement) -> dict:
    return {
        "id_croisement": c.id_croisement,
        "nom_croisement": c.nom_croisement,
        "type_croisement": c.type_croisement,
        "id_variete_mere": c.id_variete_mere,
        "nom_variete_mere": c.variete_mere.nom_variete if c.variete_mere else None,
        "pheno_mere": c.pheno_mere,
        "notes_mere": c.notes_mere,
        "id_pollen": c.id_pollen,
        "nom_pollen": c.pollen.nom_pollen if c.pollen else None,
        "id_variete_pere": c.id_variete_pere,
        "nom_variete_pere": c.variete_pere.nom_variete if c.variete_pere else None,
        "pheno_pere": c.pheno_pere,
        "pere_reverse": bool(c.pere_reverse),
        "notes_pere": c.notes_pere,
        "date_pollinisation": c.date_pollinisation,
        "methode": c.methode,
        "zone_pollinisee": c.zone_pollinisee,
        "quantite_pollen_utilisee_g": float(c.quantite_pollen_utilisee_g) if c.quantite_pollen_utilisee_g is not None else None,
        "date_recolte_graines": c.date_recolte_graines,
        "nb_graines": c.nb_graines,
        "qualite_graines": c.qualite_graines,
        "poids_graines_g": float(c.poids_graines_g) if c.poids_graines_g is not None else None,
        "id_variete_resultat": c.id_variete_resultat,
        "id_packgraine_resultat": c.id_packgraine_resultat,
        "statut": c.statut or "planifie",
        "notes": c.notes,
        "created_at": c.created_at,
    }


# ═══════════════════════════════════════════════════════════════════════════
#  POLLEN  (routes statiques AVANT /{id})
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/pollen", response_model=list[PollenRead])
def list_pollen(db: Session = Depends(get_db), actif_only: bool = False):
    """Liste tout le pollen en stock. `actif_only=true` masque épuisé/périmé."""
    rows = db.query(Pollen).order_by(Pollen.id_pollen.desc()).all()
    out = [_enrich_pollen(p) for p in rows]
    if actif_only:
        out = [p for p in out if p["actif"]]
    return out


@router.get("/pollen/{pollen_id}", response_model=PollenRead)
def get_pollen(pollen_id: int, db: Session = Depends(get_db)):
    p = db.query(Pollen).filter(Pollen.id_pollen == pollen_id).first()
    if not p:
        raise HTTPException(404, "Pollen non trouvé")
    return _enrich_pollen(p)


@router.post("/pollen", response_model=PollenRead)
def create_pollen(data: PollenCreate, db: Session = Depends(get_db)):
    payload = data.model_dump()
    # Auto-calcul péremption si non fournie
    if not payload.get("date_peremption"):
        payload["date_peremption"] = _peremption_auto(payload.get("date_collecte"), payload.get("stockage"))
    # quantite_restante par défaut = quantite_initiale
    if payload.get("quantite_restante_g") is None and payload.get("quantite_initiale_g") is not None:
        payload["quantite_restante_g"] = payload["quantite_initiale_g"]
    p = Pollen(**payload)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _enrich_pollen(p)


@router.put("/pollen/{pollen_id}", response_model=PollenRead)
def update_pollen(pollen_id: int, data: PollenUpdate, db: Session = Depends(get_db)):
    p = db.query(Pollen).filter(Pollen.id_pollen == pollen_id).first()
    if not p:
        raise HTTPException(404, "Pollen non trouvé")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return _enrich_pollen(p)


@router.delete("/pollen/{pollen_id}")
def delete_pollen(pollen_id: int, db: Session = Depends(get_db)):
    p = db.query(Pollen).filter(Pollen.id_pollen == pollen_id).first()
    if not p:
        raise HTTPException(404, "Pollen non trouvé")
    # Vérifier qu'aucun croisement n'utilise ce pollen
    used = db.query(Croisement).filter(Croisement.id_pollen == pollen_id).count()
    if used:
        raise HTTPException(400, f"Pollen utilisé par {used} croisement(s), suppression bloquée")
    db.delete(p)
    db.commit()
    return {"message": "Pollen supprimé"}


# ═══════════════════════════════════════════════════════════════════════════
#  CROISEMENTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=list[CroisementRead])
def list_croisements(db: Session = Depends(get_db), statut: Optional[str] = None):
    q = db.query(Croisement)
    if statut:
        q = q.filter(Croisement.statut == statut)
    rows = q.order_by(Croisement.id_croisement.desc()).all()
    return [_enrich_croisement(c) for c in rows]


@router.get("/{croisement_id}", response_model=CroisementRead)
def get_croisement(croisement_id: int, db: Session = Depends(get_db)):
    c = db.query(Croisement).filter(Croisement.id_croisement == croisement_id).first()
    if not c:
        raise HTTPException(404, "Croisement non trouvé")
    return _enrich_croisement(c)


@router.post("/", response_model=CroisementRead)
def create_croisement(data: CroisementCreate, db: Session = Depends(get_db)):
    payload = data.model_dump()
    c = Croisement(**payload)
    db.add(c)

    # Si du pollen est utilisé ET une quantité déclarée → décrémenter le stock
    if payload.get("id_pollen") and payload.get("quantite_pollen_utilisee_g"):
        p = db.query(Pollen).filter(Pollen.id_pollen == payload["id_pollen"]).first()
        if p and p.quantite_restante_g is not None:
            new_qty = float(p.quantite_restante_g) - float(payload["quantite_pollen_utilisee_g"])
            p.quantite_restante_g = max(0, new_qty)
            if p.quantite_restante_g <= 0:
                p.actif = False

    db.commit()
    db.refresh(c)
    return _enrich_croisement(c)


@router.put("/{croisement_id}", response_model=CroisementRead)
def update_croisement(croisement_id: int, data: CroisementUpdate, db: Session = Depends(get_db)):
    c = db.query(Croisement).filter(Croisement.id_croisement == croisement_id).first()
    if not c:
        raise HTTPException(404, "Croisement non trouvé")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return _enrich_croisement(c)


@router.delete("/{croisement_id}")
def delete_croisement(croisement_id: int, db: Session = Depends(get_db)):
    c = db.query(Croisement).filter(Croisement.id_croisement == croisement_id).first()
    if not c:
        raise HTTPException(404, "Croisement non trouvé")
    db.delete(c)
    db.commit()
    return {"message": "Croisement supprimé"}


@router.post("/{croisement_id}/recolte", response_model=CroisementRead)
def finaliser_recolte(croisement_id: int, data: RecolteGrainesInput, db: Session = Depends(get_db)):
    """Finalise un croisement : enregistre la récolte de graines et crée
    éventuellement une Variete + un PackGraine maison + les Graine individuelles."""
    c = db.query(Croisement).filter(Croisement.id_croisement == croisement_id).first()
    if not c:
        raise HTTPException(404, "Croisement non trouvé")

    print(f"[DEBUG RECOLTE PAYLOAD] id={croisement_id} nb={data.nb_graines} variete={data.nom_variete_resultat!r} breeder_id={data.id_breeder} breeder_new={data.nom_breeder_nouveau!r} type={data.types_graines!r} creer_v={data.creer_variete} creer_p={data.creer_packgraine}", flush=True)
    print(f"[DEBUG RECOLTE STATE] c.id_variete_resultat={c.id_variete_resultat} c.id_packgraine_resultat={c.id_packgraine_resultat}", flush=True)

    c.date_recolte_graines = data.date_recolte_graines
    c.nb_graines = data.nb_graines
    c.qualite_graines = data.qualite_graines
    c.poids_graines_g = data.poids_graines_g
    c.statut = "recolte"

    # Construire le libellé de croisement (ex: "Mom x Dad")
    parent_mere = c.variete_mere.nom_variete if c.variete_mere else "?"
    parent_pere = (c.variete_pere.nom_variete if c.variete_pere
                   else (c.pollen.nom_pollen if c.pollen else "?"))
    croisement_label = f"{parent_mere} x {parent_pere}"

    # ── Résoudre le breeder ────────────────────────────────────────────────
    id_breeder: Optional[int] = data.id_breeder
    if data.nom_breeder_nouveau:
        b = Breeder(nom_breeder=data.nom_breeder_nouveau)
        db.add(b)
        db.flush()
        id_breeder = b.id_breeder

    # ── Nom de la variété résultante ───────────────────────────────────────
    nom_variete = data.nom_variete_resultat or c.nom_croisement

    # ── Créer ou mettre à jour la Variete ────────────────────────────────
    id_variete_final: Optional[int] = None

    if data.creer_variete:
        if c.id_variete_resultat:
            # Mise à jour de la variété existante
            v_existing = db.query(Variete).filter(Variete.id_variete == c.id_variete_resultat).first()
            if v_existing:
                v_existing.nom_variete = nom_variete
                v_existing.croisement_variete = croisement_label
            id_variete_final = c.id_variete_resultat
        else:
            v_new = Variete(
                nom_variete=nom_variete,
                croisement_variete=croisement_label,
                informations_variete=f"Issu du croisement maison #{c.id_croisement} ({c.type_croisement or 'F1'})",
            )
            db.add(v_new)
            db.flush()
            id_variete_final = v_new.id_variete
            c.id_variete_resultat = id_variete_final
    elif data.id_variete_existante:
        id_variete_final = data.id_variete_existante
        c.id_variete_resultat = id_variete_final

    print(f"[DEBUG RECOLTE VARIETE] id_variete_final={id_variete_final}", flush=True)

    # ── Créer un nouveau PackGraine maison (toujours neuf) ───────────────
    id_pack_final: Optional[int] = None

    if data.creer_packgraine:
        pg = PackGraine(
            id_fournisseur=None,
            nbr_graines=data.nb_graines,
            prix_achat=0,
            date_achat=data.date_recolte_graines,
        )
        db.add(pg)
        db.flush()
        id_pack_final = pg.id_packgraine
        c.id_packgraine_resultat = id_pack_final

    print(f"[DEBUG RECOLTE PACK] id_pack_final={id_pack_final} nbr_graines={data.nb_graines}", flush=True)

    # ── Créer les Graine individuelles ───────────────────────────────────
    if id_pack_final and data.nb_graines > 0:
        # Nettoyer d'éventuelles graines orphelines qui référencent cet id_pack
        # (peut arriver si MySQL réutilise un ID après suppression sans FK InnoDB)
        orphelines = db.query(Graine).filter(Graine.id_packgraine == id_pack_final).count()
        if orphelines:
            print(f"[DEBUG RECOLTE] {orphelines} graines orphelines supprimées pour pack={id_pack_final}", flush=True)
            db.query(Graine).filter(Graine.id_packgraine == id_pack_final).delete(synchronize_session=False)

        for _ in range(data.nb_graines):
            g = Graine(
                id_breeder=id_breeder,
                id_variete=id_variete_final,
                id_packgraine=id_pack_final,
                types_graines=data.types_graines,
                date_achat=data.date_recolte_graines,
                prix_achat=0,
                utilisee=False,
                edition_limite=False,
            )
            db.add(g)
        print(f"[DEBUG RECOLTE GRAINES] {data.nb_graines} graines créées → pack={id_pack_final} variete={id_variete_final} breeder={id_breeder}", flush=True)

    db.commit()
    db.refresh(c)
    return _enrich_croisement(c)
