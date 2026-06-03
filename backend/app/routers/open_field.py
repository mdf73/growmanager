"""Router FastAPI — Croisement Open Field."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.all_models import (
    ProjetOpenField, PlanteMereOpenField, PlantePereOpenField,
    Variete, Pollen, Plant, Culture, PackGraine, Breeder, Graine,
)
from app.schemas.open_field import (
    ProjetOpenFieldCreate, ProjetOpenFieldUpdate, ProjetOpenFieldRead,
    PlanteMereCreate, PlanteMereUpdate, PlanteMereRead,
    PlantePereCreate, PlantePereUpdate, PlantePereRead,
    RecolteInput,
)

router = APIRouter(prefix="/api/open-field", tags=["open_field"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _enrich_mere(m: PlanteMereOpenField, peres_map: dict = None) -> dict:
    d = {c.name: getattr(m, c.name) for c in m.__table__.columns}
    d["variete_nom"]  = m.variete.nom_variete if m.variete else None
    d["pollen_nom"]   = m.pollen.nom_pollen   if m.pollen  else None
    d["plant_label"]  = f"Plant #{m.plant.numero_plant}" if m.plant else None
    if peres_map and m.id_peres:
        d["peres_labels"] = [peres_map.get(pid, f"#{pid}") for pid in (m.id_peres or [])]
    else:
        d["peres_labels"] = []
    return d

def _enrich_projet(p: ProjetOpenField) -> dict:
    d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
    d["culture_nom"]      = p.culture.nom if p.culture else None
    peres_map = {
        pe.id_pere: (pe.variete.nom_variete if pe.variete else pe.nom_libre or f"Mâle #{pe.id_pere}")
        for pe in p.peres
    }
    d["peres"]            = [{"id_pere": pe.id_pere, "id_projet": pe.id_projet,
                               "id_variete": pe.id_variete, "nom_libre": pe.nom_libre,
                               "notes": pe.notes, "created_at": pe.created_at,
                               "variete_nom": pe.variete.nom_variete if pe.variete else None}
                              for pe in p.peres]
    d["meres"]            = [_enrich_mere(m, peres_map) for m in p.meres]
    d["nb_meres"]         = len(p.meres)
    d["nb_peres"]         = len(p.peres)
    d["nb_graines_total"] = sum(m.nb_graines or 0 for m in p.meres)
    return d

def _load_projet(db: Session, projet_id: int) -> ProjetOpenField:
    p = (
        db.query(ProjetOpenField)
        .options(
            selectinload(ProjetOpenField.meres).selectinload(PlanteMereOpenField.variete),
            selectinload(ProjetOpenField.meres).selectinload(PlanteMereOpenField.pollen),
            selectinload(ProjetOpenField.meres).selectinload(PlanteMereOpenField.plant),
            selectinload(ProjetOpenField.meres).selectinload(PlanteMereOpenField.packgraine),
            selectinload(ProjetOpenField.peres).selectinload(PlantePereOpenField.variete),
            selectinload(ProjetOpenField.culture),
        )
        .filter(ProjetOpenField.id_projet == projet_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Projet open field non trouvé")
    return p


# ─── Projets CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProjetOpenFieldRead])
def list_projets(db: Session = Depends(get_db), statut: Optional[str] = None):
    q = (
        db.query(ProjetOpenField)
        .options(
            selectinload(ProjetOpenField.meres).selectinload(PlanteMereOpenField.variete),
            selectinload(ProjetOpenField.meres).selectinload(PlanteMereOpenField.pollen),
            selectinload(ProjetOpenField.meres).selectinload(PlanteMereOpenField.plant),
            selectinload(ProjetOpenField.meres).selectinload(PlanteMereOpenField.packgraine),
            selectinload(ProjetOpenField.peres).selectinload(PlantePereOpenField.variete),
            selectinload(ProjetOpenField.culture),
        )
        .order_by(ProjetOpenField.created_at.desc())
    )
    if statut:
        q = q.filter(ProjetOpenField.statut == statut)
    return [_enrich_projet(p) for p in q.all()]


@router.get("/{projet_id}", response_model=ProjetOpenFieldRead)
def get_projet(projet_id: int, db: Session = Depends(get_db)):
    return _enrich_projet(_load_projet(db, projet_id))


@router.post("", response_model=ProjetOpenFieldRead, status_code=201)
def create_projet(data: ProjetOpenFieldCreate, db: Session = Depends(get_db)):
    projet = ProjetOpenField(**data.model_dump())
    db.add(projet)
    db.commit()
    db.refresh(projet)
    return _enrich_projet(_load_projet(db, projet.id_projet))


@router.patch("/{projet_id}", response_model=ProjetOpenFieldRead)
def update_projet(projet_id: int, data: ProjetOpenFieldUpdate, db: Session = Depends(get_db)):
    projet = _load_projet(db, projet_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(projet, k, v)
    db.commit()
    return _enrich_projet(_load_projet(db, projet_id))


@router.delete("/{projet_id}", status_code=204)
def delete_projet(projet_id: int, db: Session = Depends(get_db)):
    projet = _load_projet(db, projet_id)
    db.delete(projet)
    db.commit()


# ─── Mères CRUD ───────────────────────────────────────────────────────────────

@router.post("/{projet_id}/meres", response_model=ProjetOpenFieldRead, status_code=201)
def add_mere(projet_id: int, data: PlanteMereCreate, db: Session = Depends(get_db)):
    _load_projet(db, projet_id)  # vérif existence
    mere = PlanteMereOpenField(id_projet=projet_id, **data.model_dump())
    db.add(mere)
    db.commit()
    return _enrich_projet(_load_projet(db, projet_id))


@router.patch("/{projet_id}/meres/{mere_id}", response_model=ProjetOpenFieldRead)
def update_mere(projet_id: int, mere_id: int, data: PlanteMereUpdate, db: Session = Depends(get_db)):
    mere = db.query(PlanteMereOpenField).filter(
        PlanteMereOpenField.id_mere == mere_id,
        PlanteMereOpenField.id_projet == projet_id,
    ).first()
    if not mere:
        raise HTTPException(status_code=404, detail="Mère non trouvée")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(mere, k, v)
    db.commit()
    return _enrich_projet(_load_projet(db, projet_id))


@router.delete("/{projet_id}/meres/{mere_id}", status_code=204)
def delete_mere(projet_id: int, mere_id: int, db: Session = Depends(get_db)):
    mere = db.query(PlanteMereOpenField).filter(
        PlanteMereOpenField.id_mere == mere_id,
        PlanteMereOpenField.id_projet == projet_id,
    ).first()
    if not mere:
        raise HTTPException(status_code=404, detail="Mère non trouvée")
    db.delete(mere)
    db.commit()


# ─── Récolte ──────────────────────────────────────────────────────────────────

@router.post("/{projet_id}/meres/{mere_id}/recolte", response_model=ProjetOpenFieldRead)
def recolte_mere(projet_id: int, mere_id: int, data: RecolteInput, db: Session = Depends(get_db)):
    mere = db.query(PlanteMereOpenField).options(
        selectinload(PlanteMereOpenField.variete),
        selectinload(PlanteMereOpenField.pollen),
    ).filter(
        PlanteMereOpenField.id_mere == mere_id,
        PlanteMereOpenField.id_projet == projet_id,
    ).first()
    if not mere:
        raise HTTPException(status_code=404, detail="Mère non trouvée")

    mere.date_recolte    = data.date_recolte or date.today()
    mere.nb_graines      = data.nb_graines
    mere.poids_graines_g = data.poids_graines_g
    mere.qualite_graines = data.qualite_graines

    # Créer un PackGraine + nouvelle Variete + Graines individuelles si demandé
    if data.creer_pack and data.nb_graines:
        projet = db.query(ProjetOpenField).filter(ProjetOpenField.id_projet == projet_id).first()

        # ── Composer le nom du croisement ──
        nom_mere = (mere.variete.nom_variete if mere.variete else None) or mere.nom_phenotype or "Inconnue"
        peres_noms = []
        if mere.id_peres:
            peres_db = db.query(PlantePereOpenField).filter(
                PlantePereOpenField.id_projet == projet_id,
                PlantePereOpenField.id_pere.in_(mere.id_peres)
            ).all()
            for pe in peres_db:
                peres_noms.append(pe.variete.nom_variete if pe.variete else pe.nom_libre or f"Mâle #{pe.id_pere}")
        if not peres_noms and mere.nom_pere_libre:
            peres_noms.append(mere.nom_pere_libre)
        if not peres_noms:
            peres_noms.append("inconnu")

        saison = projet.saison or str(date.today().year)
        nom_croisement = data.nom_variete_croisement or f"{nom_mere} × {' / '.join(peres_noms)} (OF {saison})"
        croisement_desc = f"♀ {nom_mere}  ×  ♂ {', '.join(peres_noms)} — Open Field {saison}"

        # ── Créer la nouvelle Variete ──
        nouvelle_variete = Variete(
            nom_variete=nom_croisement,
            croisement_variete=croisement_desc,
            informations_variete=f"Issu du projet open field : {projet.nom}",
        )
        db.add(nouvelle_variete)
        db.flush()

        # ── PackGraine ──
        pack = PackGraine(
            id_fournisseur=None,
            nbr_graines=data.nb_graines,
            prix_achat=0,
            date_achat=data.date_recolte or date.today(),
        )
        db.add(pack)
        db.flush()
        mere.id_packgraine = pack.id_packgraine

        # ── Graines individuelles liées à la nouvelle variété ──
        for _ in range(data.nb_graines):
            g = Graine(
                id_breeder=None,
                id_variete=nouvelle_variete.id_variete,
                id_packgraine=pack.id_packgraine,
                types_graines="Régulière",
                date_achat=data.date_recolte or date.today(),
                prix_achat=0,
                utilisee=False,
            )
            db.add(g)

    db.commit()

    # Passer le projet en "recolte" si toutes les mères ont une récolte
    projet = _load_projet(db, projet_id)
    if all(m.date_recolte for m in projet.meres):
        projet.statut = "recolte"
        db.commit()

    return _enrich_projet(_load_projet(db, projet_id))

# ─── Pères CRUD ───────────────────────────────────────────────────────────────

@router.post("/{projet_id}/peres", response_model=ProjetOpenFieldRead, status_code=201)
def add_pere(projet_id: int, data: PlantePereCreate, db: Session = Depends(get_db)):
    _load_projet(db, projet_id)
    pere = PlantePereOpenField(id_projet=projet_id, **data.model_dump())
    db.add(pere)
    db.commit()
    return _enrich_projet(_load_projet(db, projet_id))


@router.patch("/{projet_id}/peres/{pere_id}", response_model=ProjetOpenFieldRead)
def update_pere(projet_id: int, pere_id: int, data: PlantePereUpdate, db: Session = Depends(get_db)):
    pere = db.query(PlantePereOpenField).filter(
        PlantePereOpenField.id_pere == pere_id,
        PlantePereOpenField.id_projet == projet_id,
    ).first()
    if not pere:
        raise HTTPException(status_code=404, detail="Pere non trouve")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(pere, k, v)
    db.commit()
    return _enrich_projet(_load_projet(db, projet_id))


@router.delete("/{projet_id}/peres/{pere_id}", status_code=204)
def delete_pere(projet_id: int, pere_id: int, db: Session = Depends(get_db)):
    pere = db.query(PlantePereOpenField).filter(
        PlantePereOpenField.id_pere == pere_id,
        PlantePereOpenField.id_projet == projet_id,
    ).first()
    if not pere:
        raise HTTPException(status_code=404, detail="Pere non trouve")
    db.delete(pere)
    db.commit()
