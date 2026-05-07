"""Routers pour Graine et PackGraine"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Graine, PackGraine, Breeder, Variete, Croisement
from app.schemas.graine import (
    GraineCreate,
    GraineRead,
    GraineSimple,
    PackGraineCreate,
    PackGraineRead,
    PackGraineCompletCreate,
    PackGraineCompletRead,
    PackGraineCompletUpdate,
    CatalogueItem,
)

router = APIRouter(prefix="/api", tags=["graines"])


# ========== Pack Graine ==========

@router.get("/packs", response_model=list[PackGraineRead])
def get_packs(db: Session = Depends(get_db)):
    return db.query(PackGraine).all()


@router.get("/packs/{pack_id}", response_model=PackGraineRead)
def get_pack(pack_id: int, db: Session = Depends(get_db)):
    pack = db.query(PackGraine).filter(PackGraine.id_packgraine == pack_id).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack non trouvé")
    return pack


@router.get("/packs/{pack_id}/graines", response_model=list[GraineSimple])
def get_graines_du_pack(pack_id: int, db: Session = Depends(get_db)):
    pack = db.query(PackGraine).filter(PackGraine.id_packgraine == pack_id).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack non trouvé")
    return db.query(Graine).filter(Graine.id_packgraine == pack_id).order_by(Graine.id_graine).all()


@router.post("/packs", response_model=PackGraineRead)
def create_pack(pack: PackGraineCreate, db: Session = Depends(get_db)):
    db_pack = PackGraine(
        id_fournisseur=pack.id_fournisseur,
        nbr_graines=pack.nbr_graines,
        prix_achat=pack.prix_achat,
        date_achat=pack.date_achat,
    )
    db.add(db_pack)
    db.commit()
    db.refresh(db_pack)
    return db_pack


@router.post("/packs/complet", response_model=PackGraineCompletRead)
def create_pack_complet(pack: PackGraineCompletCreate, db: Session = Depends(get_db)):
    """Crée un pack + toutes ses graines. Met à jour le croisement de la variété si fourni."""
    breeder = db.query(Breeder).filter(Breeder.id_breeder == pack.id_breeder).first()
    if not breeder:
        raise HTTPException(status_code=404, detail="Breeder non trouvé")

    variete = db.query(Variete).filter(Variete.id_variete == pack.id_variete).first()
    if not variete:
        raise HTTPException(status_code=404, detail="Variété non trouvée")

    # Met à jour le croisement si fourni
    if pack.croisement_variete is not None:
        variete.croisement_variete = pack.croisement_variete

    db_pack = PackGraine(
        id_fournisseur=pack.id_fournisseur,
        nbr_graines=pack.nbr_graines,
        prix_achat=pack.prix_achat,
        date_achat=pack.date_achat,
    )
    db.add(db_pack)
    db.flush()

    prix_par_graine = None
    if pack.prix_achat and pack.nbr_graines > 0:
        prix_par_graine = float(pack.prix_achat) / pack.nbr_graines

    for _ in range(pack.nbr_graines):
        db_graine = Graine(
            id_breeder=pack.id_breeder,
            id_variete=pack.id_variete,
            id_packgraine=db_pack.id_packgraine,
            types_graines=pack.types_graines,
            duree_flo_min=pack.duree_flo_min,
            duree_flo_max=pack.duree_flo_max,
            prix_achat=prix_par_graine,
            edition_limite=pack.edition_limite,
            date_achat=pack.date_achat,
            utilisee=False,
        )
        db.add(db_graine)

    db.commit()
    db.refresh(db_pack)

    return PackGraineCompletRead(
        id_packgraine=db_pack.id_packgraine,
        nbr_graines=pack.nbr_graines,
        nbr_graines_crees=pack.nbr_graines,
        breeder_nom=breeder.nom_breeder,
        variete_nom=variete.nom_variete,
    )


@router.put("/packs/{pack_id}/complet", response_model=PackGraineCompletRead)
def update_pack_complet(pack_id: int, pack: PackGraineCompletUpdate, db: Session = Depends(get_db)):
    """Met à jour pack + graines + croisement de la variété."""
    db_pack = db.query(PackGraine).filter(PackGraine.id_packgraine == pack_id).first()
    if not db_pack:
        raise HTTPException(status_code=404, detail="Pack non trouvé")

    breeder = db.query(Breeder).filter(Breeder.id_breeder == pack.id_breeder).first()
    if not breeder:
        raise HTTPException(status_code=404, detail="Breeder non trouvé")

    variete = db.query(Variete).filter(Variete.id_variete == pack.id_variete).first()
    if not variete:
        raise HTTPException(status_code=404, detail="Variété non trouvée")

    # Met à jour le croisement de la variété si fourni
    if pack.croisement_variete is not None:
        variete.croisement_variete = pack.croisement_variete

    # Met à jour le pack
    db_pack.id_fournisseur = pack.id_fournisseur
    db_pack.prix_achat = pack.prix_achat
    db_pack.date_achat = pack.date_achat

    # Met à jour les métadonnées de toutes les graines existantes
    graines = db.query(Graine).filter(Graine.id_packgraine == pack_id).all()
    for g in graines:
        g.id_breeder = pack.id_breeder
        g.id_variete = pack.id_variete
        g.types_graines = pack.types_graines
        g.duree_flo_min = pack.duree_flo_min
        g.duree_flo_max = pack.duree_flo_max
        g.edition_limite = pack.edition_limite

    # Ajustement du nombre de graines si demandé
    if pack.nbr_graines is not None and pack.nbr_graines > 0:
        current_total = len(graines)
        new_total = pack.nbr_graines

        if new_total > current_total:
            # Ajouter des graines manquantes
            prix_par_graine = None
            if pack.prix_achat and new_total > 0:
                prix_par_graine = float(pack.prix_achat) / new_total
            for _ in range(new_total - current_total):
                db.add(Graine(
                    id_breeder=pack.id_breeder,
                    id_variete=pack.id_variete,
                    id_packgraine=pack_id,
                    types_graines=pack.types_graines,
                    duree_flo_min=pack.duree_flo_min,
                    duree_flo_max=pack.duree_flo_max,
                    prix_achat=prix_par_graine,
                    edition_limite=pack.edition_limite,
                    date_achat=pack.date_achat,
                    utilisee=False,
                ))

        elif new_total < current_total:
            # Supprimer des graines — non-utilisées en premier
            to_remove = current_total - new_total
            non_utilisees = (
                db.query(Graine)
                .filter(Graine.id_packgraine == pack_id, Graine.utilisee == False)
                .order_by(Graine.id_graine.desc())
                .limit(to_remove)
                .all()
            )
            for g in non_utilisees:
                db.delete(g)
                to_remove -= 1
            # Si toujours trop, supprimer des utilisées
            if to_remove > 0:
                utilisees = (
                    db.query(Graine)
                    .filter(Graine.id_packgraine == pack_id, Graine.utilisee == True)
                    .order_by(Graine.id_graine.desc())
                    .limit(to_remove)
                    .all()
                )
                for g in utilisees:
                    db.delete(g)

        db_pack.nbr_graines = new_total
        db.flush()

    final_count = db.query(Graine).filter(Graine.id_packgraine == pack_id).count()

    db.commit()
    db.refresh(db_pack)

    return PackGraineCompletRead(
        id_packgraine=db_pack.id_packgraine,
        nbr_graines=db_pack.nbr_graines,
        nbr_graines_crees=final_count,
        breeder_nom=breeder.nom_breeder,
        variete_nom=variete.nom_variete,
    )


@router.delete("/packs/{pack_id}")
def delete_pack(pack_id: int, db: Session = Depends(get_db)):
    db_pack = db.query(PackGraine).filter(PackGraine.id_packgraine == pack_id).first()
    if not db_pack:
        raise HTTPException(status_code=404, detail="Pack non trouvé")
    # Effacer la référence dans les croisements avant suppression (FK constraint)
    db.query(Croisement).filter(
        Croisement.id_packgraine_resultat == pack_id
    ).update({"id_packgraine_resultat": None}, synchronize_session=False)
    db.query(Graine).filter(Graine.id_packgraine == pack_id).delete(synchronize_session=False)
    db.delete(db_pack)
    db.commit()
    return {"message": "Pack supprimé"}


# ========== Graine individuelle ==========

@router.get("/graines", response_model=list[GraineRead])
def get_graines(db: Session = Depends(get_db)):
    return db.query(Graine).all()


@router.get("/graines/{graine_id}", response_model=GraineRead)
def get_graine(graine_id: int, db: Session = Depends(get_db)):
    graine = db.query(Graine).filter(Graine.id_graine == graine_id).first()
    if not graine:
        raise HTTPException(status_code=404, detail="Graine non trouvée")
    return graine


@router.post("/graines", response_model=GraineRead)
def create_graine(graine: GraineCreate, db: Session = Depends(get_db)):
    db_graine = Graine(**graine.model_dump())
    db.add(db_graine)
    db.commit()
    db.refresh(db_graine)
    return db_graine


@router.put("/graines/{graine_id}", response_model=GraineRead)
def update_graine(graine_id: int, graine: GraineCreate, db: Session = Depends(get_db)):
    db_graine = db.query(Graine).filter(Graine.id_graine == graine_id).first()
    if not db_graine:
        raise HTTPException(status_code=404, detail="Graine non trouvée")
    for k, v in graine.model_dump().items():
        setattr(db_graine, k, v)
    db.commit()
    db.refresh(db_graine)
    return db_graine


@router.patch("/graines/{graine_id}/toggle", response_model=GraineSimple)
def toggle_graine_utilisee(graine_id: int, db: Session = Depends(get_db)):
    db_graine = db.query(Graine).filter(Graine.id_graine == graine_id).first()
    if not db_graine:
        raise HTTPException(status_code=404, detail="Graine non trouvée")
    db_graine.utilisee = not db_graine.utilisee
    db.commit()
    db.refresh(db_graine)
    return db_graine


@router.delete("/graines/{graine_id}")
def delete_graine(graine_id: int, db: Session = Depends(get_db)):
    db_graine = db.query(Graine).filter(Graine.id_graine == graine_id).first()
    if not db_graine:
        raise HTTPException(status_code=404, detail="Graine non trouvée")
    db.delete(db_graine)
    db.commit()
    return {"message": "Graine supprimée"}


# ========== Catalogue ==========

@router.get("/catalogue", response_model=list[CatalogueItem])
def get_catalogue(db: Session = Depends(get_db)):
    """Catalogue complet. paquet_ouvert = au moins une graine utilisée."""
    packs = db.query(PackGraine).all()
    catalogue = []

    for pack in packs:
        # Compter les graines NON utilisées (utilisee = False ou NULL)
        remaining = db.query(func.count(Graine.id_graine)).filter(
            Graine.id_packgraine == pack.id_packgraine,
            (Graine.utilisee == False) | (Graine.utilisee == None)
        ).scalar() or 0

        first_graine = db.query(Graine).filter(
            Graine.id_packgraine == pack.id_packgraine
        ).first()

        if first_graine:
            breeder = db.query(Breeder).filter(Breeder.id_breeder == first_graine.id_breeder).first() if first_graine.id_breeder else None
            variete = db.query(Variete).filter(Variete.id_variete == first_graine.id_variete).first() if first_graine.id_variete else None
            if pack.id_packgraine >= 130:  # debug packs récents
                print(f"[DEBUG CATALOGUE] pack={pack.id_packgraine} nbr_graines={pack.nbr_graines} remaining={remaining} graine.id_variete={first_graine.id_variete} variete_nom={variete.nom_variete if variete else 'None'} breeder_nom={breeder.nom_breeder if breeder else 'None'}", flush=True)
            catalogue.append(CatalogueItem(
                id_packgraine=pack.id_packgraine,
                id_fournisseur=pack.id_fournisseur,
                id_breeder=first_graine.id_breeder,
                id_variete=first_graine.id_variete,
                breeder_nom=breeder.nom_breeder if breeder else "Inconnu",
                variete_nom=variete.nom_variete if variete else "Inconnue",
                croisement_variete=variete.croisement_variete if variete else None,
                lien_web=variete.lien_web if variete else None,
                type_graines=first_graine.types_graines,
                duree_flo_min=first_graine.duree_flo_min,
                duree_flo_max=first_graine.duree_flo_max,
                prix_par_graine=float(pack.prix_achat / pack.nbr_graines) if pack.prix_achat and pack.nbr_graines else None,
                nbr_graines_total=pack.nbr_graines or 0,
                nbr_graines_restantes=remaining,
                paquet_ouvert=(remaining < (pack.nbr_graines or 0)),
                edition_limite=first_graine.edition_limite,
                date_achat=pack.date_achat,
            ))

    return catalogue
